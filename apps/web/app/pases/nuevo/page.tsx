"use client";

import { emitirPaseSchema } from "@fidelitypass/contracts";
import { theme } from "@fidelitypass/ui";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function NuevoPaseForm() {
  const searchParams = useSearchParams();
  const merchantId = searchParams.get("c");

  const [merchantName, setMerchantName] = useState<string>("");
  const [fetchingMerchant, setFetchingMerchant] = useState(true);
  const [merchantNotFound, setMerchantNotFound] = useState(false);

  const [nombreCliente, setNombreCliente] = useState("");
  const [error, setError] = useState("");
  const [loadingWallet, setLoadingWallet] = useState<"google" | "apple" | null>(
    null,
  );

  useEffect(() => {
    if (!merchantId) {
      setFetchingMerchant(false);
      return;
    }

    fetch(`/api/pases/comercio?c=${encodeURIComponent(merchantId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Comercio no encontrado");
        return res.json();
      })
      .then((data) => {
        setMerchantName(data.nombre);
        setFetchingMerchant(false);
      })
      .catch(() => {
        setMerchantNotFound(true);
        setFetchingMerchant(false);
      });
  }, [merchantId]);

  if (!merchantId || merchantNotFound) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
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
            fontSize: "16px",
            fontWeight: 700,
            marginBottom: "12px",
          }}
        >
          Comercio no encontrado
        </div>
        <p
          style={{
            fontSize: "14px",
            color: theme.text.secondary,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          El código QR o enlace escaneado no corresponde a un comercio activo.
          Por favor consultá con el personal del local.
        </p>
      </div>
    );
  }

  if (fetchingMerchant) {
    return (
      <div
        style={{
          padding: "32px",
          textAlign: "center",
          color: theme.text.secondary,
          fontSize: "14px",
        }}
      >
        Cargando tarjeta de fidelidad...
      </div>
    );
  }

  const handleEmitirPase = async (walletType: "google" | "apple") => {
    setError("");

    // Validación previa con Zod en el cliente antes de llamar a la API
    const validation = emitirPaseSchema.safeParse({
      merchantId,
      nombreCliente: nombreCliente.trim(),
    });

    if (!validation.success) {
      setError(
        validation.error.issues[0]?.message || "Ingresá un nombre válido",
      );
      return;
    }

    setLoadingWallet(walletType);

    try {
      const endpoint =
        walletType === "google"
          ? "/api/pases/emitir"
          : "/api/pases/emitir-apple";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();

      if (res.status === 503) {
        setError(
          walletType === "google"
            ? "Google Wallet todavía no está habilitado para este comercio"
            : "Apple Wallet todavía no está habilitado para este comercio",
        );
        setLoadingWallet(null);
        return;
      }

      if (!res.ok) {
        setError(data.error || "No se pudo emitir la tarjeta.");
        setLoadingWallet(null);
        return;
      }

      // Redirección al link de Wallet correspondiente
      if (walletType === "google" && data.saveUrl) {
        window.location.href = data.saveUrl;
      } else if (walletType === "apple" && data.downloadUrl) {
        window.location.href = data.downloadUrl;
      }
    } catch {
      setError("Error de conexión al emitir la tarjeta. Intentá nuevamente.");
      setLoadingWallet(null);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        backgroundColor: "#FFFFFF",
        borderRadius: "16px",
        padding: "36px 28px",
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
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          Tarjeta Digital
        </div>

        <h1
          style={{
            margin: "0 0 6px 0",
            fontSize: "24px",
            fontWeight: 700,
            color: theme.text.onLight,
          }}
        >
          {merchantName}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: theme.text.secondary,
          }}
        >
          Guardá tu tarjeta de sellos en tu teléfono
        </p>
      </div>

      {error && (
        <div
          id="error-emision"
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            backgroundColor: "#FEE2E2",
            color: "#991B1B",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "20px",
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <div>
        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="nombre-cliente"
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: theme.text.onLight,
            }}
          >
            Tu nombre y apellido
          </label>
          <input
            id="nombre-cliente"
            type="text"
            placeholder="Ej. Sofía Gómez"
            value={nombreCliente}
            onChange={(e) => setNombreCliente(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "10px",
              border: `1px solid ${error ? "#EF4444" : "#CBD5E1"}`,
              fontSize: "15px",
              color: theme.text.onLight,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <span
            style={{
              display: "block",
              fontSize: "12px",
              color: theme.text.secondary,
              marginTop: "6px",
            }}
          >
            Aparecerá en el frente de tu tarjeta para verificar los sellos.
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Botón Google Wallet */}
          <button
            type="button"
            id="btn-guardar-google-wallet"
            onClick={() => handleEmitirPase("google")}
            disabled={loadingWallet !== null}
            style={{
              width: "100%",
              backgroundColor: theme.button.primaryBg,
              color: theme.button.primaryText,
              border: "none",
              borderRadius: "12px",
              padding: "15px 16px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loadingWallet !== null ? "not-allowed" : "pointer",
              opacity: loadingWallet !== null ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(116, 172, 223, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "transform 0.15s ease",
            }}
          >
            {loadingWallet === "google"
              ? "Generando tarjeta..."
              : "Guardar en Google Wallet"}
          </button>

          {/* Botón Apple Wallet */}
          <button
            type="button"
            id="btn-guardar-apple-wallet"
            onClick={() => handleEmitirPase("apple")}
            disabled={loadingWallet !== null}
            style={{
              width: "100%",
              backgroundColor: theme.colors.azulNoche,
              color: "#FFFFFF",
              border: "none",
              borderRadius: "12px",
              padding: "15px 16px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loadingWallet !== null ? "not-allowed" : "pointer",
              opacity: loadingWallet !== null ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(10, 37, 64, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "transform 0.15s ease",
            }}
          >
            {loadingWallet === "apple"
              ? "Generando pase..."
              : "Agregar a Apple Wallet"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NuevoPasePage() {
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
        fallback={<p style={{ color: theme.text.secondary }}>Cargando...</p>}
      >
        <NuevoPaseForm />
      </Suspense>
    </main>
  );
}
