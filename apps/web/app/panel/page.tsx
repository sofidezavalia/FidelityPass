"use client";

import type {
  DashboardResumen,
  PaseListItem,
  SelloListItem,
} from "@fidelitypass/contracts";
import { theme } from "@fidelitypass/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export default function PanelPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

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

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
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
