"use client";

import {
  type DashboardResumen,
  type PaseListItem,
  personalizacionSchema,
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
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

            {/* Vista Previa en Vivo */}
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: theme.text.secondary,
                  marginBottom: "8px",
                }}
              >
                Vista previa en vivo
              </div>

              <div
                id="mock-tarjeta-preview"
                style={{
                  backgroundColor: colorPrimario || theme.colors.azulNoche,
                  borderRadius: "16px",
                  padding: "24px 20px",
                  boxShadow: "0 15px 30px -10px rgba(10, 37, 64, 0.25)",
                  color: theme.colors.niebla,
                  border: `2px solid ${colorSecundario || theme.colors.celesteBandera}`,
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: colorSecundario || theme.colors.celesteBandera,
                        fontWeight: 700,
                      }}
                    >
                      Tarjeta de Fidelidad
                    </span>
                    <h3
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                      }}
                    >
                      {nombreComercio}
                    </h3>
                  </div>

                  {logoUrl ? (
                    /* biome-ignore lint/performance/noImgElement: Previsualización de logo en panel */
                    <img
                      src={logoUrl}
                      alt="Logo del comercio"
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid rgba(255,255,255,0.2)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: colorSecundario || theme.colors.celesteBandera,
                      }}
                    >
                      LOGO
                    </div>
                  )}
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    marginBottom: "18px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(248, 250, 252, 0.7)",
                      marginBottom: "2px",
                    }}
                  >
                    TITULAR
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>
                    Sofía de Zavalía
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px dashed rgba(255,255,255,0.2)",
                    paddingTop: "14px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "rgba(248, 250, 252, 0.7)",
                      }}
                    >
                      BALANCE
                    </span>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: colorSecundario || theme.colors.celesteBandera,
                      }}
                    >
                      0 Sellos
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(255,255,255,0.15)",
                      fontSize: "11px",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  >
                    [ QR SCAN ]
                  </div>
                </div>
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
