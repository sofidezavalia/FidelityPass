import { theme } from "@fidelitypass/ui";
import Link from "next/link";
import { branding } from "../../lib/branding";

export default function TerminosPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: theme.surface.light,
        padding: "48px 20px",
        boxSizing: "border-box",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "40px 32px",
          boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.08)",
          border: `1px solid ${theme.colors.niebla}`,
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <Link
            href="/"
            style={{
              fontSize: "13px",
              color: theme.colors.celesteBandera,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Volver al inicio
          </Link>
        </div>

        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: "20px",
            backgroundColor: `${theme.accent.premium}1A`,
            color: theme.accent.premium,
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          Marco Legal
        </div>

        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: theme.text.onLight,
            margin: "0 0 8px 0",
          }}
        >
          Términos y Condiciones del Servicio
        </h1>

        <p
          style={{
            fontSize: "13px",
            color: theme.text.secondary,
            marginBottom: "32px",
          }}
        >
          Última actualización: 17 de octubre de 2026
        </p>

        <section
          style={{
            fontSize: "14px",
            lineHeight: 1.7,
            color: theme.text.onLight,
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: theme.colors.azulNoche,
                marginBottom: "8px",
              }}
            >
              1. Objeto del Servicio
            </h2>
            <p style={{ margin: 0 }}>
              {branding.nombreApp} provee una infraestructura de software que
              permite a comercios adheridos emitir, administrar y validar
              tarjetas de fidelidad digitales integradas con Google Wallet y
              Apple Wallet. El usuario final accede a las tarjetas digitales en
              su teléfono para acumular sellos o puntos por sus compras.
            </p>
          </div>

          <div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: theme.colors.azulNoche,
                marginBottom: "8px",
              }}
            >
              2. Emisión y Titularidad de la Tarjeta
            </h2>
            <p style={{ margin: 0 }}>
              La tarjeta digital se emite a nombre del cliente para verificación
              anti-fraude en el local. Cada comercio adherido es el exclusivo
              responsable de definir las reglas de acumulación, recompensas,
              premios y canjes ofrecidos en su programa de fidelidad.
            </p>
          </div>

          <div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: theme.colors.azulNoche,
                marginBottom: "8px",
              }}
            >
              3. Uso Adecuado
            </h2>
            <p style={{ margin: 0 }}>
              El usuario se compromete a proporcionar información verídica al
              solicitar su tarjeta y a no transferir, duplicar indebidamente ni
              adulterar los códigos de validación de los pases.
            </p>
          </div>

          <div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: theme.colors.azulNoche,
                marginBottom: "8px",
              }}
            >
              4. Contacto y Soporte
            </h2>
            <p style={{ margin: 0 }}>
              Para dudas sobre el funcionamiento de la plataforma o soporte
              técnico, podés contactarnos a{" "}
              <a
                href={`mailto:${branding.emailSoporte}`}
                style={{
                  color: theme.colors.celesteBandera,
                  fontWeight: 600,
                }}
              >
                {branding.emailSoporte}
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
