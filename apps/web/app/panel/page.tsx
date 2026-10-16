"use client";

import type {
  DashboardResumen,
  PaseListItem,
  SelloListItem,
} from "@fidelitypass/contracts";
import { theme } from "@fidelitypass/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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

  // Estados locales para el alta de empleados
  const [nombreStaff, setNombreStaff] = useState("");
  const [pinStaff, setPinStaff] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [staffSuccess, setStaffSuccess] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
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
