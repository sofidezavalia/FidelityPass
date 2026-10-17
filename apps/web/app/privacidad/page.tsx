import { theme } from "@fidelitypass/ui";
import Link from "next/link";
import { branding } from "../../lib/branding";

export default function PrivacidadPage() {
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
          Protección de Datos
        </div>

        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: theme.text.onLight,
            margin: "0 0 8px 0",
          }}
        >
          Política de Privacidad
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
            gap: "24px",
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
              1. Responsable del Tratamiento y Contacto
            </h2>
            <p style={{ margin: 0 }}>
              {branding.nombreApp} actúa como encargado y facilitador del
              tratamiento de los datos de fidelización provistos voluntariamente
              por los usuarios. Para cualquier consulta sobre la privacidad de
              tus datos o para ejercer tus derechos legales, podés comunicarte
              con nuestro equipo de privacidad al correo electrónico:{" "}
              <a
                href={`mailto:${branding.emailPrivacidad}`}
                style={{
                  color: theme.colors.celesteBandera,
                  fontWeight: 600,
                }}
              >
                {branding.emailPrivacidad}
              </a>
              .
            </p>
          </div>

          <div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: theme.colors.azulNoche,
                marginBottom: "12px",
              }}
            >
              2. Finalidad del Tratamiento de Datos
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                  border: `1px solid ${theme.colors.niebla}`,
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", textAlign: "left" }}>
                    <th
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${theme.colors.niebla}`,
                        fontWeight: 700,
                        color: theme.colors.azulNoche,
                      }}
                    >
                      Dato Personal
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${theme.colors.niebla}`,
                        fontWeight: 700,
                        color: theme.colors.azulNoche,
                      }}
                    >
                      Finalidad Específica
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    style={{ borderBottom: `1px solid ${theme.colors.niebla}` }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        fontWeight: 600,
                        color: theme.text.onLight,
                      }}
                    >
                      Nombre y apellido
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: theme.text.onLight,
                      }}
                    >
                      Identificación visual en el frente de la tarjeta digital y
                      prevención de fraude en el local comercial.
                    </td>
                  </tr>
                  <tr
                    style={{ borderBottom: `1px solid ${theme.colors.niebla}` }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        fontWeight: 600,
                        color: theme.text.onLight,
                      }}
                    >
                      Correo electrónico (email)
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: theme.text.onLight,
                      }}
                    >
                      Identificación de la cuenta, deduplicación de tarjetas
                      para un mismo comercio y recuperación del pase.
                    </td>
                  </tr>
                  <tr
                    style={{ borderBottom: `1px solid ${theme.colors.niebla}` }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        fontWeight: 600,
                        color: theme.text.onLight,
                      }}
                    >
                      Fecha de nacimiento
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: theme.text.onLight,
                      }}
                    >
                      Saludo personalizado y acreditación automática del
                      beneficio de cumpleaños una vez al año.
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontWeight: 600,
                        color: theme.text.onLight,
                      }}
                    >
                      Teléfono / WhatsApp
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: theme.text.onLight,
                      }}
                    >
                      Envío del enlace de la tarjeta digital por WhatsApp a
                      solicitud del usuario y comunicaciones de promociones si
                      se brindó consentimiento expreso.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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
              3. Derechos del Usuario (Ley 25.326 de Protección de Datos
              Personales)
            </h2>
            <p style={{ margin: 0 }}>
              De conformidad con la Ley N° 25.326 de la República Argentina,
              tenés derecho a acceder en forma gratuita, rectificar, actualizar
              o suprimir tus datos personales almacenados en nuestros sistemas.
              Podés solicitar la supresión inmediata a través de nuestra página
              de{" "}
              <Link
                href="/baja-de-datos"
                style={{
                  color: theme.colors.celesteBandera,
                  fontWeight: 600,
                }}
              >
                Baja de Datos
              </Link>{" "}
              o escribiendo a{" "}
              <a
                href={`mailto:${branding.emailPrivacidad}`}
                style={{
                  color: theme.colors.celesteBandera,
                  fontWeight: 600,
                }}
              >
                {branding.emailPrivacidad}
              </a>
              .
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
              4. Alojamiento y Transferencia Internacional de Datos
            </h2>
            <p style={{ margin: 0 }}>
              Informamos a los usuarios que la infraestructura tecnológica, los
              servidores de aplicaciones y las bases de datos de la plataforma
              se encuentran alojados en centros de datos ubicados en los Estados
              Unidos de América (a través de los proveedores Vercel Inc. y Neon
              Database Inc.), implementando estrictos estándares de cifrado y
              seguridad de la información.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
