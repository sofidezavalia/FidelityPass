"use client";

import { registerMerchantSchema } from "@fidelitypass/contracts";
import { theme } from "@fidelitypass/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "../../lib/auth-client";

export default function RegistroPage() {
  const router = useRouter();
  const [nombreComercio, setNombreComercio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError("");

    // Validación client-side con Zod antes de tocar la DB
    const validation = registerMerchantSchema.safeParse({
      nombreComercio,
      email,
      password,
    });

    if (!validation.success) {
      const fieldErrors: { [key: string]: string } = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (field && !fieldErrors[field as string]) {
          fieldErrors[field as string] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await authClient.signUp.email({
        email: validation.data.email,
        password: validation.data.password,
        name: validation.data.nombreComercio,
      });

      if (error) {
        setServerError(error.message || "Error al registrar el comercio.");
        setLoading(false);
        return;
      }

      if (data) {
        router.push("/panel");
      }
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : "Error inesperado en el registro.",
      );
      setLoading(false);
    }
  };

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
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "36px 32px",
          boxShadow: "0 15px 35px -10px rgba(10, 37, 64, 0.08)",
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
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            FidelityPass
          </div>
          <h1
            style={{
              margin: "0 0 8px 0",
              fontSize: "24px",
              fontWeight: 700,
              color: theme.text.onLight,
            }}
          >
            Crear cuenta de comercio
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: theme.text.secondary,
            }}
          >
            Sumate al piloto de fidelidad en Tucumán
          </p>
        </div>

        {serverError && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "8px",
              backgroundColor: "#FEE2E2",
              color: "#991B1B",
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "20px",
            }}
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="nombreComercio"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                fontWeight: 600,
                color: theme.text.onLight,
              }}
            >
              Nombre del comercio
            </label>
            <input
              id="nombreComercio"
              type="text"
              value={nombreComercio}
              onChange={(e) => setNombreComercio(e.target.value)}
              placeholder="Ej. Café de la Plaza"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "8px",
                border: `1px solid ${errors.nombreComercio ? "#EF4444" : "#CBD5E1"}`,
                fontSize: "14px",
                color: theme.text.onLight,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            {errors.nombreComercio && (
              <span
                style={{
                  display: "block",
                  color: "#DC2626",
                  fontSize: "12px",
                  marginTop: "4px",
                  fontWeight: 500,
                }}
              >
                {errors.nombreComercio}
              </span>
            )}
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                fontWeight: 600,
                color: theme.text.onLight,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="comercio@ejemplo.com"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "8px",
                border: `1px solid ${errors.email ? "#EF4444" : "#CBD5E1"}`,
                fontSize: "14px",
                color: theme.text.onLight,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            {errors.email && (
              <span
                style={{
                  display: "block",
                  color: "#DC2626",
                  fontSize: "12px",
                  marginTop: "4px",
                  fontWeight: 500,
                }}
              >
                {errors.email}
              </span>
            )}
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                fontWeight: 600,
                color: theme.text.onLight,
              }}
            >
              Contraseña (mínimo 8 caracteres)
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "8px",
                border: `1px solid ${errors.password ? "#EF4444" : "#CBD5E1"}`,
                fontSize: "14px",
                color: theme.text.onLight,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            {errors.password && (
              <span
                style={{
                  display: "block",
                  color: "#DC2626",
                  fontSize: "12px",
                  marginTop: "4px",
                  fontWeight: 500,
                }}
              >
                {errors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            id="btn-registrarse"
            disabled={loading}
            style={{
              width: "100%",
              backgroundColor: theme.button.primaryBg,
              color: theme.button.primaryText,
              border: "none",
              borderRadius: "10px",
              padding: "13px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(116, 172, 223, 0.35)",
              transition: "transform 0.15s ease",
            }}
          >
            {loading ? "Registrando comercio..." : "Registrar comercio"}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: theme.text.secondary,
            }}
          >
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/login"
              style={{
                color: theme.colors.azulNoche,
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              Iniciá sesión acá
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
