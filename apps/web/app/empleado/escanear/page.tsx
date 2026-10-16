"use client";

import { theme } from "@fidelitypass/ui";
import type { Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

interface PassVerification {
  passId: string;
  clienteNombre: string;
  estado: string;
  sellosAcumulados: number;
  yaSelladoHoy: boolean;
}

export default function EscanearPage() {
  const [step, setStep] = useState<"SCANNING" | "VERIFYING" | "SUCCESS">(
    "SCANNING",
  );
  const [scannedCode, setScannedCode] = useState("");
  const [verification, setVerification] = useState<PassVerification | null>(
    null,
  );
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [stampLoading, setStampLoading] = useState(false);
  const [stampResult, setStampResult] = useState<{
    clienteNombre: string;
    sellosAcumulados: number;
  } | null>(null);
  const [cameraError, setCameraError] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const handleCodeDetected = useCallback(async (code: string) => {
    setScannedCode(code);
    setVerifyLoading(true);
    setVerifyError("");
    setStep("VERIFYING");

    try {
      const res = await fetch(
        `/api/sellos?serialNumber=${encodeURIComponent(code)}`,
      );
      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || "Tarjeta no válida");
        setVerifyLoading(false);
        return;
      }

      setVerification(data);
    } catch {
      setVerifyError("Error al verificar la tarjeta. Revisá tu conexión.");
    } finally {
      setVerifyLoading(false);
    }
  }, []);

  // Iniciar el escáner de cámara
  useEffect(() => {
    let isMounted = true;

    if (step === "SCANNING") {
      setCameraError("");

      import("html5-qrcode")
        .then(({ Html5Qrcode }) => {
          if (!isMounted) return;

          const html5QrCode = new Html5Qrcode("qr-reader");
          scannerRef.current = html5QrCode;

          html5QrCode
            .start(
              { facingMode: "environment" },
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
              },
              (decodedText) => {
                if (html5QrCode.isScanning) {
                  html5QrCode
                    .stop()
                    .then(() => handleCodeDetected(decodedText))
                    .catch(() => handleCodeDetected(decodedText));
                }
              },
              () => {},
            )
            .catch((_err) => {
              if (isMounted) {
                setCameraError(
                  "No se pudo acceder a la cámara. Asegurate de otorgar permisos o usá el ingreso manual abajo.",
                );
              }
            });
        })
        .catch(() => {
          if (isMounted) {
            setCameraError("Error al cargar la librería de cámara.");
          }
        });
    }

    return () => {
      isMounted = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [step, handleCodeDetected]);

  const handleConfirmarSello = async () => {
    if (!scannedCode) return;
    setStampLoading(true);

    try {
      const res = await fetch("/api/sellos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber: scannedCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || "Error al otorgar el sello");
        setStampLoading(false);
        return;
      }

      setStampResult({
        clienteNombre: data.clienteNombre,
        sellosAcumulados: data.sellosAcumulados,
      });
      setStep("SUCCESS");
    } catch {
      setVerifyError("Error de conexión al guardar el sello.");
    } finally {
      setStampLoading(false);
    }
  };

  const handleReset = () => {
    setStep("SCANNING");
    setScannedCode("");
    setVerification(null);
    setVerifyError("");
    setStampResult(null);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: theme.surface.light,
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "28px 24px",
          boxShadow: "0 10px 25px -10px rgba(10, 37, 64, 0.08)",
          border: `1px solid ${theme.colors.niebla}`,
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
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
              marginBottom: "8px",
            }}
          >
            FidelityPass Empleado
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 700,
              color: theme.text.onLight,
            }}
          >
            Escanear Tarjeta de Fidelidad
          </h1>
        </div>

        {/* PASO 1: ESCANEAR */}
        {step === "SCANNING" && (
          <div>
            <div
              id="qr-reader"
              style={{
                width: "100%",
                borderRadius: "12px",
                overflow: "hidden",
                backgroundColor: "#000000",
                minHeight: "260px",
                marginBottom: "16px",
              }}
            />

            {cameraError && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: "#FEF3C7",
                  color: "#92400E",
                  fontSize: "13px",
                  marginBottom: "16px",
                  lineHeight: 1.4,
                }}
              >
                {cameraError}
              </div>
            )}

            {/* Ingreso manual para pruebas o contingencia */}
            <div
              style={{
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: `1px solid ${theme.colors.niebla}`,
              }}
            >
              <label
                htmlFor="manual-serial"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.text.secondary,
                  marginBottom: "6px",
                }}
              >
                ¿Cámara no disponible? Ingresá el código del QR:
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="manual-serial"
                  type="text"
                  placeholder="Ej. PASS-TEST-001"
                  value={scannedCode}
                  onChange={(e) => setScannedCode(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  id="btn-verificar-manual"
                  onClick={() => scannedCode && handleCodeDetected(scannedCode)}
                  style={{
                    backgroundColor: theme.button.primaryBg,
                    color: theme.button.primaryText,
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Verificar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PASO 2: VERIFICACIÓN VISUAL ANTI-FRAUDE */}
        {step === "VERIFYING" && (
          <div>
            {verifyLoading ? (
              <p
                style={{
                  textAlign: "center",
                  color: theme.text.secondary,
                  margin: "32px 0",
                }}
              >
                Verificando tarjeta...
              </p>
            ) : verifyError ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    backgroundColor: "#FEE2E2",
                    color: "#991B1B",
                    fontSize: "14px",
                    fontWeight: 600,
                    marginBottom: "20px",
                  }}
                >
                  {verifyError}
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    backgroundColor: theme.button.primaryBg,
                    color: theme.button.primaryText,
                    border: "none",
                    borderRadius: "8px",
                    padding: "12px 24px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Intentar de nuevo
                </button>
              </div>
            ) : verification ? (
              <div>
                <div
                  style={{
                    backgroundColor: theme.surface.light,
                    borderRadius: "12px",
                    padding: "24px 20px",
                    textAlign: "center",
                    marginBottom: "20px",
                    border: `1px solid ${theme.colors.niebla}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: theme.text.secondary,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 700,
                    }}
                  >
                    Verificación visual anti-fraude
                  </span>
                  <div
                    id="cliente-nombre-verificacion"
                    style={{
                      fontSize: "30px",
                      fontWeight: 800,
                      color: theme.text.onLight,
                      margin: "12px 0 8px 0",
                    }}
                  >
                    {verification.clienteNombre}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: theme.text.secondary,
                    }}
                  >
                    Verificá que el nombre coincida con el cliente presente
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    marginBottom: "20px",
                    fontSize: "14px",
                  }}
                >
                  <span style={{ color: theme.text.secondary }}>
                    Sellos acumulados:
                  </span>
                  <strong style={{ color: theme.text.onLight }}>
                    {verification.sellosAcumulados}
                  </strong>
                </div>

                {verification.yaSelladoHoy && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#FEF3C7",
                      color: "#92400E",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "20px",
                      textAlign: "center",
                    }}
                  >
                    Ya se sumó el sello de hoy para esta tarjeta. (Máximo 1
                    sello por día).
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    id="btn-confirmar-sello"
                    disabled={stampLoading || verification.yaSelladoHoy}
                    onClick={handleConfirmarSello}
                    style={{
                      width: "100%",
                      backgroundColor: theme.button.primaryBg,
                      color: theme.button.primaryText,
                      border: "none",
                      borderRadius: "10px",
                      padding: "14px",
                      fontSize: "15px",
                      fontWeight: 700,
                      cursor:
                        stampLoading || verification.yaSelladoHoy
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        stampLoading || verification.yaSelladoHoy ? 0.6 : 1,
                      boxShadow: "0 4px 12px rgba(116, 172, 223, 0.35)",
                    }}
                  >
                    {stampLoading ? "Guardando sello..." : "Confirmar sello"}
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      width: "100%",
                      backgroundColor: "transparent",
                      color: theme.text.secondary,
                      border: "1px solid #CBD5E1",
                      borderRadius: "10px",
                      padding: "12px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar y escanear otra
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* PASO 3: ÉXITO */}
        {step === "SUCCESS" && stampResult && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: "#DCFCE7",
                color: "#166534",
                fontSize: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontWeight: 700,
              }}
            >
              ✓
            </div>
            <h2
              id="confirmacion-sello-sumado"
              style={{
                margin: "0 0 8px 0",
                fontSize: "24px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              ¡Sello sumado!
            </h2>
            <p
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: theme.text.onLight,
                marginBottom: "4px",
              }}
            >
              {stampResult.clienteNombre}
            </p>
            <p
              style={{
                fontSize: "14px",
                color: theme.text.secondary,
                marginBottom: "28px",
              }}
            >
              Total acumulado:{" "}
              <strong>{stampResult.sellosAcumulados} sellos</strong>
            </p>

            <button
              type="button"
              id="btn-escanear-siguiente"
              onClick={handleReset}
              style={{
                width: "100%",
                backgroundColor: theme.button.primaryBg,
                color: theme.button.primaryText,
                border: "none",
                borderRadius: "10px",
                padding: "14px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(116, 172, 223, 0.35)",
              }}
            >
              Escanear siguiente tarjeta
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
