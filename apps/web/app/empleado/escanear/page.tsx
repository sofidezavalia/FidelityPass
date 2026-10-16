"use client";

import { theme } from "@fidelitypass/ui";
import type { Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

interface RecompensaItem {
  id: string;
  nombre: string;
  descripcion?: string | null;
  sellosRequeridos: number;
  canjeable: boolean;
}

interface PassVerification {
  passId: string;
  clienteNombre: string;
  estado: string;
  sellosAcumulados: number;
  saldoDisponible: number;
  sellosHoy: number;
  maxSellosPorDia: number;
  yaSelladoHoy: boolean;
  recompensas: RecompensaItem[];
}

export default function EscanearPage() {
  const [step, setStep] = useState<
    "SCANNING" | "VERIFYING" | "SUCCESS_STAMP" | "SUCCESS_CANJE"
  >("SCANNING");
  const [scannedCode, setScannedCode] = useState("");
  const [verification, setVerification] = useState<PassVerification | null>(
    null,
  );
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [stampLoading, setStampLoading] = useState(false);
  const [canjeLoading, setCanjeLoading] = useState(false);

  // Modal de confirmación de canje
  const [canjeConfirm, setCanjeConfirm] = useState<RecompensaItem | null>(null);

  const [stampResult, setStampResult] = useState<{
    clienteNombre: string;
    sellosAcumulados: number;
    saldoDisponible?: number;
  } | null>(null);

  const [canjeResult, setCanjeResult] = useState<{
    clienteNombre: string;
    recompensa: string;
    saldoRestante: number;
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
        saldoDisponible: data.saldoDisponible,
      });
      setStep("SUCCESS_STAMP");
    } catch {
      setVerifyError("Error de conexión al guardar el sello.");
    } finally {
      setStampLoading(false);
    }
  };

  const handleConfirmarCanje = async () => {
    if (!scannedCode || !canjeConfirm) return;
    setCanjeLoading(true);

    try {
      const res = await fetch("/api/canjes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber: scannedCode,
          rewardId: canjeConfirm.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || "Error al procesar el canje");
        setCanjeLoading(false);
        setCanjeConfirm(null);
        return;
      }

      setCanjeResult({
        clienteNombre: verification?.clienteNombre || "Cliente",
        recompensa: data.recompensa,
        saldoRestante: data.saldoRestante,
      });
      setCanjeConfirm(null);
      setStep("SUCCESS_CANJE");
    } catch {
      setVerifyError("Error de conexión al procesar el canje.");
    } finally {
      setCanjeLoading(false);
    }
  };

  const handleReset = () => {
    setStep("SCANNING");
    setScannedCode("");
    setVerification(null);
    setVerifyError("");
    setStampResult(null);
    setCanjeResult(null);
    setCanjeConfirm(null);
  };

  const recompensasCanjeables =
    verification?.recompensas.filter((r) => r.canjeable) || [];
  const recompensasFuturas =
    verification?.recompensas.filter((r) => !r.canjeable) || [];

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
          maxWidth: "480px",
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

            <div
              style={{
                borderTop: `1px solid ${theme.colors.niebla}`,
                paddingTop: "16px",
                marginTop: "16px",
              }}
            >
              <label
                htmlFor="input-serial-manual"
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: theme.text.onLight,
                  marginBottom: "6px",
                }}
              >
                O ingresá el número de serie manual:
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="input-serial-manual"
                  type="text"
                  placeholder="Ej. PASS-12345678"
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
                  onClick={() => handleCodeDetected(scannedCode.trim())}
                  disabled={!scannedCode.trim()}
                  style={{
                    backgroundColor: theme.button.primaryBg,
                    color: theme.button.primaryText,
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: scannedCode.trim() ? "pointer" : "not-allowed",
                    opacity: scannedCode.trim() ? 1 : 0.6,
                  }}
                >
                  Verificar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PASO 2: VERIFICACIÓN VISUAL, SELLADO Y CANJE */}
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
                {/* Tarjeta de cliente */}
                <div
                  style={{
                    backgroundColor: theme.surface.light,
                    borderRadius: "12px",
                    padding: "20px",
                    textAlign: "center",
                    marginBottom: "16px",
                    border: `1px solid ${theme.colors.niebla}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
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
                      fontSize: "26px",
                      fontWeight: 800,
                      color: theme.text.onLight,
                      margin: "8px 0",
                    }}
                  >
                    {verification.clienteNombre}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: theme.text.secondary,
                    }}
                  >
                    Verificá que el nombre coincida con el cliente presente
                  </p>
                </div>

                {/* Saldo disponible y total */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      padding: "14px",
                      backgroundColor: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      borderRadius: "10px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#166534",
                        textTransform: "uppercase",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Saldo disponible
                    </span>
                    <strong
                      id="saldo-disponible-sellos"
                      style={{
                        fontSize: "22px",
                        fontWeight: 800,
                        color: "#15803D",
                      }}
                    >
                      {verification.saldoDisponible} sellos
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: "14px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: "10px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: theme.text.secondary,
                        textTransform: "uppercase",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Total acumulado
                    </span>
                    <strong
                      id="sellos-totales-acumulados"
                      style={{
                        fontSize: "22px",
                        fontWeight: 800,
                        color: theme.text.onLight,
                      }}
                    >
                      {verification.sellosAcumulados}
                    </strong>
                  </div>
                </div>

                {/* Advertencia si ya alcanzó límite de sellos diarios */}
                {verification.yaSelladoHoy && (
                  <div
                    id="aviso-limite-diario"
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#FEF3C7",
                      color: "#92400E",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "16px",
                      textAlign: "center",
                    }}
                  >
                    Límite diario alcanzado: ya se sumaron{" "}
                    {verification.sellosHoy} de {verification.maxSellosPorDia}{" "}
                    sello(s) permitido(s) hoy.
                  </div>
                )}

                {/* BOTÓN SUMAR SELLO */}
                <div style={{ marginBottom: "24px" }}>
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
                    {stampLoading ? "Sumando sello..." : "Sumar 1 sello"}
                  </button>
                </div>

                {/* SECCIÓN RECOMPENSAS CANJEABLES */}
                <div
                  id="seccion-recompensas-canjeables"
                  style={{
                    borderTop: `1px solid ${theme.colors.niebla}`,
                    paddingTop: "20px",
                    marginBottom: "20px",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: theme.text.onLight,
                    }}
                  >
                    Recompensas canjeables
                  </h3>

                  {recompensasCanjeables.length === 0 ? (
                    <div
                      style={{
                        padding: "16px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: "10px",
                        border: "1px dashed #CBD5E1",
                        textAlign: "center",
                        fontSize: "13px",
                        color: theme.text.secondary,
                      }}
                    >
                      {verification.recompensas.length === 0
                        ? "El comercio no tiene recompensas activas actualmente."
                        : `El cliente no tiene sellos suficientes para canjear en este momento (mínimo ${recompensasFuturas[0]?.sellosRequeridos || 0} sellos).`}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {recompensasCanjeables.map((r) => (
                        <div
                          key={r.id}
                          id={`item-canjeable-${r.id}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px",
                            backgroundColor: "#FFFFFF",
                            border: `1.5px solid ${theme.accent.premium}`,
                            borderRadius: "10px",
                            boxShadow: "0 2px 6px rgba(10, 37, 64, 0.04)",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "15px",
                                fontWeight: 700,
                                color: theme.text.onLight,
                              }}
                            >
                              {r.nombre}
                            </div>
                            {r.descripcion && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: theme.text.secondary,
                                  marginTop: "2px",
                                }}
                              >
                                {r.descripcion}
                              </div>
                            )}
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: theme.accent.premium,
                                marginTop: "4px",
                              }}
                            >
                              Cuesta {r.sellosRequeridos} sellos
                            </div>
                          </div>

                          <button
                            type="button"
                            id={`btn-canjear-${r.id}`}
                            onClick={() => setCanjeConfirm(r)}
                            style={{
                              backgroundColor: theme.colors.azulNoche,
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "8px",
                              padding: "9px 16px",
                              fontSize: "13px",
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Canjear
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recompensas no alcanzadas todavía */}
                  {recompensasFuturas.length > 0 && (
                    <div style={{ marginTop: "16px" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: theme.text.secondary,
                          display: "block",
                          marginBottom: "8px",
                        }}
                      >
                        Próximas recompensas del catálogo:
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {recompensasFuturas.map((r) => (
                          <div
                            key={r.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "10px 12px",
                              backgroundColor: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                              borderRadius: "8px",
                              opacity: 0.7,
                            }}
                          >
                            <div>
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: theme.text.onLight,
                                }}
                              >
                                {r.nombre}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: "12px",
                                color: theme.text.secondary,
                              }}
                            >
                              {r.sellosRequeridos} sellos (faltan{" "}
                              {r.sellosRequeridos -
                                verification.saldoDisponible}
                              )
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cancelar escaneo */}
                <button
                  type="button"
                  id="btn-cancelar-escaneo"
                  onClick={handleReset}
                  style={{
                    width: "100%",
                    backgroundColor: "transparent",
                    color: theme.text.secondary,
                    border: `1px solid ${theme.colors.niebla}`,
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
            ) : null}
          </div>
        )}

        {/* MODAL DE CONFIRMACIÓN DE CANJE */}
        {canjeConfirm && verification && (
          <div
            id="modal-confirmar-canje"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(10, 37, 64, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "380px",
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                padding: "28px 24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: theme.text.onLight,
                }}
              >
                ¿Confirmar canje?
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: theme.text.secondary,
                  lineHeight: 1.5,
                  margin: "0 0 20px 0",
                }}
              >
                Vas a canjear <strong>{canjeConfirm.nombre}</strong> por{" "}
                <strong>{canjeConfirm.sellosRequeridos} sellos</strong> para{" "}
                <strong>{verification.clienteNombre}</strong>.
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  id="btn-confirmar-canje"
                  disabled={canjeLoading}
                  onClick={handleConfirmarCanje}
                  style={{
                    backgroundColor: theme.colors.azulNoche,
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "10px",
                    padding: "14px",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: canjeLoading ? "not-allowed" : "pointer",
                    opacity: canjeLoading ? 0.7 : 1,
                  }}
                >
                  {canjeLoading ? "Procesando canje..." : "Confirmar canje"}
                </button>

                <button
                  type="button"
                  id="btn-cancelar-modal-canje"
                  disabled={canjeLoading}
                  onClick={() => setCanjeConfirm(null)}
                  style={{
                    backgroundColor: "transparent",
                    color: theme.text.secondary,
                    border: "none",
                    padding: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PASO 3A: ÉXITO SELLO */}
        {step === "SUCCESS_STAMP" && stampResult && (
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
              Saldo disponible:{" "}
              <strong>
                {stampResult.saldoDisponible ?? stampResult.sellosAcumulados}{" "}
                sellos
              </strong>
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

        {/* PASO 3B: ÉXITO CANJE */}
        {step === "SUCCESS_CANJE" && canjeResult && (
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
              🎁
            </div>
            <h2
              id="confirmacion-canje"
              style={{
                margin: "0 0 8px 0",
                fontSize: "24px",
                fontWeight: 700,
                color: theme.text.onLight,
              }}
            >
              ¡Canje exitoso!
            </h2>
            <p
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: theme.accent.premium,
                margin: "0 0 6px 0",
              }}
            >
              {canjeResult.recompensa}
            </p>
            <p
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: theme.text.onLight,
                marginBottom: "8px",
              }}
            >
              Cliente: {canjeResult.clienteNombre}
            </p>
            <p
              style={{
                fontSize: "14px",
                color: theme.text.secondary,
                marginBottom: "28px",
              }}
            >
              Saldo restante:{" "}
              <strong id="saldo-restante-canje">
                {canjeResult.saldoRestante} sellos
              </strong>
            </p>

            <button
              type="button"
              id="btn-escanear-siguiente-canje"
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
