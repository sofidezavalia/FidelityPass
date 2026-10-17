import { theme } from "@fidelitypass/ui";
import Link from "next/link";
import { branding } from "../lib/branding";

export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: theme.surface.light,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "40px 32px",
          boxShadow: "0 20px 40px -15px rgba(10, 37, 64, 0.08)",
          border: `1px solid ${theme.colors.niebla}`,
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: "20px",
            backgroundColor: `${theme.accent.premium}1A`,
            color: theme.accent.premium,
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        >
          Piloto Tucumán
        </div>

        <h1
          style={{
            margin: "0 0 12px 0",
            fontSize: "26px",
            fontWeight: 700,
            lineHeight: 1.25,
            color: theme.text.onLight,
          }}
        >
          {branding.nombreApp}
        </h1>

        <p
          style={{
            margin: "0 0 28px 0",
            fontSize: "15px",
            lineHeight: 1.5,
            color: theme.text.secondary,
          }}
        >
          Tarjetas de fidelidad digitales para comercios. Sistema de diseño y
          tokens verificados.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <Link
            href="/registro"
            id="link-registro"
            style={{
              display: "block",
              backgroundColor: theme.button.primaryBg,
              color: theme.button.primaryText,
              textDecoration: "none",
              borderRadius: "10px",
              padding: "14px 28px",
              fontSize: "15px",
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(116, 172, 223, 0.35)",
            }}
          >
            Registrar comercio
          </Link>

          <Link
            href="/login"
            id="link-login"
            style={{
              display: "block",
              backgroundColor: "transparent",
              color: theme.text.onLight,
              textDecoration: "none",
              borderRadius: "10px",
              padding: "12px 28px",
              fontSize: "14px",
              fontWeight: 600,
              border: `1px solid #CBD5E1`,
            }}
          >
            Ingresar al panel
          </Link>
        </div>
      </div>
    </main>
  );
}
