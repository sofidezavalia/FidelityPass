import { theme } from "@fidelitypass/ui";

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
          FidelityPass — MVP en construcción
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

        <button
          type="button"
          id="btn-ejemplo"
          style={{
            backgroundColor: theme.button.primaryBg,
            color: theme.button.primaryText,
            border: "none",
            borderRadius: "10px",
            padding: "14px 28px",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(116, 172, 223, 0.35)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          Botón primario de ejemplo
        </button>
      </div>
    </main>
  );
}
