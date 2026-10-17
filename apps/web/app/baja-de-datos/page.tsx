"use client";

import { theme } from "@fidelitypass/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";

function BajaDeDatosForm() {
  const searchParams = useSearchParams();
  const merchantIdParam = searchParams.get("c") || "";

  const [merchantId, setMerchantId] = useState(merchantIdParam);
  const [merchantName, setMerchantName] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (merchantIdParam) {
      fetch(`/api/pases/comercio?c=${encodeURIComponent(merchantIdParam)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.nombre) setMerchantName(data.nombre);
        })
        .catch(() => {});
    }
  }, [merchantIdParam]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMensaje("");

    if (!merchantId.trim()) {
      setError("Por favor especificá el identificador del comercio.");
      return;
    }

    if (!email.trim()) {
      setError("Por favor ingresá tu correo electrónico.");
      return;
    }

    if (!confirmado) {
      setError(
        "Por favor confirmá que deseás eliminar tus datos de forma permanente.",
      );
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/baja-de-datos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: merchantId.trim(),
          email: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ocurrió un error. Intentá nuevamente.");
      } else {
        setMensaje(data.mensaje || "Tus datos fueron eliminados.");
      }
    } catch {
      setError("Error de conexión. Intentá nuevamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "460px",
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: "16px",
        padding: "36px 28px",
        boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.08)",
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
          backgroundColor: "#FEE2E2",
          color: "#991B1B",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: "16px",
        }}
      >
        Derecho de Supresión (Ley 25.326)
      </div>

      <h1
        style={{
          fontSize: "22px",
          fontWeight: 700,
          color: theme.text.onLight,
          margin: "0 0 8px 0",
        }}
      >
        Solicitud de Baja de Datos
      </h1>

      <p
        style={{
          fontSize: "14px",
          color: theme.text.secondary,
          margin: "0 0 24px 0",
          lineHeight: 1.5,
        }}
      >
        Esta acción borrará de forma definitiva tu tarjeta, sellos, puntos
        acumulados, canjes y datos de contacto en{" "}
        {merchantName ? `"${merchantName}"` : "el comercio"}.
      </p>

      {mensaje ? (
        <div
          id="mensaje-exito-baja"
          style={{
            backgroundColor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "12px",
            padding: "18px",
            color: "#166534",
            fontSize: "16px",
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {mensaje}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                backgroundColor: "#FEE2E2",
                color: "#991B1B",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "16px",
                textAlign: "left",
              }}
            >
              {error}
            </div>
          )}

          {!merchantIdParam && (
            <div style={{ marginBottom: "16px", textAlign: "left" }}>
              <label
                htmlFor="merchant-id-input"
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: theme.text.onLight,
                }}
              >
                ID del Comercio
              </label>
              <input
                id="merchant-id-input"
                type="text"
                placeholder="UUID del comercio"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: "20px", textAlign: "left" }}>
            <label
              htmlFor="email-baja-datos"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                fontWeight: 600,
                color: theme.text.onLight,
              }}
            >
              Tu correo electrónico registrado
            </label>
            <input
              id="email-baja-datos"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            style={{
              marginBottom: "24px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              textAlign: "left",
            }}
          >
            <input
              id="checkbox-confirmar-baja"
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              style={{
                marginTop: "3px",
                width: "16px",
                height: "16px",
                accentColor: "#DC2626",
                cursor: "pointer",
              }}
            />
            <label
              htmlFor="checkbox-confirmar-baja"
              style={{
                fontSize: "13px",
                color: theme.text.secondary,
                lineHeight: 1.4,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              Comprendo que se eliminarán todos mis datos de forma permanente y
              perderé mis sellos o puntos acumulados.
            </label>
          </div>

          <button
            type="submit"
            id="btn-confirmar-baja-datos"
            disabled={enviando}
            style={{
              width: "100%",
              backgroundColor: "#DC2626",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              padding: "14px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: enviando ? "not-allowed" : "pointer",
              opacity: enviando ? 0.7 : 1,
            }}
          >
            {enviando ? "Eliminando..." : "Eliminar mis datos definitivamente"}
          </button>
        </form>
      )}

      <div style={{ marginTop: "24px" }}>
        <Link
          href="/privacidad"
          style={{
            fontSize: "13px",
            color: theme.text.secondary,
            textDecoration: "underline",
          }}
        >
          Consultar Política de Privacidad
        </Link>
      </div>
    </div>
  );
}

export default function BajaDeDatosPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: theme.surface.light,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <Suspense fallback={<div>Cargando...</div>}>
        <BajaDeDatosForm />
      </Suspense>
    </main>
  );
}
