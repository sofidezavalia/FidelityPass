"use client";

import { theme } from "@fidelitypass/ui";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";

export default function PanelPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  if (isPending) {
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
          Cargando panel...
        </p>
      </main>
    );
  }

  const nombre = session?.user?.name || "Comercio";

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
          maxWidth: "760px",
          margin: "0 auto",
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "36px 32px",
          boxShadow: "0 15px 35px -10px rgba(10, 37, 64, 0.08)",
          border: `1px solid ${theme.colors.niebla}`,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: `1px solid ${theme.colors.niebla}`,
            paddingBottom: "24px",
            marginBottom: "28px",
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
              Panel de {nombre}
            </h1>
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
              transition: "background-color 0.15s ease",
            }}
          >
            Cerrar sesión
          </button>
        </div>

        <div
          style={{
            backgroundColor: theme.surface.light,
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "28px",
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            <span
              style={{
                fontSize: "13px",
                color: theme.text.secondary,
                display: "block",
                marginBottom: "2px",
              }}
            >
              Plan actual
            </span>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: theme.accent.premium,
                textTransform: "capitalize",
              }}
            >
              Básico ($19.900 ARS/mes) — Piloto
            </span>
          </div>

          <div>
            <span
              style={{
                fontSize: "13px",
                color: theme.text.secondary,
                display: "block",
                marginBottom: "2px",
              }}
            >
              Email de contacto
            </span>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: theme.text.onLight,
              }}
            >
              {session?.user?.email}
            </span>
          </div>
        </div>

        <div
          style={{
            padding: "28px 24px",
            borderRadius: "12px",
            border: `1.5px dashed ${theme.colors.celesteBandera}`,
            textAlign: "center",
            backgroundColor: "#FFFFFF",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px 0",
              fontSize: "17px",
              fontWeight: 700,
              color: theme.text.onLight,
            }}
          >
            Programa de tarjetas de fidelidad
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              lineHeight: 1.5,
              color: theme.text.secondary,
              maxWidth: "520px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Tu comercio ya está registrado en Neon. En las próximas etapas
            activaremos la emisión de pases en Google Wallet y el sellado por
            QR.
          </p>
        </div>
      </div>
    </main>
  );
}
