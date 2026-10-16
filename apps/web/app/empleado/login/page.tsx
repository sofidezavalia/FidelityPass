"use client";

import { theme } from "@fidelitypass/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

function EmpleadoLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const merchantId = searchParams.get("c");

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!merchantId) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.08)",
          border: `1px solid ${theme.colors.niebla}`,
        }}
      >
        <div
          style={{
            color: "#DC2626",
            fontSize: "15px",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          Enlace incompleto
        </div>
        <p
          style={{
            fontSize: "14px",
            color: theme.text.secondary,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Falta el código de tu comercio en este enlace. Pedile al dueño del
          local que te vuelva a compartir el link o código QR de acceso.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!pin || pin.length < 4) {
      setError("Ingresá tu PIN de al menos 4 dígitos");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "PIN incorrecto");
        setLoading(false);
        return;
      }

      router.push("/empleado/escanear");
    } catch {
      setError("Error de conexión. Intentá nuevamente.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "380px",
        backgroundColor: "#FFFFFF",
        borderRadius: "16px",
        padding: "36px 28px",
        boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.08)",
        border: `1px solid ${theme.colors.niebla}`,
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
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
          Acceso Empleados
        </div>
        <h1
          style={{
            margin: "0 0 6px 0",
            fontSize: "24px",
            fontWeight: 700,
            color: theme.text.onLight,
          }}
        >
          Ingresar PIN
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: theme.text.secondary,
          }}
        >
          Para escanear y sumar sellos a los clientes
        </p>
      </div>

      {error && (
        <div
          id="error-pin"
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            backgroundColor: "#FEE2E2",
            color: "#991B1B",
            fontSize: "13px",
            fontWeight: 600,
            textAlign: "center",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="pin-input"
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: theme.text.onLight,
              textAlign: "center",
            }}
          >
            Tu PIN personal
          </label>
          <input
            id="pin-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              border: `2px solid ${error ? "#EF4444" : "#CBD5E1"}`,
              fontSize: "28px",
              letterSpacing: "0.3em",
              textAlign: "center",
              color: theme.text.onLight,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        <button
          type="submit"
          id="btn-login-empleado"
          disabled={loading}
          style={{
            width: "100%",
            backgroundColor: theme.button.primaryBg,
            color: theme.button.primaryText,
            border: "none",
            borderRadius: "12px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: "0 4px 12px rgba(116, 172, 223, 0.35)",
          }}
        >
          {loading ? "Verificando..." : "Entrar al escáner"}
        </button>
      </form>
    </div>
  );
}

export default function EmpleadoLoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: theme.surface.light,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <Suspense
        fallback={
          <p style={{ color: theme.text.secondary }}>Cargando acceso...</p>
        }
      >
        <EmpleadoLoginForm />
      </Suspense>
    </main>
  );
}
