"use client";

import {
  type ActividadList,
  type AnalyticsResumen,
  campaniaSchema,
  type DashboardResumen,
  type PaseListItem,
  personalizacionSchema,
  reglasSchema,
  rewardSchema,
  type SelloListItem,
} from "@fidelitypass/contracts";
import { theme } from "@fidelitypass/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";

interface StaffItem {
  id: string;
  nombre: string;
  createdAt: string;
}

interface StaffResponse {
  merchantId: string;
  staff: StaffItem[];
}

interface PersonalizacionResponse {
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  isStorageConfigured: boolean;
}

interface RewardItem {
  id: string;
  merchantId: string;
  nombre: string;
  descripcion: string | null;
  costo: number;
  sellosRequeridos?: number;
  activa: boolean;
  createdAt: string;
}

interface ReglasResponse {
  maxSellosPorDia: number;
  modoAcumulacion: "sello_por_visita" | "sello_por_monto" | "puntos_por_monto";
  montoMinimoSello: number | null;
  montoPorSello: number | null;
  puntosPorUnidad: number | null;
  bonoBienvenida?: number;
  tieneMovimientos?: boolean;
}

interface CampaniaItem {
  id: string;
  titulo: string;
  cuerpo: string;
  createdAt: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export default function PanelPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  // Estados locales para personalización de tarjeta (PR-08)
  const [logoUrl, setLogoUrl] = useState("");
  const [colorPrimario, setColorPrimario] = useState<string>(
    theme.colors.azulNoche,
  );
  const [colorSecundario, setColorSecundario] = useState<string>(
    theme.colors.celesteBandera,
  );
  const [isStorageEnabled, setIsStorageEnabled] = useState(false);
  const [savingPersonalizacion, setSavingPersonalizacion] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [personalizacionError, setPersonalizacionError] = useState("");
  const [personalizacionSuccess, setPersonalizacionSuccess] = useState("");

  // Estados locales para el alta de empleados y QR
  const [nombreStaff, setNombreStaff] = useState("");
  const [pinStaff, setPinStaff] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [staffSuccess, setStaffSuccess] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassLink, setCopiedPassLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [origin, setOrigin] = useState("");
  const [walletPreviewTab, setWalletPreviewTab] = useState<
    "ambas" | "apple" | "google"
  >("ambas");
  const [sampleQrDataUrl, setSampleQrDataUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    QRCode.toDataURL("FID-SAMPLE-001", {
      width: 140,
      margin: 1,
      color: {
        dark: "#0A2540",
        light: "#FFFFFF",
      },
    })
      .then(setSampleQrDataUrl)
      .catch(() => {});
  }, []);

  // 1. Resumen de métricas
  const {
    data: resumen,
    isLoading: resumenLoading,
    isError: resumenError,
  } = useQuery<DashboardResumen>({
    queryKey: ["panel", "resumen"],
    queryFn: () => fetchJson<DashboardResumen>("/api/panel/resumen"),
  });

  // 2. Lista de tarjetas emitidas
  const {
    data: pases = [],
    isLoading: pasesLoading,
    isError: pasesError,
  } = useQuery<PaseListItem[]>({
    queryKey: ["panel", "pases"],
    queryFn: () => fetchJson<PaseListItem[]>("/api/panel/pases"),
  });

  // 3. Lista de sellos recientes
  const {
    data: sellos = [],
    isLoading: sellosLoading,
    isError: sellosError,
  } = useQuery<SelloListItem[]>({
    queryKey: ["panel", "sellos"],
    queryFn: () => fetchJson<SelloListItem[]>("/api/panel/sellos"),
  });

  // 4. Lista de empleados
  const { data: staffData, isLoading: staffListLoading } =
    useQuery<StaffResponse>({
      queryKey: ["panel", "staff"],
      queryFn: () => fetchJson<StaffResponse>("/api/staff"),
    });

  // 5. Personalización de tarjeta (logo y colores)
  const { data: personalizacionData } = useQuery<PersonalizacionResponse>({
    queryKey: ["merchant", "personalizar"],
    queryFn: () =>
      fetchJson<PersonalizacionResponse>("/api/merchants/personalizar"),
  });

  useEffect(() => {
    if (personalizacionData) {
      if (personalizacionData.logoUrl) setLogoUrl(personalizacionData.logoUrl);
      if (personalizacionData.colorPrimario)
        setColorPrimario(personalizacionData.colorPrimario);
      if (personalizacionData.colorSecundario)
        setColorSecundario(personalizacionData.colorSecundario);
      setIsStorageEnabled(Boolean(personalizacionData.isStorageConfigured));
    }
  }, [personalizacionData]);

  // Estados locales para Recompensas (PR-09 / PR-13)
  const [rewardNombre, setRewardNombre] = useState("");
  const [rewardDescripcion, setRewardDescripcion] = useState("");
  const [rewardCosto, setRewardCosto] = useState<number | "">(10);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardError, setRewardError] = useState("");
  const [rewardSuccess, setRewardSuccess] = useState("");

  // Estados locales para Reglas de Acumulación (PR-13)
  const [modoAcumulacion, setModoAcumulacion] = useState<
    "sello_por_visita" | "sello_por_monto" | "puntos_por_monto"
  >("sello_por_visita");
  const [montoMinimoSello, setMontoMinimoSello] = useState<string>("");
  const [montoPorSello, setMontoPorSello] = useState<string>("");
  const [puntosPorUnidad, setPuntosPorUnidad] = useState<string>("");
  const [tieneMovimientos, setTieneMovimientos] = useState<boolean>(false);
  const [maxSellosPorDia, setMaxSellosPorDia] = useState<number>(1);
  const [bonoBienvenida, setBonoBienvenida] = useState<number>(0);
  const [savingReglas, setSavingReglas] = useState(false);
  const [reglasError, setReglasError] = useState("");
  const [reglasSuccess, setReglasSuccess] = useState("");

  // 6. Catálogo de recompensas
  const { data: rewardsList = [], isLoading: rewardsListLoading } = useQuery<
    RewardItem[]
  >({
    queryKey: ["panel", "rewards"],
    queryFn: () => fetchJson<RewardItem[]>("/api/rewards"),
  });

  // 7. Reglas de sellado
  const { data: reglasData } = useQuery<ReglasResponse>({
    queryKey: ["panel", "reglas"],
    queryFn: () => fetchJson<ReglasResponse>("/api/merchants/reglas"),
  });

  useEffect(() => {
    if (reglasData) {
      if (typeof reglasData.maxSellosPorDia === "number") {
        setMaxSellosPorDia(reglasData.maxSellosPorDia);
      }
      if (typeof reglasData.bonoBienvenida === "number") {
        setBonoBienvenida(reglasData.bonoBienvenida);
      }
      if (reglasData.modoAcumulacion) {
        setModoAcumulacion(reglasData.modoAcumulacion);
      }
      setMontoMinimoSello(
        reglasData.montoMinimoSello !== null &&
          reglasData.montoMinimoSello !== undefined
          ? String(reglasData.montoMinimoSello)
          : "",
      );
      setMontoPorSello(
        reglasData.montoPorSello !== null &&
          reglasData.montoPorSello !== undefined
          ? String(reglasData.montoPorSello)
          : "",
      );
      setPuntosPorUnidad(
        reglasData.puntosPorUnidad !== null &&
          reglasData.puntosPorUnidad !== undefined
          ? String(reglasData.puntosPorUnidad)
          : "",
      );
      setTieneMovimientos(Boolean(reglasData.tieneMovimientos));
    }
  }, [reglasData]);

  const unidadLabel =
    modoAcumulacion === "puntos_por_monto" ? "puntos" : "sellos";

  // Estados locales para Campañas (PR-10)
  const [campaniaTitulo, setCampaniaTitulo] = useState("");
  const [campaniaCuerpo, setCampaniaCuerpo] = useState("");
  const [showConfirmCampania, setShowConfirmCampania] = useState(false);
  const [campaniaLoading, setCampaniaLoading] = useState(false);
  const [campaniaError, setCampaniaError] = useState("");
  const [campaniaSuccess, setCampaniaSuccess] = useState("");

  // 8. Historial de campañas (PR-10)
  const {
    data: campaniasList = [],
    isLoading: campaniasLoading,
    isError: campaniasError,
  } = useQuery<CampaniaItem[]>({
    queryKey: ["panel", "campanias"],
    queryFn: () => fetchJson<CampaniaItem[]>("/api/campanias"),
  });
  const activePassesCount = pases.filter((p) => p.estado === "activa").length;

  // Estados para Analytics (PR-14)
  const [analyticsDesde, setAnalyticsDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [analyticsHasta, setAnalyticsHasta] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [analyticsQuery, setAnalyticsQuery] = useState("");
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const handlePreset7Dias = () => {
    const today = new Date();
    const d = new Date();
    d.setDate(d.getDate() - 6);
    setAnalyticsDesde(d.toISOString().slice(0, 10));
    setAnalyticsHasta(today.toISOString().slice(0, 10));
    setAnalyticsPage(1);
  };

  const handlePreset30Dias = () => {
    const today = new Date();
    const d = new Date();
    d.setDate(d.getDate() - 29);
    setAnalyticsDesde(d.toISOString().slice(0, 10));
    setAnalyticsHasta(today.toISOString().slice(0, 10));
    setAnalyticsPage(1);
  };

  // 9. Resumen Analytics (PR-14)
  const { data: analyticsResumen, isLoading: analyticsResumenLoading } =
    useQuery<AnalyticsResumen>({
      queryKey: ["analytics", "resumen", analyticsDesde, analyticsHasta],
      queryFn: () =>
        fetchJson<AnalyticsResumen>(
          `/api/analytics/resumen?desde=${analyticsDesde}&hasta=${analyticsHasta}`,
        ),
    });

  // 10. Actividad unificada (PR-14)
  const {
    data: actividadData,
    isLoading: actividadLoading,
    isError: actividadError,
  } = useQuery<ActividadList>({
    queryKey: [
      "analytics",
      "actividad",
      analyticsDesde,
      analyticsHasta,
      analyticsQuery,
      analyticsPage,
    ],
    queryFn: () =>
      fetchJson<ActividadList>(
        `/api/analytics/actividad?desde=${analyticsDesde}&hasta=${analyticsHasta}&q=${encodeURIComponent(
          analyticsQuery,
        )}&page=${analyticsPage}`,
      ),
  });

  const handleGuardarRecompensa = async (e: FormEvent) => {
    e.preventDefault();
    setRewardError("");
    setRewardSuccess("");

    const validation = rewardSchema.safeParse({
      nombre: rewardNombre.trim(),
      descripcion: rewardDescripcion.trim(),
      costo: Number(rewardCosto),
    });

    if (!validation.success) {
      setRewardError(
        validation.error.issues[0]?.message || "Datos de recompensa inválidos",
      );
      return;
    }

    setRewardLoading(true);

    try {
      const url = editingRewardId
        ? `/api/rewards/${editingRewardId}`
        : "/api/rewards";
      const method = editingRewardId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();
      if (!res.ok) {
        setRewardError(data.error || "Error al guardar la recompensa");
        return;
      }

      setRewardSuccess(
        editingRewardId
          ? "Recompensa actualizada con éxito."
          : "Recompensa creada con éxito.",
      );
      setRewardNombre("");
      setRewardDescripcion("");
      setRewardCosto(10);
      setEditingRewardId(null);
      queryClient.invalidateQueries({ queryKey: ["panel", "rewards"] });
      setTimeout(() => setRewardSuccess(""), 4000);
    } catch {
      setRewardError("Error de conexión al guardar la recompensa.");
    } finally {
      setRewardLoading(false);
    }
  };

  const handleEditarRecompensa = (r: RewardItem) => {
    setEditingRewardId(r.id);
    setRewardNombre(r.nombre);
    setRewardDescripcion(r.descripcion || "");
    setRewardCosto(r.costo ?? r.sellosRequeridos ?? 10);
    setRewardError("");
    setRewardSuccess("");
  };

  const handleCancelarEdicionRecompensa = () => {
    setEditingRewardId(null);
    setRewardNombre("");
    setRewardDescripcion("");
    setRewardCosto(10);
    setRewardError("");
  };

  const handleDesactivarRecompensa = async (id: string) => {
    try {
      const res = await fetch(`/api/rewards/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["panel", "rewards"] });
        setRewardSuccess("Recompensa desactivada con éxito.");
        setTimeout(() => setRewardSuccess(""), 4000);
      }
    } catch {
      setRewardError("Error al desactivar la recompensa.");
    }
  };

  const handleGuardarReglas = async (e: FormEvent) => {
    e.preventDefault();
    setReglasError("");
    setReglasSuccess("");

    const payload = {
      modoAcumulacion,
      maxSellosPorDia: Number(maxSellosPorDia),
      montoMinimoSello: montoMinimoSello ? Number(montoMinimoSello) : null,
      montoPorSello: montoPorSello ? Number(montoPorSello) : null,
      puntosPorUnidad: puntosPorUnidad ? Number(puntosPorUnidad) : null,
      bonoBienvenida: Number(bonoBienvenida) || 0,
    };

    const validation = reglasSchema.safeParse(payload);

    if (!validation.success) {
      setReglasError(
        validation.error.issues[0]?.message || "Regla de acumulación inválida",
      );
      return;
    }

    setSavingReglas(true);

    try {
      const res = await fetch("/api/merchants/reglas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();
      if (!res.ok) {
        setReglasError(data.error || "Error al guardar las reglas");
        return;
      }

      setReglasSuccess("Reglas guardadas con éxito.");
      queryClient.invalidateQueries({ queryKey: ["panel", "reglas"] });
      setTimeout(() => setReglasSuccess(""), 4000);
    } catch {
      setReglasError("Error de conexión al guardar las reglas.");
    } finally {
      setSavingReglas(false);
    }
  };

  const handlePreConfirmarCampania = (e: FormEvent) => {
    e.preventDefault();
    setCampaniaError("");
    setCampaniaSuccess("");

    const validation = campaniaSchema.safeParse({
      titulo: campaniaTitulo.trim(),
      cuerpo: campaniaCuerpo.trim(),
    });

    if (!validation.success) {
      setCampaniaError(
        validation.error.issues[0]?.message || "Datos de campaña inválidos",
      );
      return;
    }

    setShowConfirmCampania(true);
  };

  const handleEnviarCampania = async () => {
    setCampaniaError("");
    setCampaniaSuccess("");
    setCampaniaLoading(true);

    try {
      const res = await fetch("/api/campanias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: campaniaTitulo.trim(),
          cuerpo: campaniaCuerpo.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          setCampaniaError(data.error || "Wallets no configurados");
        } else {
          setCampaniaError(data.error || "Error al enviar la campaña");
        }
        setShowConfirmCampania(false);
        return;
      }

      setCampaniaSuccess(
        `Campaña enviada con éxito a ${data.enviadas ?? activePassesCount} tarjeta(s) activa(s).`,
      );
      setCampaniaTitulo("");
      setCampaniaCuerpo("");
      setShowConfirmCampania(false);
      queryClient.invalidateQueries({ queryKey: ["panel", "campanias"] });
      setTimeout(() => setCampaniaSuccess(""), 5000);
    } catch {
      setCampaniaError("Error de conexión al enviar la campaña.");
      setShowConfirmCampania(false);
    } finally {
      setCampaniaLoading(false);
    }
  };

  const handleGuardarPersonalizacion = async (e: FormEvent) => {
    e.preventDefault();
    setPersonalizacionError("");
    setPersonalizacionSuccess("");

    const validation = personalizacionSchema.safeParse({
      logoUrl: logoUrl.trim(),
      colorPrimario: colorPrimario.trim(),
      colorSecundario: colorSecundario.trim(),
    });

    if (!validation.success) {
      setPersonalizacionError(
        validation.error.issues[0]?.message ||
          "Datos de personalización inválidos",
      );
      return;
    }

    setSavingPersonalizacion(true);

    try {
      const res = await fetch("/api/merchants/personalizar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();
      if (!res.ok) {
        setPersonalizacionError(
          data.error || "Error al guardar la personalización.",
        );
        return;
      }

      setPersonalizacionSuccess("Personalización guardada con éxito.");
      queryClient.invalidateQueries({ queryKey: ["merchant", "personalizar"] });
      setTimeout(() => setPersonalizacionSuccess(""), 4000);
    } catch {
      setPersonalizacionError(
        "Error de conexión al guardar la personalización.",
      );
    } finally {
      setSavingPersonalizacion(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isStorageEnabled) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setPersonalizacionError(
        "El archivo supera el tamaño máximo permitido (2 MB).",
      );
      return;
    }

    setUploadingLogo(true);
    setPersonalizacionError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/merchants/personalizar/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setPersonalizacionError(data.error || "Error al subir el logo");
        return;
      }

      setLogoUrl(data.logoUrl);
      setPersonalizacionSuccess(
        "Logo subido correctamente. Guardá para aplicar los cambios.",
      );
    } catch {
      setPersonalizacionError("Error de conexión al subir el logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  const handleCrearStaff = async (e: FormEvent) => {
    e.preventDefault();
    setStaffError("");
    setStaffSuccess("");

    if (!nombreStaff.trim() || nombreStaff.trim().length < 2) {
      setStaffError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    if (!/^\d{4,6}$/.test(pinStaff)) {
      setStaffError("El PIN debe tener entre 4 y 6 dígitos numéricos");
      return;
    }

    setStaffLoading(true);

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreStaff.trim(), pin: pinStaff }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStaffError(data.error || "Error al crear el empleado");
        setStaffLoading(false);
        return;
      }

      setStaffSuccess(`Empleado "${data.nombre}" registrado exitosamente.`);
      setNombreStaff("");
      setPinStaff("");
      queryClient.invalidateQueries({ queryKey: ["panel", "staff"] });
    } catch {
      setStaffError("Error de conexión al registrar el empleado.");
    } finally {
      setStaffLoading(false);
    }
  };

  const employeeLoginLink = staffData?.merchantId
    ? `${origin || "http://localhost:3000"}/empleado/login?c=${staffData.merchantId}`
    : "";

  const publicPassUrl = staffData?.merchantId
    ? `${origin || "http://localhost:3000"}/pases/nuevo?c=${staffData.merchantId}`
    : "";

  useEffect(() => {
    if (publicPassUrl) {
      QRCode.toDataURL(publicPassUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: "#0A2540",
          light: "#FFFFFF",
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [publicPassUrl]);

  const handleCopyLink = () => {
    if (!employeeLoginLink) return;
    navigator.clipboard.writeText(employeeLoginLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const nombreComercio = session?.user?.name || "Comercio";

  if (sessionLoading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: theme.surface.light,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: theme.text.secondary, fontSize: "15px" }}>
          Cargando sesión...
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: theme.surface.light,
        padding: "36px 20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "1040px",
          margin: "0 auto",
        }}
      >
        {/* Cabecera del Panel */}
        <header
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            marginBottom: "24px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "12px",
                backgroundColor: `${theme.accent.premium}1A`,
                color: theme.accent.premium,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              FidelityPass · Tucumán
            </div>
            <h1
              id="titulo-panel"
              style={{
                margin: 0,
                fontSize: "26px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              Panel de {nombreComercio}
            </h1>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "14px",
                color: theme.text.secondary,
              }}
            >
              {session?.user?.email}
            </p>
          </div>

          <button
            type="button"
            id="btn-logout"
            onClick={handleSignOut}
            style={{
              backgroundColor: "transparent",
              color: theme.text.secondary,
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              padding: "9px 18px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </header>

        {/* Tarjetas de Resumen (Métricas) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
            marginBottom: "28px",
          }}
        >
          <div
            id="card-pases-emitidos"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
              border: `1px solid ${theme.colors.niebla}`,
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: theme.text.secondary,
                display: "block",
                marginBottom: "8px",
              }}
            >
              Tarjetas emitidas
            </span>
            <div
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              {resumenLoading
                ? "..."
                : resumenError
                  ? "-"
                  : (resumen?.pasesEmitidos ?? 0)}
            </div>
          </div>

          <div
            id="card-sellos-hoy"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
              border: `1px solid ${theme.colors.niebla}`,
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: theme.text.secondary,
                display: "block",
                marginBottom: "8px",
              }}
            >
              Sellos de hoy
            </span>
            <div
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: theme.accent.premium,
              }}
            >
              {resumenLoading
                ? "..."
                : resumenError
                  ? "-"
                  : (resumen?.sellosHoy ?? 0)}
            </div>
          </div>

          <div
            id="card-sellos-total"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
              border: `1px solid ${theme.colors.niebla}`,
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: theme.text.secondary,
                display: "block",
                marginBottom: "8px",
              }}
            >
              Sellos totales
            </span>
            <div
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: theme.button.primaryBg,
              }}
            >
              {resumenLoading
                ? "..."
                : resumenError
                  ? "-"
                  : (resumen?.sellosTotal ?? 0)}
            </div>
          </div>
        </section>

        {/* SECCIÓN: PERSONALIZAR TARJETA (PR-08) */}
        <section
          id="seccion-personalizar-tarjeta"
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            marginBottom: "28px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
          }}
        >
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "12px",
                backgroundColor: `${theme.accent.premium}1A`,
                color: theme.accent.premium,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Identidad de Marca
            </div>
            <h2
              style={{
                margin: "0 0 6px 0",
                fontSize: "20px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              Personalizar tarjeta
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: theme.text.secondary,
              }}
            >
              Elegí el logo y los colores que verán tus clientes en Google
              Wallet y Apple Wallet.
            </p>
          </div>

          {personalizacionError && (
            <div
              id="error-personalizacion"
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                backgroundColor: "#FEE2E2",
                color: "#991B1B",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "20px",
              }}
            >
              {personalizacionError}
            </div>
          )}

          {personalizacionSuccess && (
            <div
              id="success-personalizacion"
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                backgroundColor: "#DCFCE7",
                color: "#166534",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "20px",
              }}
            >
              {personalizacionSuccess}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "32px",
              alignItems: "start",
            }}
          >
            {/* Formulario de Configuración */}
            <form onSubmit={handleGuardarPersonalizacion}>
              {/* Logo Upload & URL */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  htmlFor="input-logo-file"
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: theme.text.onLight,
                  }}
                >
                  Logo del comercio
                </label>
                <div style={{ marginBottom: "10px" }}>
                  <input
                    type="file"
                    id="input-logo-file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={!isStorageEnabled || uploadingLogo}
                    style={{
                      display: "block",
                      width: "100%",
                      fontSize: "13px",
                      color: theme.text.secondary,
                      opacity: !isStorageEnabled ? 0.6 : 1,
                      cursor: !isStorageEnabled ? "not-allowed" : "pointer",
                    }}
                  />
                  {!isStorageEnabled && (
                    <span
                      id="msg-storage-disabled"
                      style={{
                        display: "block",
                        fontSize: "12px",
                        color: "#DC2626",
                        marginTop: "4px",
                        fontWeight: 500,
                      }}
                    >
                      El upload se habilita cuando se configure el
                      almacenamiento
                    </span>
                  )}
                  {uploadingLogo && (
                    <span
                      style={{
                        fontSize: "12px",
                        color: theme.button.primaryBg,
                        display: "block",
                        marginTop: "4px",
                      }}
                    >
                      Subiendo logo a storage...
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="url"
                    id="input-logo-url"
                    placeholder="O ingresá URL pública (ej. https://...)"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "13px",
                      color: theme.text.onLight,
                      outline: "none",
                    }}
                  />
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        backgroundColor: "#FFFFFF",
                        color: theme.text.secondary,
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {/* Color Pickers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <label
                    htmlFor="color-primario"
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: theme.text.onLight,
                    }}
                  >
                    Color fondo
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <input
                      type="color"
                      id="color-primario"
                      value={colorPrimario}
                      onChange={(e) => setColorPrimario(e.target.value)}
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        fontFamily: "monospace",
                        color: theme.text.secondary,
                      }}
                    >
                      {colorPrimario}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="color-secundario"
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: theme.text.onLight,
                    }}
                  >
                    Color detalles
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <input
                      type="color"
                      id="color-secundario"
                      value={colorSecundario}
                      onChange={(e) => setColorSecundario(e.target.value)}
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        fontFamily: "monospace",
                        color: theme.text.secondary,
                      }}
                    >
                      {colorSecundario}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                id="btn-guardar-personalizacion"
                disabled={savingPersonalizacion}
                style={{
                  backgroundColor: theme.button.primaryBg,
                  color: theme.button.primaryText,
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 24px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: savingPersonalizacion ? "not-allowed" : "pointer",
                  opacity: savingPersonalizacion ? 0.7 : 1,
                  boxShadow: "0 4px 12px rgba(116, 172, 223, 0.35)",
                }}
              >
                {savingPersonalizacion
                  ? "Guardando..."
                  : "Guardar personalización"}
              </button>
            </form>

            {/* Vistas Previas en Vivo (PR-12: estructura nativa de cada wallet) */}
            <div id="mock-tarjeta-preview">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: theme.text.onLight,
                    }}
                  >
                    Vistas previas en vivo
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: theme.text.secondary,
                    }}
                  >
                    Estructura nativa oficial de cada plataforma
                  </div>
                </div>

                {/* Tabs selector */}
                <div
                  style={{
                    display: "flex",
                    backgroundColor: "#F1F5F9",
                    borderRadius: "8px",
                    padding: "2px",
                    gap: "2px",
                  }}
                >
                  <button
                    type="button"
                    id="btn-tab-preview-ambas"
                    onClick={() => setWalletPreviewTab("ambas")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor:
                        walletPreviewTab === "ambas"
                          ? "#FFFFFF"
                          : "transparent",
                      color:
                        walletPreviewTab === "ambas"
                          ? theme.text.onLight
                          : theme.text.secondary,
                      boxShadow:
                        walletPreviewTab === "ambas"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    Ambas
                  </button>
                  <button
                    type="button"
                    id="btn-tab-preview-apple"
                    onClick={() => setWalletPreviewTab("apple")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor:
                        walletPreviewTab === "apple"
                          ? "#FFFFFF"
                          : "transparent",
                      color:
                        walletPreviewTab === "apple"
                          ? theme.text.onLight
                          : theme.text.secondary,
                      boxShadow:
                        walletPreviewTab === "apple"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    Apple Wallet
                  </button>
                  <button
                    type="button"
                    id="btn-tab-preview-google"
                    onClick={() => setWalletPreviewTab("google")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor:
                        walletPreviewTab === "google"
                          ? "#FFFFFF"
                          : "transparent",
                      color:
                        walletPreviewTab === "google"
                          ? theme.text.onLight
                          : theme.text.secondary,
                      boxShadow:
                        walletPreviewTab === "google"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    Google Wallet
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    walletPreviewTab === "ambas"
                      ? "repeat(auto-fit, minmax(280px, 1fr))"
                      : "1fr",
                  gap: "20px",
                  alignItems: "start",
                }}
              >
                {/* 1. VISTA APPLE WALLET (storeCard) */}
                {(walletPreviewTab === "ambas" ||
                  walletPreviewTab === "apple") && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: theme.text.secondary,
                        }}
                      >
                        Apple Wallet (storeCard)
                      </span>
                    </div>

                    <div
                      id="preview-apple-wallet"
                      style={{
                        backgroundColor:
                          colorPrimario || theme.colors.azulNoche,
                        borderRadius: "16px",
                        padding: "20px 18px",
                        boxShadow: "0 12px 28px rgba(10, 37, 64, 0.18)",
                        color: "#FFFFFF",
                        border: "1px solid rgba(255,255,255,0.15)",
                        position: "relative",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        minHeight: "450px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {/* Header storeCard: Logo (160x50) arriba izquierda | SELLOS / 5 arriba derecha */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "24px",
                        }}
                      >
                        <div style={{ maxWidth: "150px" }}>
                          {logoUrl ? (
                            /* biome-ignore lint/performance/noImgElement: Previsualización de logo en panel */
                            <img
                              src={logoUrl}
                              alt="Logo comercio"
                              style={{
                                width: "130px",
                                height: "40px",
                                objectFit: "contain",
                                display: "block",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: "16px",
                                fontWeight: 700,
                                color: "#FFFFFF",
                                lineHeight: 1.2,
                              }}
                            >
                              {nombreComercio}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: "10px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color:
                                colorSecundario || theme.colors.celesteBandera,
                            }}
                          >
                            {modoAcumulacion === "puntos_por_monto"
                              ? "PUNTOS"
                              : "SELLOS"}
                          </span>
                          <span
                            style={{
                              display: "block",
                              fontSize: "26px",
                              fontWeight: 700,
                              lineHeight: 1,
                              color: "#FFFFFF",
                              marginTop: "2px",
                            }}
                          >
                            {modoAcumulacion === "puntos_por_monto"
                              ? "50"
                              : "5"}
                          </span>
                        </div>
                      </div>

                      {/* Primary field: Nombre del cliente (visible — anti-fraude) */}
                      <div style={{ marginBottom: "18px" }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color:
                              colorSecundario || theme.colors.celesteBandera,
                            opacity: 0.9,
                          }}
                        >
                          TITULAR
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "20px",
                            fontWeight: 700,
                            color: "#FFFFFF",
                            marginTop: "2px",
                          }}
                        >
                          Sofía de Zavalía
                        </span>
                      </div>

                      {/* Secondary field: Próxima recompensa (placeholder PR-09) */}
                      <div style={{ marginBottom: "20px" }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color:
                              colorSecundario || theme.colors.celesteBandera,
                            opacity: 0.9,
                          }}
                        >
                          PRÓXIMA RECOMPENSA
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#FFFFFF",
                            marginTop: "2px",
                          }}
                        >
                          Café gratis (10 {unidadLabel})
                        </span>
                      </div>

                      {/* Barcode QR zone con serialNumber abajo */}
                      <div style={{ marginTop: "auto", paddingTop: "14px" }}>
                        <div
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderRadius: "10px",
                            padding: "10px",
                            textAlign: "center",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                        >
                          {sampleQrDataUrl ? (
                            /* biome-ignore lint/performance/noImgElement: QR preview */
                            <img
                              src={sampleQrDataUrl}
                              alt="QR de ejemplo"
                              style={{
                                width: "105px",
                                height: "105px",
                                display: "inline-block",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "105px",
                                height: "105px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#F1F5F9",
                                color: "#64748B",
                                fontSize: "11px",
                                fontWeight: 600,
                              }}
                            >
                              [ QR ]
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: "10px",
                              fontFamily: "monospace",
                              color: "#475569",
                              marginTop: "4px",
                            }}
                          >
                            FID-SAMPLE-001
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. VISTA GOOGLE WALLET (loyalty) */}
                {(walletPreviewTab === "ambas" ||
                  walletPreviewTab === "google") && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: theme.text.secondary,
                        }}
                      >
                        Google Wallet (loyalty)
                      </span>
                    </div>

                    <div
                      id="preview-google-wallet"
                      style={{
                        backgroundColor:
                          colorPrimario || theme.colors.azulNoche,
                        borderRadius: "24px",
                        padding: "20px 18px",
                        boxShadow: "0 12px 28px rgba(10, 37, 64, 0.18)",
                        color: "#FFFFFF",
                        border: "1px solid rgba(255,255,255,0.15)",
                        position: "relative",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        minHeight: "450px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {/* Header loyalty: Logo circular a la izquierda + nombre del comercio */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "18px",
                        }}
                      >
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            backgroundColor: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                            flexShrink: 0,
                          }}
                        >
                          {logoUrl ? (
                            /* biome-ignore lint/performance/noImgElement: Previsualización de logo en panel */
                            <img
                              src={logoUrl}
                              alt="Logo circular"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: "15px",
                                fontWeight: 700,
                                color: colorPrimario || theme.colors.azulNoche,
                              }}
                            >
                              {(nombreComercio || "F")[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            marginLeft: "12px",
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "#FFFFFF",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {nombreComercio}
                        </span>
                      </div>

                      {/* Balance de puntos: "5 sellos" */}
                      <div style={{ marginBottom: "16px" }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color:
                              colorSecundario || theme.colors.celesteBandera,
                            opacity: 0.9,
                          }}
                        >
                          BALANCE DE PUNTOS
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "28px",
                            fontWeight: 700,
                            color: "#FFFFFF",
                            marginTop: "2px",
                            lineHeight: 1.1,
                          }}
                        >
                          {modoAcumulacion === "puntos_por_monto"
                            ? "50 puntos"
                            : "5 sellos"}
                        </span>
                      </div>

                      {/* Filas de ejemplo (textModulesData) */}
                      <div
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.15)",
                          paddingTop: "8px",
                          paddingBottom: "8px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            color:
                              colorSecundario || theme.colors.celesteBandera,
                            opacity: 0.9,
                          }}
                        >
                          Titular
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#FFFFFF",
                          }}
                        >
                          Sofía de Zavalía
                        </span>
                      </div>

                      <div
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.15)",
                          borderBottom: "1px solid rgba(255,255,255,0.15)",
                          paddingTop: "8px",
                          paddingBottom: "8px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            color:
                              colorSecundario || theme.colors.celesteBandera,
                            opacity: 0.9,
                          }}
                        >
                          Próxima recompensa
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#FFFFFF",
                          }}
                        >
                          Café gratis (10 {unidadLabel})
                        </span>
                      </div>

                      {/* Barcode QR zone Google Wallet */}
                      <div style={{ marginTop: "auto", paddingTop: "14px" }}>
                        <div
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderRadius: "12px",
                            padding: "10px",
                            textAlign: "center",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                        >
                          {sampleQrDataUrl ? (
                            /* biome-ignore lint/performance/noImgElement: QR preview */
                            <img
                              src={sampleQrDataUrl}
                              alt="QR de ejemplo"
                              style={{
                                width: "105px",
                                height: "105px",
                                display: "inline-block",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "105px",
                                height: "105px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#F1F5F9",
                                color: "#64748B",
                                fontSize: "11px",
                                fontWeight: 600,
                              }}
                            >
                              [ QR ]
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: "10px",
                              fontFamily: "monospace",
                              color: "#475569",
                              marginTop: "4px",
                            }}
                          >
                            FID-SAMPLE-001
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN: QR PARA EMITIR TARJETAS */}
        <section
          id="seccion-qr-emision"
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            marginBottom: "28px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "24px",
          }}
        >
          <div style={{ flex: 1, minWidth: "280px" }}>
            <div
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "12px",
                backgroundColor: `${theme.accent.premium}1A`,
                color: theme.accent.premium,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Captación de clientes
            </div>
            <h2
              style={{
                margin: "0 0 6px 0",
                fontSize: "20px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              Tu QR para emitir tarjetas
            </h2>
            <p
              style={{
                margin: "0 0 16px 0",
                fontSize: "14px",
                color: theme.text.secondary,
                fontWeight: 600,
              }}
            >
              Imprimilo y ponelo en las mesas
            </p>
            <p
              style={{
                margin: "0 0 18px 0",
                fontSize: "13px",
                color: theme.text.secondary,
                lineHeight: 1.5,
              }}
            >
              Tus clientes escanean este código con su teléfono, ingresan su
              nombre y guardan la tarjeta digital de tu local en Google Wallet
              en menos de 10 segundos.
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                readOnly
                value={publicPassUrl}
                style={{
                  flex: 1,
                  minWidth: "200px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  backgroundColor: theme.surface.light,
                  color: theme.text.onLight,
                  outline: "none",
                }}
              />
              <button
                type="button"
                id="btn-copiar-link-pase"
                onClick={() => {
                  if (!publicPassUrl) return;
                  navigator.clipboard.writeText(publicPassUrl);
                  setCopiedPassLink(true);
                  setTimeout(() => setCopiedPassLink(false), 2500);
                }}
                style={{
                  backgroundColor: theme.button.primaryBg,
                  color: theme.button.primaryText,
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copiedPassLink ? "¡Copiado!" : "Copiar enlace"}
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              backgroundColor: theme.surface.light,
              borderRadius: "16px",
              border: `1px solid ${theme.colors.niebla}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
            }}
          >
            {qrDataUrl ? (
              /* biome-ignore lint/performance/noImgElement: Data URL generado dinámicamente en el cliente */
              <img
                src={qrDataUrl}
                alt="QR para emitir tarjetas"
                style={{
                  width: "180px",
                  height: "180px",
                  borderRadius: "8px",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "180px",
                  height: "180px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.text.secondary,
                  fontSize: "13px",
                }}
              >
                Generando QR...
              </div>
            )}
            <span
              style={{
                marginTop: "8px",
                fontSize: "11px",
                color: theme.text.secondary,
                fontWeight: 600,
              }}
            >
              Escanear para probar
            </span>
          </div>
        </section>

        {/* SECCIÓN: EMPLEADOS Y ACCESO */}
        <section
          id="seccion-empleados"
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            marginBottom: "28px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <h2
              style={{
                margin: "0 0 6px 0",
                fontSize: "18px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              Gestión de empleados y acceso
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: theme.text.secondary,
              }}
            >
              Creá accesos con PIN para que tus cajeros puedan escanear las
              tarjetas de los clientes.
            </p>
          </div>

          {/* Caja con Link de acceso para empleados */}
          <div
            style={{
              backgroundColor: theme.surface.light,
              borderRadius: "12px",
              padding: "18px 20px",
              marginBottom: "24px",
              border: `1px solid ${theme.colors.niebla}`,
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: theme.text.onLight,
                marginBottom: "4px",
              }}
            >
              Enlace de acceso al escáner:
            </span>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: "13px",
                color: theme.text.secondary,
              }}
            >
              Pasales este link o QR a tus empleados para que ingresen con su
              PIN desde su celular:
            </p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                type="text"
                readOnly
                value={employeeLoginLink}
                style={{
                  flex: 1,
                  minWidth: "240px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  backgroundColor: "#FFFFFF",
                  color: theme.text.onLight,
                  outline: "none",
                }}
              />
              <button
                type="button"
                id="btn-copiar-link-empleado"
                onClick={handleCopyLink}
                style={{
                  backgroundColor: theme.button.primaryBg,
                  color: theme.button.primaryText,
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copiedLink ? "¡Copiado!" : "Copiar enlace"}
              </button>
            </div>
          </div>

          {/* Formulario de Alta de Empleado */}
          <div
            style={{
              borderTop: `1px solid ${theme.colors.niebla}`,
              paddingTop: "20px",
              marginBottom: "24px",
            }}
          >
            <h3
              style={{
                margin: "0 0 14px 0",
                fontSize: "15px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              Registrar nuevo empleado
            </h3>

            {staffError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#FEE2E2",
                  color: "#991B1B",
                  fontSize: "13px",
                  marginBottom: "14px",
                }}
              >
                {staffError}
              </div>
            )}

            {staffSuccess && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#DCFCE7",
                  color: "#166534",
                  fontSize: "13px",
                  marginBottom: "14px",
                  fontWeight: 500,
                }}
              >
                {staffSuccess}
              </div>
            )}

            <form
              onSubmit={handleCrearStaff}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr)) auto",
                gap: "12px",
                alignItems: "end",
              }}
            >
              <div>
                <label
                  htmlFor="staff-nombre"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: theme.text.onLight,
                    marginBottom: "4px",
                  }}
                >
                  Nombre del empleado
                </label>
                <input
                  id="staff-nombre"
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={nombreStaff}
                  onChange={(e) => setNombreStaff(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="staff-pin"
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: theme.text.onLight,
                    marginBottom: "4px",
                  }}
                >
                  PIN (4 a 6 dígitos numéricos)
                </label>
                <input
                  id="staff-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Ej. 1234"
                  value={pinStaff}
                  onChange={(e) => setPinStaff(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                id="btn-crear-empleado"
                disabled={staffLoading}
                style={{
                  backgroundColor: theme.button.primaryBg,
                  color: theme.button.primaryText,
                  border: "none",
                  borderRadius: "8px",
                  padding: "11px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: staffLoading ? "not-allowed" : "pointer",
                  opacity: staffLoading ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {staffLoading ? "Guardando..." : "Crear empleado"}
              </button>
            </form>
          </div>

          {/* Lista de Empleados */}
          <div>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "14px",
                fontWeight: 600,
                color: theme.text.secondary,
              }}
            >
              Empleados activos
            </h3>

            {staffListLoading ? (
              <p style={{ color: theme.text.secondary, fontSize: "14px" }}>
                Cargando empleados...
              </p>
            ) : !staffData?.staff || staffData.staff.length === 0 ? (
              <p
                style={{
                  fontSize: "14px",
                  color: theme.text.secondary,
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                Todavía no registraste empleados. Creá el primero arriba para
                habilitarle el escáner.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "14px",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: `2px solid ${theme.colors.niebla}`,
                        color: theme.text.secondary,
                      }}
                    >
                      <th style={{ padding: "10px 12px" }}>Nombre</th>
                      <th style={{ padding: "10px 12px" }}>Fecha de alta</th>
                      <th style={{ padding: "10px 12px" }}>Seguridad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.staff.map((s) => (
                      <tr
                        key={s.id}
                        style={{
                          borderBottom: `1px solid ${theme.colors.niebla}`,
                        }}
                      >
                        <td
                          style={{
                            padding: "10px 12px",
                            fontWeight: 600,
                            color: theme.text.onLight,
                          }}
                        >
                          {s.nombre}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            color: theme.text.secondary,
                          }}
                        >
                          {new Date(s.createdAt).toLocaleDateString("es-AR")}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              backgroundColor: "#F1F5F9",
                              color: theme.text.secondary,
                              padding: "2px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            PIN encriptado con bcrypt
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* SECCIÓN: CATÁLOGO DE RECOMPENSAS (PR-09) */}
        <section
          id="seccion-recompensas"
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            marginBottom: "28px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "12px",
                backgroundColor: `${theme.accent.premium}1A`,
                color: theme.accent.premium,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Fidelización y Canjes
            </div>
            <h2
              style={{
                margin: "0 0 6px 0",
                fontSize: "20px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              Catálogo de recompensas
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: theme.text.secondary,
              }}
            >
              Definí los beneficios que tus clientes pueden canjear al acumular
              sellos en su tarjeta.
            </p>
          </div>

          {/* Formulario de alta / edición */}
          <form
            id="form-recompensa"
            onSubmit={handleGuardarRecompensa}
            style={{
              backgroundColor: theme.surface.light,
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "24px",
              border: `1px solid ${theme.colors.niebla}`,
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "15px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              {editingRewardId ? "Editar recompensa" : "Nueva recompensa"}
            </h3>

            {rewardError && (
              <div
                id="error-recompensa"
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#FEE2E2",
                  color: "#991B1B",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {rewardError}
              </div>
            )}

            {rewardSuccess && (
              <div
                id="success-recompensa"
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#DCFCE7",
                  color: "#166534",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {rewardSuccess}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "14px",
                marginBottom: "14px",
              }}
            >
              <div>
                <label
                  htmlFor="input-nombre-recompensa"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: theme.text.onLight,
                    marginBottom: "6px",
                  }}
                >
                  Nombre de la recompensa
                </label>
                <input
                  id="input-nombre-recompensa"
                  type="text"
                  placeholder="Ej. Café gratis, 20% de descuento"
                  value={rewardNombre}
                  onChange={(e) => setRewardNombre(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="input-sellos-recompensa"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: theme.text.onLight,
                    marginBottom: "6px",
                  }}
                >
                  {modoAcumulacion === "puntos_por_monto"
                    ? "Puntos requeridos"
                    : "Sellos requeridos"}
                </label>
                <input
                  id="input-sellos-recompensa"
                  type="number"
                  min={1}
                  placeholder={
                    modoAcumulacion === "puntos_por_monto"
                      ? "Ej. 200"
                      : "Ej. 10"
                  }
                  value={rewardCosto}
                  onChange={(e) =>
                    setRewardCosto(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="input-desc-recompensa"
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: theme.text.onLight,
                  marginBottom: "6px",
                }}
              >
                Descripción (opcional)
              </label>
              <input
                id="input-desc-recompensa"
                type="text"
                placeholder="Ej. Válido para espresso o café con leche en cualquier horario"
                value={rewardDescripcion}
                onChange={(e) => setRewardDescripcion(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="submit"
                id="btn-guardar-recompensa"
                disabled={rewardLoading}
                style={{
                  backgroundColor: theme.button.primaryBg,
                  color: theme.button.primaryText,
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: rewardLoading ? "not-allowed" : "pointer",
                  opacity: rewardLoading ? 0.7 : 1,
                }}
              >
                {rewardLoading
                  ? "Guardando..."
                  : editingRewardId
                    ? "Guardar cambios"
                    : "Crear recompensa"}
              </button>

              {editingRewardId && (
                <button
                  type="button"
                  id="btn-cancelar-edicion-recompensa"
                  onClick={handleCancelarEdicionRecompensa}
                  style={{
                    backgroundColor: "transparent",
                    color: theme.text.secondary,
                    border: `1px solid ${theme.colors.niebla}`,
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>

          {/* Tabla de recompensas */}
          <div style={{ overflowX: "auto" }}>
            {rewardsListLoading ? (
              <p style={{ color: theme.text.secondary, fontSize: "14px" }}>
                Cargando recompensas...
              </p>
            ) : rewardsList.length === 0 ? (
              <p
                id="sin-recompensas-msg"
                style={{
                  color: theme.text.secondary,
                  fontSize: "14px",
                  textAlign: "center",
                  padding: "20px",
                  backgroundColor: theme.surface.light,
                  borderRadius: "8px",
                }}
              >
                Aún no creaste recompensas. Creá la primera para motivar a tus
                clientes.
              </p>
            ) : (
              <table
                id="tabla-recompensas"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `2px solid ${theme.colors.niebla}`,
                      color: theme.text.secondary,
                    }}
                  >
                    <th style={{ padding: "10px 12px" }}>Nombre</th>
                    <th style={{ padding: "10px 12px" }}>Descripción</th>
                    <th style={{ padding: "10px 12px" }}>
                      {modoAcumulacion === "puntos_por_monto"
                        ? "Puntos"
                        : "Sellos"}
                    </th>
                    <th style={{ padding: "10px 12px" }}>Estado</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rewardsList.map((r) => (
                    <tr
                      key={r.id}
                      id={`fila-recompensa-${r.id}`}
                      style={{
                        borderBottom: `1px solid ${theme.colors.niebla}`,
                        opacity: r.activa ? 1 : 0.6,
                      }}
                    >
                      <td
                        style={{
                          padding: "12px",
                          fontWeight: 600,
                          color: theme.text.onLight,
                        }}
                      >
                        {r.nombre}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: theme.text.secondary,
                        }}
                      >
                        {r.descripcion || "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          fontWeight: 700,
                          color: theme.button.primaryBg,
                        }}
                      >
                        {r.costo ?? r.sellosRequeridos}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: "12px",
                            backgroundColor: r.activa ? "#DCFCE7" : "#F1F5F9",
                            color: r.activa ? "#166534" : theme.text.secondary,
                          }}
                        >
                          {r.activa ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <button
                            type="button"
                            id={`btn-editar-recompensa-${r.id}`}
                            onClick={() => handleEditarRecompensa(r)}
                            style={{
                              backgroundColor: "transparent",
                              color: theme.button.primaryBg,
                              border: "none",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            Editar
                          </button>
                          {r.activa && (
                            <button
                              type="button"
                              id={`btn-desactivar-recompensa-${r.id}`}
                              onClick={() => handleDesactivarRecompensa(r.id)}
                              style={{
                                backgroundColor: "transparent",
                                color: "#DC2626",
                                border: "none",
                                fontSize: "13px",
                                fontWeight: 600,
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                            >
                              Desactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* SECCIÓN: REGLAS DE ACUMULACIÓN (PR-09 / PR-13) */}
        <section
          id="seccion-reglas"
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            marginBottom: "28px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "12px",
                backgroundColor: "#FEF3C7",
                color: "#92400E",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Reglas del comercio
            </div>
            <h2
              style={{
                margin: "0 0 6px 0",
                fontSize: "20px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              Reglas de acumulación
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: theme.text.secondary,
              }}
            >
              Elegí cómo acumulan beneficios tus clientes y configurá las
              condiciones de sellado o puntos.
            </p>
          </div>

          {reglasError && (
            <div
              id="error-reglas"
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: "#FEE2E2",
                color: "#991B1B",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {reglasError}
            </div>
          )}

          {reglasSuccess && (
            <div
              id="success-reglas"
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: "#DCFCE7",
                color: "#166534",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {reglasSuccess}
            </div>
          )}

          {tieneMovimientos && (
            <div
              id="aviso-modo-bloqueado"
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                backgroundColor: "#FEF3C7",
                color: "#92400E",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "20px",
                lineHeight: 1.4,
              }}
            >
              Ya otorgaste sellos o puntos con el modo actual; para cambiarlo
              escribinos.
            </div>
          )}

          <form onSubmit={handleGuardarReglas}>
            {/* Selector de los 3 modos */}
            <div style={{ marginBottom: "24px" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: theme.text.onLight,
                  marginBottom: "12px",
                }}
              >
                Modelo de acumulación
              </span>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Modo 1: Sello por visita */}
                <label
                  htmlFor="modo-sello-por-visita"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: `1.5px solid ${
                      modoAcumulacion === "sello_por_visita"
                        ? theme.accent.premium
                        : "#E2E8F0"
                    }`,
                    backgroundColor:
                      modoAcumulacion === "sello_por_visita"
                        ? "#F0FDF4"
                        : "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    id="modo-sello-por-visita"
                    name="modoAcumulacion"
                    value="sello_por_visita"
                    checked={modoAcumulacion === "sello_por_visita"}
                    onChange={() => setModoAcumulacion("sello_por_visita")}
                    style={{ marginTop: "3px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: theme.text.onLight,
                        marginBottom: "2px",
                      }}
                    >
                      Sello por visita
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: theme.text.secondary,
                        lineHeight: 1.4,
                      }}
                    >
                      El cliente gana 1 sello cada vez que viene. Podés exigir
                      un monto mínimo de compra.
                    </div>

                    {modoAcumulacion === "sello_por_visita" && (
                      <div style={{ marginTop: "12px", maxWidth: "280px" }}>
                        <label
                          htmlFor="input-monto-minimo-sello"
                          style={{
                            display: "block",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: theme.text.onLight,
                            marginBottom: "4px",
                          }}
                        >
                          Monto mínimo de compra (opcional)
                        </label>
                        <input
                          id="input-monto-minimo-sello"
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Sin compra mínima"
                          value={montoMinimoSello}
                          onChange={(e) => setMontoMinimoSello(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            fontSize: "13px",
                            outline: "none",
                            backgroundColor: "#FFFFFF",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </label>

                {/* Modo 2: Sello cada $X */}
                <label
                  htmlFor="modo-sello-por-monto"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: `1.5px solid ${
                      modoAcumulacion === "sello_por_monto"
                        ? theme.accent.premium
                        : "#E2E8F0"
                    }`,
                    backgroundColor:
                      modoAcumulacion === "sello_por_monto"
                        ? "#F0FDF4"
                        : "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    id="modo-sello-por-monto"
                    name="modoAcumulacion"
                    value="sello_por_monto"
                    checked={modoAcumulacion === "sello_por_monto"}
                    onChange={() => setModoAcumulacion("sello_por_monto")}
                    style={{ marginTop: "3px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: theme.text.onLight,
                        marginBottom: "2px",
                      }}
                    >
                      Sello cada $X
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: theme.text.secondary,
                        lineHeight: 1.4,
                      }}
                    >
                      El cliente gana 1 sello por cada $X que gaste (ej. 1 sello
                      cada $500).
                    </div>

                    {modoAcumulacion === "sello_por_monto" && (
                      <div style={{ marginTop: "12px", maxWidth: "280px" }}>
                        <label
                          htmlFor="input-monto-por-sello"
                          style={{
                            display: "block",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: theme.text.onLight,
                            marginBottom: "4px",
                          }}
                        >
                          Monto por cada sello ($)
                        </label>
                        <input
                          id="input-monto-por-sello"
                          type="number"
                          step="any"
                          min="1"
                          placeholder="Ej. 500"
                          value={montoPorSello}
                          onChange={(e) => setMontoPorSello(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            fontSize: "13px",
                            outline: "none",
                            backgroundColor: "#FFFFFF",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </label>

                {/* Modo 3: Puntos por gasto */}
                <label
                  htmlFor="modo-puntos-por-monto"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: `1.5px solid ${
                      modoAcumulacion === "puntos_por_monto"
                        ? theme.accent.premium
                        : "#E2E8F0"
                    }`,
                    backgroundColor:
                      modoAcumulacion === "puntos_por_monto"
                        ? "#F0FDF4"
                        : "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    id="modo-puntos-por-monto"
                    name="modoAcumulacion"
                    value="puntos_por_monto"
                    checked={modoAcumulacion === "puntos_por_monto"}
                    onChange={() => setModoAcumulacion("puntos_por_monto")}
                    style={{ marginTop: "3px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: theme.text.onLight,
                        marginBottom: "2px",
                      }}
                    >
                      Puntos por gasto
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: theme.text.secondary,
                        lineHeight: 1.4,
                      }}
                    >
                      El cliente gana puntos por lo que gaste. Vos definís
                      cuántos puntos por cada $1 (ej. 1 punto por $1).
                    </div>

                    {modoAcumulacion === "puntos_por_monto" && (
                      <div style={{ marginTop: "12px", maxWidth: "280px" }}>
                        <label
                          htmlFor="input-puntos-por-unidad"
                          style={{
                            display: "block",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: theme.text.onLight,
                            marginBottom: "4px",
                          }}
                        >
                          Puntos por cada $1
                        </label>
                        <input
                          id="input-puntos-por-unidad"
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="Ej. 1"
                          value={puntosPorUnidad}
                          onChange={(e) => setPuntosPorUnidad(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            fontSize: "13px",
                            outline: "none",
                            backgroundColor: "#FFFFFF",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* maxSellosPorDia: solo aplica a modos 1 y 2 */}
            {modoAcumulacion !== "puntos_por_monto" ? (
              <div style={{ maxWidth: "340px", marginBottom: "20px" }}>
                <label
                  htmlFor="input-max-sellos-por-dia"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: theme.text.onLight,
                    marginBottom: "6px",
                  }}
                >
                  Máximo de sellos por cliente por día
                </label>
                <input
                  id="input-max-sellos-por-dia"
                  type="number"
                  min={1}
                  max={10}
                  value={maxSellosPorDia}
                  onChange={(e) => setMaxSellosPorDia(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: theme.text.secondary,
                    marginTop: "4px",
                  }}
                >
                  Valor por defecto: 1 sello diario. Rango permitido: 1 a 10.
                </span>
              </div>
            ) : (
              <div
                id="aviso-sin-tope-puntos"
                style={{
                  maxWidth: "520px",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  fontSize: "13px",
                  color: theme.text.secondary,
                  marginBottom: "20px",
                }}
              >
                En el modo de puntos por gasto no hay tope diario. El cliente
                acumula según el total gastado en cada compra.
              </div>
            )}

            {/* Bono de bienvenida (PR-15) */}
            <div style={{ maxWidth: "340px", marginBottom: "24px" }}>
              <label
                htmlFor="input-bono-bienvenida"
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: theme.text.onLight,
                  marginBottom: "6px",
                }}
              >
                {modoAcumulacion === "puntos_por_monto"
                  ? "Puntos de bienvenida"
                  : "Sellos de bienvenida"}
              </label>
              <input
                id="input-bono-bienvenida"
                type="number"
                min={0}
                max={1000}
                value={bonoBienvenida}
                onChange={(e) =>
                  setBonoBienvenida(
                    Math.max(0, parseInt(e.target.value, 10) || 0),
                  )
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <span
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: theme.text.secondary,
                  marginTop: "4px",
                }}
              >
                Unidades de regalo al registrarse (0 = desactivado).
              </span>
            </div>

            <button
              type="submit"
              id="btn-guardar-reglas"
              disabled={savingReglas}
              style={{
                backgroundColor: theme.button.primaryBg,
                color: theme.button.primaryText,
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: savingReglas ? "not-allowed" : "pointer",
                opacity: savingReglas ? 0.7 : 1,
              }}
            >
              {savingReglas ? "Guardando..." : "Guardar reglas"}
            </button>
          </form>
        </section>

        {/* Sección: Campañas (PR-10) */}
        <section
          id="seccion-campanias"
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            marginBottom: "28px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
          }}
        >
          <div style={{ marginBottom: "24px" }}>
            <h2
              style={{
                margin: "0 0 6px 0",
                fontSize: "18px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              Campañas (Push masivo)
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: theme.text.secondary,
              }}
            >
              Redactá un título y cuerpo para enviarlo como notificación push a
              todas tus tarjetas activas.
            </p>
          </div>

          {campaniaSuccess && (
            <div
              id="campania-success-msg"
              style={{
                backgroundColor: "#ECFDF5",
                color: "#065F46",
                padding: "12px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                marginBottom: "20px",
                border: "1px solid #A7F3D0",
              }}
            >
              {campaniaSuccess}
            </div>
          )}

          {campaniaError && (
            <div
              id="campania-error-msg"
              style={{
                backgroundColor: "#FEF2F2",
                color: "#991B1B",
                padding: "12px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                marginBottom: "20px",
                border: "1px solid #FECACA",
              }}
            >
              {campaniaError}
            </div>
          )}

          {/* Formulario de Campaña */}
          <form
            onSubmit={handlePreConfirmarCampania}
            style={{ marginBottom: "36px" }}
          >
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <label
                  htmlFor="input-campania-titulo"
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: theme.text.onLight,
                  }}
                >
                  Título de la campaña
                </label>
                <span
                  id="counter-campania-titulo"
                  style={{
                    fontSize: "12px",
                    color:
                      campaniaTitulo.length > 60
                        ? "#DC2626"
                        : theme.text.secondary,
                    fontWeight: campaniaTitulo.length > 60 ? 600 : 400,
                  }}
                >
                  {campaniaTitulo.length} / 60
                </span>
              </div>
              <input
                id="input-campania-titulo"
                type="text"
                value={campaniaTitulo}
                onChange={(e) => setCampaniaTitulo(e.target.value)}
                maxLength={60}
                placeholder="Ej. ¡Promo especial 2x1 este finde!"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.colors.niebla}`,
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <label
                  htmlFor="input-campania-cuerpo"
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: theme.text.onLight,
                  }}
                >
                  Mensaje / Cuerpo
                </label>
                <span
                  id="counter-campania-cuerpo"
                  style={{
                    fontSize: "12px",
                    color:
                      campaniaCuerpo.length > 280
                        ? "#DC2626"
                        : theme.text.secondary,
                    fontWeight: campaniaCuerpo.length > 280 ? 600 : 400,
                  }}
                >
                  {campaniaCuerpo.length} / 280
                </span>
              </div>
              <textarea
                id="input-campania-cuerpo"
                rows={3}
                value={campaniaCuerpo}
                onChange={(e) => setCampaniaCuerpo(e.target.value)}
                maxLength={280}
                placeholder="Ej. Mostrá tu tarjeta al pedir y sumá sellos dobles. ¡Válido hasta el domingo!"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.colors.niebla}`,
                  fontSize: "14px",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <button
              type="submit"
              id="btn-enviar-campania"
              disabled={campaniaLoading}
              style={{
                backgroundColor: theme.button.primaryBg,
                color: theme.button.primaryText,
                border: "none",
                borderRadius: "8px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: campaniaLoading ? "not-allowed" : "pointer",
                opacity: campaniaLoading ? 0.7 : 1,
              }}
            >
              Enviar a todas mis tarjetas
            </button>
          </form>

          {/* Historial de campañas */}
          <div
            style={{
              borderTop: `1px solid ${theme.colors.niebla}`,
              paddingTop: "24px",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "16px",
                fontWeight: 600,
                color: theme.text.onLight,
              }}
            >
              Historial de campañas enviadas
            </h3>

            {campaniasLoading ? (
              <p
                style={{
                  color: theme.text.secondary,
                  fontSize: "14px",
                  margin: 0,
                }}
              >
                Cargando historial de campañas...
              </p>
            ) : campaniasError ? (
              <p style={{ color: "#DC2626", fontSize: "14px", margin: 0 }}>
                No se pudo cargar el historial de campañas.
              </p>
            ) : campaniasList.length === 0 ? (
              <p
                id="empty-campanias"
                style={{
                  color: theme.text.secondary,
                  fontSize: "14px",
                  margin: 0,
                }}
              >
                Aún no has enviado ninguna campaña.
              </p>
            ) : (
              <div
                id="tabla-campanias"
                style={{
                  overflowX: "auto",
                  border: `1px solid ${theme.colors.niebla}`,
                  borderRadius: "8px",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "14px",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#F9FAFB",
                        borderBottom: `1px solid ${theme.colors.niebla}`,
                        color: theme.text.secondary,
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      <th style={{ padding: "12px 16px" }}>Título</th>
                      <th style={{ padding: "12px 16px" }}>Mensaje</th>
                      <th style={{ padding: "12px 16px" }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaniasList.map((campania) => (
                      <tr
                        key={campania.id}
                        style={{
                          borderBottom: `1px solid ${theme.colors.niebla}`,
                        }}
                      >
                        <td
                          style={{
                            padding: "12px 16px",
                            fontWeight: 600,
                            color: theme.text.onLight,
                          }}
                        >
                          {campania.titulo}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            color: theme.text.secondary,
                            maxWidth: "400px",
                          }}
                        >
                          {campania.cuerpo}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            color: theme.text.secondary,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(campania.createdAt).toLocaleString(
                            "es-AR",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Modal de confirmación de campaña */}
        {showConfirmCampania && (
          <div
            id="modal-confirmar-campania"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(10, 37, 64, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "420px",
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                padding: "28px 24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: theme.text.onLight,
                }}
              >
                ¿Confirmar envío de campaña?
              </h3>
              <p
                style={{
                  fontSize: "15px",
                  color: theme.text.onLight,
                  lineHeight: 1.5,
                  margin: "0 0 8px 0",
                  fontWeight: 500,
                }}
              >
                Se va a enviar a <strong>{activePassesCount}</strong>{" "}
                {activePassesCount === 1
                  ? "tarjeta activa"
                  : "tarjetas activas"}
                . ¿Confirmás?
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "#DC2626",
                  lineHeight: 1.4,
                  margin: "0 0 24px 0",
                  fontWeight: 500,
                }}
              >
                El envío masivo no se deshace.
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  id="btn-confirmar-envio-campania"
                  disabled={campaniaLoading}
                  onClick={handleEnviarCampania}
                  style={{
                    backgroundColor: theme.button.primaryBg,
                    color: theme.button.primaryText,
                    border: "none",
                    borderRadius: "10px",
                    padding: "14px",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: campaniaLoading ? "not-allowed" : "pointer",
                    opacity: campaniaLoading ? 0.7 : 1,
                  }}
                >
                  {campaniaLoading ? "Enviando push..." : "Confirmar y enviar"}
                </button>

                <button
                  type="button"
                  id="btn-cancelar-campania"
                  disabled={campaniaLoading}
                  onClick={() => setShowConfirmCampania(false)}
                  style={{
                    backgroundColor: "transparent",
                    color: theme.text.secondary,
                    border: `1px solid ${theme.colors.niebla}`,
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: campaniaLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN: ANALYTICS (PR-14) */}
        <section
          id="seccion-analytics"
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            marginBottom: "28px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
          }}
        >
          {/* Encabezado y controles de rango */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  backgroundColor: "#F0FDF4",
                  color: "#166534",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 700,
                  marginBottom: "8px",
                  border: "1px solid #BBF7D0",
                }}
              >
                Métricas & Actividad
              </div>
              <h2
                style={{
                  margin: "0 0 6px 0",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: theme.text.onLight,
                }}
              >
                Analytics del comercio
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: theme.text.secondary,
                }}
              >
                Métricas del programa, evolución diaria y registro unificado de
                actividad.
              </p>
            </div>

            {/* Presets y selector de fechas */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                alignItems: "flex-end",
              }}
            >
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  id="btn-preset-7d"
                  onClick={handlePreset7Dias}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.colors.niebla}`,
                    backgroundColor: "#F8FAFC",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: theme.colors.azulNoche,
                    cursor: "pointer",
                  }}
                >
                  Últimos 7 días
                </button>
                <button
                  type="button"
                  id="btn-preset-30d"
                  onClick={handlePreset30Dias}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.colors.niebla}`,
                    backgroundColor: "#F8FAFC",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: theme.colors.azulNoche,
                    cursor: "pointer",
                  }}
                >
                  Últimos 30 días
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: theme.text.secondary,
                }}
              >
                <label
                  htmlFor="input-analytics-desde"
                  style={{ fontWeight: 600 }}
                >
                  Desde:
                </label>
                <input
                  id="input-analytics-desde"
                  type="date"
                  value={analyticsDesde}
                  onChange={(e) => {
                    setAnalyticsDesde(e.target.value);
                    setAnalyticsPage(1);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.colors.niebla}`,
                    fontSize: "13px",
                    color: theme.text.onLight,
                  }}
                />
                <label
                  htmlFor="input-analytics-hasta"
                  style={{ fontWeight: 600 }}
                >
                  Hasta:
                </label>
                <input
                  id="input-analytics-hasta"
                  type="date"
                  value={analyticsHasta}
                  onChange={(e) => {
                    setAnalyticsHasta(e.target.value);
                    setAnalyticsPage(1);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.colors.niebla}`,
                    fontSize: "13px",
                    color: theme.text.onLight,
                  }}
                />
              </div>
            </div>
          </div>

          {/* KPI Cards (5 métricas con labels dinámicos) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <div
              id="kpi-miembros-activos"
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: "14px",
                padding: "18px 20px",
                border: "1px solid #E2E8F0",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: theme.text.secondary,
                  textTransform: "uppercase",
                }}
              >
                Miembros activos
              </span>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: theme.colors.azulNoche,
                  margin: "6px 0 2px 0",
                }}
              >
                {analyticsResumenLoading
                  ? "..."
                  : (analyticsResumen?.miembrosActivos ?? 0)}
              </div>
              <span style={{ fontSize: "12px", color: theme.text.secondary }}>
                Pases activos al momento
              </span>
            </div>

            <div
              id="kpi-nuevos-miembros"
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: "14px",
                padding: "18px 20px",
                border: "1px solid #E2E8F0",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: theme.text.secondary,
                  textTransform: "uppercase",
                }}
              >
                Nuevos miembros
              </span>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: theme.colors.azulNoche,
                  margin: "6px 0 2px 0",
                }}
              >
                {analyticsResumenLoading
                  ? "..."
                  : (analyticsResumen?.nuevosMiembros ?? 0)}
              </div>
              <span style={{ fontSize: "12px", color: theme.text.secondary }}>
                Pases creados en el rango
              </span>
            </div>

            <div
              id="kpi-unidades-otorgadas"
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: "14px",
                padding: "18px 20px",
                border: "1px solid #E2E8F0",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: theme.text.secondary,
                  textTransform: "uppercase",
                }}
              >
                {analyticsResumen?.unidad === "puntos"
                  ? "Puntos otorgados"
                  : "Sellos otorgados"}
              </span>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: "#00A68C",
                  margin: "6px 0 2px 0",
                }}
              >
                {analyticsResumenLoading
                  ? "..."
                  : (analyticsResumen?.unidadesOtorgadas ?? 0)}
              </div>
              <span style={{ fontSize: "12px", color: theme.text.secondary }}>
                {analyticsResumen?.unidad === "puntos"
                  ? "Total de puntos sumados"
                  : "Total de sellos otorgados"}
              </span>
            </div>

            <div
              id="kpi-canjes"
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: "14px",
                padding: "18px 20px",
                border: "1px solid #E2E8F0",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: theme.text.secondary,
                  textTransform: "uppercase",
                }}
              >
                Canjes realizados
              </span>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: "#8B5CF6",
                  margin: "6px 0 2px 0",
                }}
              >
                {analyticsResumenLoading
                  ? "..."
                  : (analyticsResumen?.canjesRealizados ?? 0)}
              </div>
              <span style={{ fontSize: "12px", color: theme.text.secondary }}>
                Recompensas canjeadas
              </span>
            </div>

            <div
              id="kpi-tasa-canje"
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: "14px",
                padding: "18px 20px",
                border: "1px solid #E2E8F0",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: theme.text.secondary,
                  textTransform: "uppercase",
                }}
              >
                Tasa de canje
              </span>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: "#F59E0B",
                  margin: "6px 0 2px 0",
                }}
              >
                {analyticsResumenLoading
                  ? "..."
                  : `${analyticsResumen?.tasaCanje ?? 0}%`}
              </div>
              <span style={{ fontSize: "12px", color: theme.text.secondary }}>
                Unidades canjeadas / otorgadas
              </span>
            </div>
          </div>

          {/* Gráfico de barras simple serieDiaria (14 barras con divs) */}
          <div
            style={{
              backgroundColor: "#F8FAFC",
              borderRadius: "14px",
              border: "1px solid #E2E8F0",
              padding: "20px 24px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: theme.text.onLight,
                  }}
                >
                  Evolución diaria de{" "}
                  {analyticsResumen?.unidad === "puntos" ? "puntos" : "sellos"}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: theme.text.secondary,
                  }}
                >
                  Últimos 14 días del rango seleccionado
                </p>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: theme.colors.azulNoche,
                  fontWeight: 600,
                  backgroundColor: "#FFFFFF",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                }}
              >
                {hoveredBarIndex !== null &&
                analyticsResumen?.serieDiaria[hoveredBarIndex]
                  ? `${analyticsResumen.serieDiaria[hoveredBarIndex].fecha}: ${analyticsResumen.serieDiaria[hoveredBarIndex].otorgadas} ${analyticsResumen.unidad}`
                  : "Pasa el mouse sobre las barras"}
              </div>
            </div>

            {/* Contenedor del gráfico */}
            <div
              id="grafico-serie-diaria"
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                height: "170px",
                paddingTop: "24px",
                paddingBottom: "8px",
                borderBottom: "1px solid #CBD5E1",
              }}
            >
              {(analyticsResumen?.serieDiaria ?? []).map((item, idx) => {
                const serieMax = Math.max(
                  ...(analyticsResumen?.serieDiaria.map((d) => d.otorgadas) ?? [
                    1,
                  ]),
                  1,
                );
                const barHeightPct = Math.round(
                  (item.otorgadas / serieMax) * 100,
                );
                const isHovered = hoveredBarIndex === idx;

                return (
                  <button
                    type="button"
                    key={item.fecha}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    onFocus={() => setHoveredBarIndex(idx)}
                    onBlur={() => setHoveredBarIndex(null)}
                    aria-label={`${item.fecha}: ${item.otorgadas} ${analyticsResumen?.unidad}`}
                    style={{
                      flex: 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      position: "relative",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    {isHovered && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: `calc(${Math.max(barHeightPct, 6)}% + 8px)`,
                          backgroundColor: theme.colors.azulNoche,
                          color: "#FFFFFF",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          zIndex: 10,
                          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                        }}
                      >
                        {item.otorgadas}
                      </div>
                    )}

                    <div
                      title={`${item.fecha}: ${item.otorgadas} ${analyticsResumen?.unidad}`}
                      style={{
                        width: "100%",
                        maxWidth: "36px",
                        height: `${Math.max(barHeightPct, 6)}%`,
                        background:
                          item.otorgadas > 0
                            ? isHovered
                              ? "#00D4B2"
                              : "linear-gradient(180deg, #00D4B2 0%, #0A2540 100%)"
                            : "#E2E8F0",
                        borderRadius: "4px 4px 0 0",
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Labels de fechas */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              {(analyticsResumen?.serieDiaria ?? []).map((item) => {
                const parts = item.fecha.split("-");
                const formattedDate = `${parts[2]}/${parts[1]}`;
                return (
                  <div
                    key={`lbl-${item.fecha}`}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: "10px",
                      fontWeight: 600,
                      color: theme.text.secondary,
                    }}
                  >
                    {formattedDate}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla de Actividad Unificada */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flex: 1,
                  maxWidth: "400px",
                }}
              >
                <input
                  id="input-analytics-q"
                  type="text"
                  placeholder="Buscar cliente por nombre..."
                  value={analyticsQuery}
                  onChange={(e) => {
                    setAnalyticsQuery(e.target.value);
                    setAnalyticsPage(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.colors.niebla}`,
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
                {analyticsQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setAnalyticsQuery("");
                      setAnalyticsPage(1);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: theme.text.secondary,
                      fontSize: "13px",
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <a
                id="btn-exportar-csv"
                href={`/api/analytics/actividad.csv?desde=${analyticsDesde}&hasta=${analyticsHasta}&q=${encodeURIComponent(
                  analyticsQuery,
                )}`}
                download="actividad.csv"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "#FFFFFF",
                  color: theme.colors.azulNoche,
                  border: `1px solid ${theme.colors.niebla}`,
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  cursor: "pointer",
                }}
              >
                <span>📥</span> Exportar CSV
              </a>
            </div>

            {actividadLoading ? (
              <p
                style={{
                  color: theme.text.secondary,
                  margin: "24px 0",
                  textAlign: "center",
                }}
              >
                Cargando registro de actividad...
              </p>
            ) : actividadError ? (
              <p
                style={{
                  color: "#DC2626",
                  margin: "24px 0",
                  textAlign: "center",
                }}
              >
                No se pudo cargar la actividad.
              </p>
            ) : (actividadData?.eventos.length ?? 0) === 0 ? (
              <div
                id="empty-actividad"
                style={{
                  padding: "36px 16px",
                  textAlign: "center",
                  backgroundColor: "#F8FAFC",
                  borderRadius: "12px",
                  border: "1px dashed #CBD5E1",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: theme.text.secondary,
                    fontWeight: 500,
                  }}
                >
                  No hay actividad registrada en este período.
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid #E2E8F0",
                    borderRadius: "12px",
                  }}
                >
                  <table
                    id="tabla-actividad"
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                      fontSize: "13px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#F8FAFC",
                          borderBottom: "1px solid #E2E8F0",
                          color: theme.text.secondary,
                        }}
                      >
                        <th style={{ padding: "12px 16px", fontWeight: 600 }}>
                          Fecha
                        </th>
                        <th style={{ padding: "12px 16px", fontWeight: 600 }}>
                          Tipo
                        </th>
                        <th style={{ padding: "12px 16px", fontWeight: 600 }}>
                          Cliente
                        </th>
                        <th style={{ padding: "12px 16px", fontWeight: 600 }}>
                          Empleado
                        </th>
                        <th style={{ padding: "12px 16px", fontWeight: 600 }}>
                          Detalle
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            fontWeight: 600,
                            textAlign: "right",
                          }}
                        >
                          Unidades
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {actividadData?.eventos.map((ev) => {
                        const tipoBadge =
                          ev.tipo === "emision" ? (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                backgroundColor: "#EFF6FF",
                                color: "#1D4ED8",
                                border: "1px solid #BFDBFE",
                              }}
                            >
                              Emisión
                            </span>
                          ) : ev.tipo === "otorgamiento" ? (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                backgroundColor: "#ECFDF5",
                                color: "#047857",
                                border: "1px solid #A7F3D0",
                              }}
                            >
                              Otorgamiento
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                backgroundColor: "#FEF3C7",
                                color: "#B45309",
                                border: "1px solid #FDE68A",
                              }}
                            >
                              Canje
                            </span>
                          );

                        return (
                          <tr
                            key={ev.id}
                            style={{
                              borderBottom: "1px solid #F1F5F9",
                            }}
                          >
                            <td
                              style={{
                                padding: "12px 16px",
                                color: theme.text.secondary,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {new Date(ev.fecha).toLocaleString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {tipoBadge}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                fontWeight: 600,
                                color: theme.text.onLight,
                              }}
                            >
                              {ev.cliente}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: theme.text.secondary,
                              }}
                            >
                              {ev.empleado || "-"}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: theme.text.onLight,
                              }}
                            >
                              {ev.detalle}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                fontWeight: 700,
                                textAlign: "right",
                                color:
                                  ev.tipo === "otorgamiento"
                                    ? "#059669"
                                    : ev.tipo === "canje"
                                      ? "#DC2626"
                                      : theme.text.secondary,
                              }}
                            >
                              {ev.tipo === "otorgamiento"
                                ? `+${ev.unidades}`
                                : ev.tipo === "canje"
                                  ? `-${ev.unidades}`
                                  : "0"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "16px",
                    fontSize: "13px",
                    color: theme.text.secondary,
                  }}
                >
                  <span id="actividad-paginacion-info">
                    Página {actividadData?.page ?? 1} de{" "}
                    {actividadData?.totalPages || 1} (
                    {actividadData?.total ?? 0} eventos)
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      id="btn-actividad-prev"
                      disabled={(actividadData?.page ?? 1) <= 1}
                      onClick={() =>
                        setAnalyticsPage((p) => Math.max(1, p - 1))
                      }
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: `1px solid ${theme.colors.niebla}`,
                        backgroundColor:
                          (actividadData?.page ?? 1) <= 1
                            ? "#F1F5F9"
                            : "#FFFFFF",
                        color:
                          (actividadData?.page ?? 1) <= 1
                            ? "#94A3B8"
                            : theme.colors.azulNoche,
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor:
                          (actividadData?.page ?? 1) <= 1
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      id="btn-actividad-next"
                      disabled={
                        (actividadData?.page ?? 1) >=
                        (actividadData?.totalPages || 1)
                      }
                      onClick={() => setAnalyticsPage((p) => p + 1)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: `1px solid ${theme.colors.niebla}`,
                        backgroundColor:
                          (actividadData?.page ?? 1) >=
                          (actividadData?.totalPages || 1)
                            ? "#F1F5F9"
                            : "#FFFFFF",
                        color:
                          (actividadData?.page ?? 1) >=
                          (actividadData?.totalPages || 1)
                            ? "#94A3B8"
                            : theme.colors.azulNoche,
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor:
                          (actividadData?.page ?? 1) >=
                          (actividadData?.totalPages || 1)
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Tabla: Tarjetas emitidas */}
        <section
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            marginBottom: "28px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "18px",
              fontWeight: 700,
              color: theme.text.onLight,
            }}
          >
            Tarjetas emitidas
          </h2>

          {pasesLoading ? (
            <p style={{ color: theme.text.secondary, margin: "16px 0" }}>
              Cargando tarjetas...
            </p>
          ) : pasesError ? (
            <p style={{ color: "#DC2626", margin: "16px 0" }}>
              No se pudieron cargar las tarjetas.
            </p>
          ) : pases.length === 0 ? (
            <div
              id="empty-pases"
              style={{
                padding: "32px 16px",
                textAlign: "center",
                backgroundColor: theme.surface.light,
                borderRadius: "12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: theme.text.secondary,
                }}
              >
                Todavía no emitiste tarjetas. Cuando emitas la primera, la vas a
                ver acá.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `2px solid ${theme.colors.niebla}`,
                      color: theme.text.secondary,
                    }}
                  >
                    <th style={{ padding: "12px 16px" }}>Cliente</th>
                    <th style={{ padding: "12px 16px" }}>Código</th>
                    <th style={{ padding: "12px 16px" }}>Estado</th>
                    <th style={{ padding: "12px 16px" }}>Sellos</th>
                    <th style={{ padding: "12px 16px" }}>Fecha de alta</th>
                  </tr>
                </thead>
                <tbody>
                  {pases.map((pase) => (
                    <tr
                      key={pase.id}
                      style={{
                        borderBottom: `1px solid ${theme.colors.niebla}`,
                      }}
                    >
                      <td
                        style={{
                          padding: "12px 16px",
                          fontWeight: 600,
                          color: theme.text.onLight,
                        }}
                      >
                        {pase.clienteNombre}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <code
                          style={{
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            color: theme.text.onLight,
                            backgroundColor: "#F1F5F9",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "13px",
                          }}
                        >
                          {pase.codigoCorto || "—"}
                        </code>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "12px",
                            fontWeight: 600,
                            backgroundColor:
                              pase.estado === "activa" ? "#DCFCE7" : "#FEE2E2",
                            color:
                              pase.estado === "activa" ? "#166534" : "#991B1B",
                            textTransform: "capitalize",
                          }}
                        >
                          {pase.estado}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>{pase.sellos}</td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: theme.text.secondary,
                        }}
                      >
                        {new Date(pase.createdAt).toLocaleDateString("es-AR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Tabla: Sellos recientes */}
        <section
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            padding: "28px 32px",
            boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.05)",
            border: `1px solid ${theme.colors.niebla}`,
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "18px",
              fontWeight: 700,
              color: theme.text.onLight,
            }}
          >
            Sellos recientes
          </h2>

          {sellosLoading ? (
            <p style={{ color: theme.text.secondary, margin: "16px 0" }}>
              Cargando sellos...
            </p>
          ) : sellosError ? (
            <p style={{ color: "#DC2626", margin: "16px 0" }}>
              No se pudieron cargar los sellos.
            </p>
          ) : sellos.length === 0 ? (
            <div
              id="empty-sellos"
              style={{
                padding: "32px 16px",
                textAlign: "center",
                backgroundColor: theme.surface.light,
                borderRadius: "12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: theme.text.secondary,
                }}
              >
                Todavía no se registraron sellos. Cuando un cliente sume sellos,
                van a aparecer acá.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `2px solid ${theme.colors.niebla}`,
                      color: theme.text.secondary,
                    }}
                  >
                    <th style={{ padding: "12px 16px" }}>Cliente</th>
                    <th style={{ padding: "12px 16px" }}>Otorgado por</th>
                    <th style={{ padding: "12px 16px" }}>Fecha y hora</th>
                  </tr>
                </thead>
                <tbody>
                  {sellos.map((sello) => (
                    <tr
                      key={sello.id}
                      style={{
                        borderBottom: `1px solid ${theme.colors.niebla}`,
                      }}
                    >
                      <td
                        style={{
                          padding: "12px 16px",
                          fontWeight: 600,
                          color: theme.text.onLight,
                        }}
                      >
                        {sello.clienteNombre}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: theme.text.onLight,
                        }}
                      >
                        {sello.otorgadoPor}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: theme.text.secondary,
                        }}
                      >
                        {new Date(sello.createdAt).toLocaleString("es-AR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
