"use client";

import { theme } from "@fidelitypass/ui";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

function NoQuieroPromosForm() {
  const searchParams = useSearchParams();
  const merchantIdParam = searchParams.get("c") || "";

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMensaje("");

    if (!email.trim()) {
      setError("Por favor ingresá tu email.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/no-quiero-promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId:
            merchantIdParam.trim() || "00000000-0000-0000-0000-000000000000",
          email: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ocurrió un error. Intentá nuevamente.");
      } else {
        setMensaje(data.mensaje || "Listo, no te vamos a mandar más promos.");
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
        maxWidth: "440px",
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
          backgroundColor: "#F1F5F9",
          color: theme.colors.azulNoche,
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: "16px",
        }}
      >
        Preferencias de Comunicación
      </div>

      <h1
        style={{
          fontSize: "22px",
          fontWeight: 700,
          color: theme.text.onLight,
          margin: "0 0 8px 0",
        }}
      >
        Cancelar suscripción a promociones
      </h1>

      <p
        style={{
          fontSize: "14px",
          color: theme.text.secondary,
          margin: "0 0 24px 0",
          lineHeight: 1.5,
        }}
      >
        Ingresá tu correo electrónico para dejar de recibir mensajes
        promocionales. Tus sellos y beneficios seguirán activos.
      </p>

      {mensaje ? (
        <div
          id="mensaje-exito"
          style={{
            backgroundColor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "12px",
            padding: "16px",
            color: "#166534",
            fontSize: "15px",
            fontWeight: 600,
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
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: "20px", textAlign: "left" }}>
            <label
              htmlFor="email-baja-promo"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                fontWeight: 600,
                color: theme.text.onLight,
              }}
            >
              Tu correo electrónico
            </label>
            <input
              id="email-baja-promo"
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

          <button
            type="submit"
            id="btn-confirmar-baja-promo"
            disabled={enviando}
            style={{
              width: "100%",
              backgroundColor: theme.colors.azulNoche,
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
            {enviando ? "Guardando..." : "No quiero recibir más promos"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function NoQuieroPromosPage() {
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
        <NoQuieroPromosForm />
      </Suspense>
    </main>
  );
}
