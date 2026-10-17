"use client";

import { theme } from "@fidelitypass/ui";
import type { Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

interface RecompensaItem {
  id: string;
  nombre: string;
  descripcion?: string | null;
  costo: number;
  sellosRequeridos?: number;
  canjeable: boolean;
}

interface PassVerification {
  passId: string;
  serialNumber?: string;
  codigoCorto?: string;
  clienteNombre: string;
  estado: string;
  modoAcumulacion: "sello_por_visita" | "sello_por_monto" | "puntos_por_monto";
  montoMinimoSello: number | null;
  montoPorSello: number | null;
  puntosPorUnidad: number | null;
  unidad: "sellos" | "puntos";
  totalAcumulado: number;
  sellosAcumulados: number;
  saldoDisponible: number;
  sellosHoy: number;
  maxSellosPorDia: number;
  yaSelladoHoy: boolean;
  pedirTicket?: boolean;
  maxUnidadesPorTicket?: number | null;
  recompensas: RecompensaItem[];
}

export default function EscanearPage() {
  const [step, setStep] = useState<
    "SCANNING" | "VERIFYING" | "SUCCESS_STAMP" | "SUCCESS_CANJE"
  >("SCANNING");
  const [activeTab, setActiveTab] = useState<"sumar" | "canjear">("sumar");
  const [scannedCode, setScannedCode] = useState("");
  const [verification, setVerification] = useState<PassVerification | null>(
    null,
  );
  const [montoCompra, setMontoCompra] = useState("");
  const [nroTicket, setNroTicket] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [stampLoading, setStampLoading] = useState(false);
  const [canjeLoading, setCanjeLoading] = useState(false);

  // Mini libro del turno (PR-15)
  const [miTurno, setMiTurno] = useState<{
    operaciones: number;
    unidadesOtorgadas: number;
    unidad: "sellos" | "puntos";
    ultimaOperacion: {
      cliente: string;
      haceCuanto: string;
      unidades: number;
    } | null;
  } | null>(null);

  // Ingreso manual por código corto de 6 caracteres (PR-15)
  const [mostrarCodigoManual, setMostrarCodigoManual] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");

  // Modal de confirmación de canje
  const [canjeConfirm, setCanjeConfirm] = useState<RecompensaItem | null>(null);

  const [stampResult, setStampResult] = useState<{
    clienteNombre: string;
    unidad?: "sellos" | "puntos";
    sellosAcumulados?: number;
    puntosAcumulados?: number;
    saldoDisponible?: number;
    unidadesOtorgadas?: number;
    mensajeTope?: string;
  } | null>(null);

  const [canjeResult, setCanjeResult] = useState<{
    clienteNombre: string;
    recompensa: string;
    unidad?: "sellos" | "puntos";
    saldoRestante: number;
  } | null>(null);

  const [cameraError, setCameraError] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const cargarMiTurno = useCallback(async () => {
    try {
      const res = await fetch("/api/empleado/mi-turno");
      if (res.ok) {
        const data = await res.json();
        setMiTurno(data);
      }
    } catch {
      // Ignorar error de carga de turno
    }
  }, []);

  useEffect(() => {
    cargarMiTurno();
  }, [cargarMiTurno]);

  const handleCodeDetected = useCallback(
    async (code: string, isShortCode = false) => {
      const trimmed = code.trim();
      setScannedCode(trimmed);
      setVerifyLoading(true);
      setVerifyError("");
      setMontoCompra("");
      setNroTicket("");
      setActiveTab("sumar");
      setStep("VERIFYING");

      try {
        const isCodigoCorto =
          isShortCode || (trimmed.length === 6 && !trimmed.startsWith("PASS-"));
        const param = isCodigoCorto
          ? `codigoCorto=${encodeURIComponent(trimmed.toUpperCase())}`
          : `serialNumber=${encodeURIComponent(trimmed)}`;

        const res = await fetch(`/api/sellos?${param}`);
        const data = await res.json();

        if (!res.ok) {
          setVerifyError(data.error || "Tarjeta no válida");
          setVerifyLoading(false);
          return;
        }

        setVerification({
          ...data,
          unidad:
            data.unidad ||
            (data.modoAcumulacion === "puntos_por_monto" ? "puntos" : "sellos"),
          recompensas: (data.recompensas || []).map((r: RecompensaItem) => ({
            ...r,
            costo: r.costo ?? r.sellosRequeridos,
            sellosRequeridos: r.costo ?? r.sellosRequeridos,
          })),
        });
      } catch {
        setVerifyError("Error al verificar la tarjeta. Revisá tu conexión.");
      } finally {
        setVerifyLoading(false);
      }
    },
    [],
  );

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

  // Cálculo en vivo del monto
  const numMonto = parseFloat(montoCompra);
  const hasValidMonto = !Number.isNaN(numMonto) && numMonto > 0;

  let previewText = "";
  let previewSubtext = "";
  let canSubmitStamp = true;

  if (verification) {
    if (verification.modoAcumulacion === "sello_por_visita") {
      if (verification.montoMinimoSello && verification.montoMinimoSello > 0) {
        if (!hasValidMonto || numMonto < verification.montoMinimoSello) {
          canSubmitStamp = false;
          previewSubtext = `Mínimo $${verification.montoMinimoSello} para ganar el sello`;
        } else {
          previewText = "Va a sumar 1 sello";
        }
      } else {
        previewText = "Va a sumar 1 sello";
      }
    } else if (verification.modoAcumulacion === "sello_por_monto") {
      const montoPorSello = verification.montoPorSello ?? 1;
      if (!hasValidMonto) {
        canSubmitStamp = false;
        previewSubtext = `1 sello cada $${montoPorSello}`;
      } else {
        const n = Math.floor(numMonto / montoPorSello);
        if (n <= 0) {
          canSubmitStamp = false;
          previewSubtext = `El monto no alcanza para ningún sello (mínimo $${montoPorSello})`;
        } else {
          const maxSellos = verification.maxSellosPorDia ?? 1;
          const sellosHoy = verification.sellosHoy ?? 0;
          if (sellosHoy + n > maxSellos) {
            const efectivo = Math.max(0, maxSellos - sellosHoy);
            previewText = `Va a sumar ${efectivo} sello${efectivo !== 1 ? "s" : ""} (límite diario alcanzado)`;
            if (efectivo <= 0) canSubmitStamp = false;
          } else {
            previewText = `Va a sumar ${n} sello${n !== 1 ? "s" : ""}`;
          }
        }
      }
    } else if (verification.modoAcumulacion === "puntos_por_monto") {
      const puntosPorUnidad = verification.puntosPorUnidad ?? 1;
      if (!hasValidMonto) {
        canSubmitStamp = false;
        previewSubtext = `${puntosPorUnidad} punto${puntosPorUnidad !== 1 ? "s" : ""} por cada $1`;
      } else {
        const p = Math.floor(numMonto * puntosPorUnidad);
        if (p <= 0) {
          canSubmitStamp = false;
          previewSubtext = "El monto no alcanza para sumar puntos";
        } else {
          previewText = `+${p} puntos`;
        }
      }
    }

    if (verification.pedirTicket && !nroTicket.trim()) {
      canSubmitStamp = false;
    }
  }

  const handleConfirmarSello = async () => {
    if (!scannedCode && !verification) return;
    setStampLoading(true);

    try {
      const payload: {
        serialNumber?: string;
        codigoCorto?: string;
        monto?: number;
        nroTicket?: string;
      } = {};

      if (verification?.serialNumber) {
        payload.serialNumber = verification.serialNumber;
      } else if (scannedCode.length === 6 && !scannedCode.startsWith("PASS-")) {
        payload.codigoCorto = scannedCode.toUpperCase();
      } else {
        payload.serialNumber = scannedCode;
      }

      if (montoCompra.trim()) {
        payload.monto = parseFloat(montoCompra);
      }

      if (nroTicket.trim()) {
        payload.nroTicket = nroTicket.trim();
      }

      const res = await fetch("/api/sellos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || "Error al otorgar sellos o puntos");
        setStampLoading(false);
        return;
      }

      setStampResult({
        clienteNombre: data.clienteNombre,
        unidad: data.unidad || verification?.unidad || "sellos",
        sellosAcumulados: data.sellosAcumulados,
        puntosAcumulados: data.puntosAcumulados,
        saldoDisponible: data.saldoDisponible,
        unidadesOtorgadas: data.unidadesOtorgadas,
        mensajeTope: data.mensajeTope,
      });
      setStep("SUCCESS_STAMP");
      cargarMiTurno();
    } catch {
      setVerifyError("Error de conexión al guardar.");
    } finally {
      setStampLoading(false);
    }
  };

  const handleConfirmarCanje = async () => {
    if ((!scannedCode && !verification) || !canjeConfirm) return;
    setCanjeLoading(true);

    try {
      const passSerial = verification?.serialNumber || scannedCode;
      const res = await fetch("/api/canjes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber: passSerial,
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
        unidad: data.unidad || verification?.unidad || "sellos",
        saldoRestante: data.saldoRestante,
      });
      setCanjeConfirm(null);
      setStep("SUCCESS_CANJE");
      cargarMiTurno();
    } catch {
      setVerifyError("Error de conexión al procesar el canje.");
    } finally {
      setCanjeLoading(false);
    }
  };

  const handleReset = () => {
    setStep("SCANNING");
    setScannedCode("");
    setCodigoManual("");
    setMontoCompra("");
    setNroTicket("");
    setActiveTab("sumar");
    setVerification(null);
    setVerifyError("");
    setStampResult(null);
    setCanjeResult(null);
    setCanjeConfirm(null);
    cargarMiTurno();
  };

  const recompensasCanjeables =
    verification?.recompensas.filter((r) => r.canjeable) || [];
  const recompensasFuturas =
    verification?.recompensas.filter((r) => !r.canjeable) || [];

  const usaMonto =
    verification?.modoAcumulacion === "sello_por_monto" ||
    verification?.modoAcumulacion === "puntos_por_monto" ||
    (verification?.modoAcumulacion === "sello_por_visita" &&
      !!verification?.montoMinimoSello);

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
            Terminal Empleado
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              color: theme.text.onLight,
            }}
          >
            Escanear Tarjeta de Fidelidad
          </h1>

          {/* Mini libro del turno (PR-15) */}
          {miTurno && (
            <div
              id="resumen-turno-compacto"
              style={{
                marginTop: "14px",
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "13px",
              }}
            >
              <span
                id="texto-resumen-turno"
                style={{
                  fontWeight: 700,
                  color: theme.text.onLight,
                }}
              >
                Hoy: {miTurno.operaciones} operaciones ·{" "}
                {miTurno.unidadesOtorgadas} {miTurno.unidad}
              </span>
              {miTurno.ultimaOperacion && (
                <span
                  id="ultima-operacion-turno"
                  style={{
                    fontSize: "11px",
                    color: theme.text.secondary,
                  }}
                  title={`Última: ${miTurno.ultimaOperacion.cliente} (${miTurno.ultimaOperacion.unidades} ${miTurno.unidad})`}
                >
                  Última: {miTurno.ultimaOperacion.cliente} (
                  {miTurno.ultimaOperacion.haceCuanto})
                </span>
              )}
            </div>
          )}
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

            {/* Link Ingresar código manual (PR-15) */}
            <div
              style={{
                textAlign: "center",
                marginTop: "12px",
                marginBottom: "8px",
              }}
            >
              <button
                type="button"
                id="link-ingresar-codigo-manual"
                onClick={() => setMostrarCodigoManual((prev) => !prev)}
                style={{
                  background: "none",
                  border: "none",
                  color: theme.colors.azulNoche,
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "6px 10px",
                }}
              >
                {mostrarCodigoManual
                  ? "Ocultar código manual"
                  : "Ingresar código manual"}
              </button>
            </div>

            {mostrarCodigoManual && (
              <div
                id="seccion-codigo-manual"
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  backgroundColor: "#F8FAFC",
                  border: "1.5px solid #CBD5E1",
                  marginBottom: "16px",
                }}
              >
                <label
                  htmlFor="input-codigo-manual"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: theme.text.onLight,
                    marginBottom: "6px",
                  }}
                >
                  Código de 6 caracteres del cliente:
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="input-codigo-manual"
                    type="text"
                    maxLength={6}
                    placeholder="Ej. K7X2PQ"
                    value={codigoManual}
                    onChange={(e) =>
                      setCodigoManual(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                      )
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        codigoManual.trim().length === 6
                      ) {
                        handleCodeDetected(
                          codigoManual.trim().toUpperCase(),
                          true,
                        );
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #94A3B8",
                      fontSize: "16px",
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      outline: "none",
                      backgroundColor: "#FFFFFF",
                    }}
                  />
                  <button
                    type="button"
                    id="btn-verificar-codigo-manual"
                    onClick={() =>
                      handleCodeDetected(
                        codigoManual.trim().toUpperCase(),
                        true,
                      )
                    }
                    disabled={codigoManual.trim().length !== 6}
                    style={{
                      backgroundColor: theme.button.primaryBg,
                      color: theme.button.primaryText,
                      border: "none",
                      borderRadius: "8px",
                      padding: "10px 18px",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor:
                        codigoManual.trim().length === 6
                          ? "pointer"
                          : "not-allowed",
                      opacity: codigoManual.trim().length === 6 ? 1 : 0.6,
                    }}
                  >
                    Verificar
                  </button>
                </div>
              </div>
            )}

            <div
              style={{
                borderTop: `1px solid ${theme.colors.niebla}`,
                paddingTop: "16px",
                marginTop: "12px",
              }}
            >
              <label
                htmlFor="input-serial-manual"
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: theme.text.secondary,
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                      margin: 0,
                      fontSize: "12px",
                      color: theme.text.secondary,
                    }}
                  >
                    {verification.codigoCorto && (
                      <span id="verificacion-codigo-corto">
                        Código:{" "}
                        <code
                          style={{
                            fontWeight: 700,
                            color: theme.accent.premium,
                            fontSize: "13px",
                            backgroundColor: "#F1F5F9",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {verification.codigoCorto}
                        </code>
                      </span>
                    )}
                    <span>
                      Serie:{" "}
                      <code style={{ fontWeight: 600 }}>
                        {verification.serialNumber || scannedCode}
                      </code>
                    </span>
                  </div>
                </div>

                {/* Saldos del cliente */}
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
                      {verification.saldoDisponible} {verification.unidad}
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
                      {verification.totalAcumulado ??
                        verification.sellosAcumulados}
                    </strong>
                  </div>
                </div>

                {/* PESTAÑAS: SUMAR Y CANJEAR (PR-17) */}
                <div
                  style={{
                    display: "flex",
                    borderBottom: "2px solid #E2E8F0",
                    marginBottom: "20px",
                    gap: "8px",
                  }}
                >
                  <button
                    type="button"
                    id="tab-sumar"
                    onClick={() => setActiveTab("sumar")}
                    style={{
                      flex: 1,
                      padding: "12px",
                      fontSize: "15px",
                      fontWeight: 700,
                      border: "none",
                      borderBottom:
                        activeTab === "sumar"
                          ? `3px solid ${theme.accent.premium}`
                          : "3px solid transparent",
                      backgroundColor: "transparent",
                      color:
                        activeTab === "sumar"
                          ? theme.colors.azulNoche
                          : theme.text.secondary,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Sumar {verification.unidad}
                  </button>
                  <button
                    type="button"
                    id="tab-canjear"
                    onClick={() => setActiveTab("canjear")}
                    style={{
                      flex: 1,
                      padding: "12px",
                      fontSize: "15px",
                      fontWeight: 700,
                      border: "none",
                      borderBottom:
                        activeTab === "canjear"
                          ? `3px solid ${theme.accent.premium}`
                          : "3px solid transparent",
                      backgroundColor: "transparent",
                      color:
                        activeTab === "canjear"
                          ? theme.colors.azulNoche
                          : theme.text.secondary,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <span>Canjear</span>
                    {recompensasCanjeables.length > 0 && (
                      <span
                        style={{
                          backgroundColor: "#16A34A",
                          color: "#FFFFFF",
                          fontSize: "11px",
                          padding: "2px 7px",
                          borderRadius: "10px",
                          fontWeight: 800,
                        }}
                      >
                        {recompensasCanjeables.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* CONTENIDO PESTAÑA SUMAR */}
                {activeTab === "sumar" && (
                  <div id="tab-contenido-sumar">
                    {/* Advertencia si ya alcanzó límite de sellos diarios */}
                    {verification.modoAcumulacion !== "puntos_por_monto" &&
                      verification.yaSelladoHoy && (
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
                          {verification.sellosHoy} de{" "}
                          {verification.maxSellosPorDia} sello(s) permitido(s)
                          hoy.
                        </div>
                      )}

                    {/* INPUT DE MONTO DE LA COMPRA (si el modo lo usa) */}
                    {usaMonto && (
                      <div
                        id="contenedor-monto-compra"
                        style={{
                          backgroundColor: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "12px",
                          padding: "16px",
                          marginBottom: "16px",
                        }}
                      >
                        <label
                          htmlFor="input-monto-compra"
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: theme.text.onLight,
                            marginBottom: "6px",
                          }}
                        >
                          Monto de la compra ($)
                        </label>
                        <input
                          id="input-monto-compra"
                          type="number"
                          step="any"
                          min={0}
                          placeholder="Ingresá el monto de la compra"
                          value={montoCompra}
                          onChange={(e) => setMontoCompra(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: "8px",
                            border: "1.5px solid #CBD5E1",
                            fontSize: "16px",
                            fontWeight: 600,
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />

                        {/* Aviso si modo 1 tiene mínimo configurado */}
                        {verification.modoAcumulacion === "sello_por_visita" &&
                          verification.montoMinimoSello && (
                            <div
                              id="aviso-monto-minimo"
                              style={{
                                marginTop: "8px",
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "#B45309",
                              }}
                            >
                              Mínimo ${verification.montoMinimoSello} para ganar
                              el sello
                            </div>
                          )}

                        {/* Preview en vivo */}
                        {previewText && (
                          <div
                            id="preview-calculo-acumulacion"
                            style={{
                              marginTop: "10px",
                              padding: "10px 12px",
                              borderRadius: "8px",
                              backgroundColor: "#EFF6FF",
                              border: "1px solid #BFDBFE",
                              color: "#1E40AF",
                              fontSize: "14px",
                              fontWeight: 700,
                              textAlign: "center",
                            }}
                          >
                            {previewText}
                          </div>
                        )}
                        {!previewText && previewSubtext && (
                          <div
                            id="subtext-calculo-acumulacion"
                            style={{
                              marginTop: "8px",
                              fontSize: "12px",
                              color: theme.text.secondary,
                            }}
                          >
                            {previewSubtext}
                          </div>
                        )}
                      </div>
                    )}

                    {/* INPUT Nº DE TICKET (PR-17: si pedirTicket está configurado) */}
                    {verification.pedirTicket && (
                      <div
                        id="contenedor-nro-ticket"
                        style={{
                          backgroundColor: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "12px",
                          padding: "16px",
                          marginBottom: "16px",
                        }}
                      >
                        <label
                          htmlFor="input-nro-ticket"
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: theme.text.onLight,
                            marginBottom: "6px",
                          }}
                        >
                          Nº de ticket{" "}
                          <span style={{ color: "#DC2626" }}>*</span>
                        </label>
                        <input
                          id="input-nro-ticket"
                          type="text"
                          placeholder="Ej. TKT-00123"
                          value={nroTicket}
                          onChange={(e) => setNroTicket(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: "8px",
                            border: "1.5px solid #CBD5E1",
                            fontSize: "15px",
                            fontWeight: 600,
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "12px",
                            color: theme.text.secondary,
                          }}
                        >
                          Campo obligatorio requerido por el comercio
                        </div>
                      </div>
                    )}

                    {/* BOTÓN SUMAR SELLOS / PUNTOS */}
                    <div style={{ marginBottom: "24px" }}>
                      <button
                        type="button"
                        id="btn-confirmar-sello"
                        disabled={
                          stampLoading ||
                          (verification.modoAcumulacion !==
                            "puntos_por_monto" &&
                            verification.yaSelladoHoy) ||
                          !canSubmitStamp
                        }
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
                            stampLoading ||
                            (verification.modoAcumulacion !==
                              "puntos_por_monto" &&
                              verification.yaSelladoHoy) ||
                            !canSubmitStamp
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            stampLoading ||
                            (verification.modoAcumulacion !==
                              "puntos_por_monto" &&
                              verification.yaSelladoHoy) ||
                            !canSubmitStamp
                              ? 0.6
                              : 1,
                          boxShadow: "0 4px 12px rgba(116, 172, 223, 0.35)",
                        }}
                      >
                        {stampLoading
                          ? "Procesando..."
                          : verification.modoAcumulacion === "puntos_por_monto"
                            ? previewText
                              ? `Acreditar (${previewText})`
                              : "Acreditar puntos"
                            : previewText
                              ? previewText
                              : "Sumar 1 sello"}
                      </button>
                    </div>
                  </div>
                )}

                {/* CONTENIDO PESTAÑA CANJEAR (PR-17) */}
                {activeTab === "canjear" && (
                  <div
                    id="tab-contenido-canjear"
                    style={{ marginBottom: "20px" }}
                  >
                    <h3
                      style={{
                        margin: "0 0 12px 0",
                        fontSize: "16px",
                        fontWeight: 700,
                        color: theme.text.onLight,
                      }}
                    >
                      Recompensas canjeables ({recompensasCanjeables.length})
                    </h3>

                    {recompensasCanjeables.length === 0 ? (
                      <div
                        id="aviso-sin-recompensas-canjeables"
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
                          : `El cliente no tiene ${verification.unidad} suficientes para canjear en este momento (mínimo ${recompensasFuturas[0]?.costo || 0} ${verification.unidad}).`}
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
                                Cuesta {r.costo} {verification.unidad}
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
                      <div style={{ marginTop: "20px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: theme.text.secondary,
                            display: "block",
                            marginBottom: "8px",
                          }}
                        >
                          Otras recompensas del catálogo:
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
                                {r.costo} {verification.unidad} (faltan{" "}
                                {r.costo - verification.saldoDisponible})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                <strong>
                  {canjeConfirm.costo} {verification.unidad}
                </strong>{" "}
                para <strong>{verification.clienteNombre}</strong>.
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

        {/* PASO 3A: ÉXITO SELLO / PUNTOS */}
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
              {stampResult.unidad === "puntos"
                ? "¡Puntos sumados!"
                : "¡Sello sumado!"}
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

            {stampResult.mensajeTope && (
              <div
                id="aviso-tope-alcanzado"
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#FEF3C7",
                  color: "#92400E",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "12px",
                }}
              >
                {stampResult.mensajeTope}
              </div>
            )}

            <p
              style={{
                fontSize: "14px",
                color: theme.text.secondary,
                marginBottom: "28px",
              }}
            >
              Saldo disponible:{" "}
              <strong>
                {stampResult.saldoDisponible ??
                  stampResult.puntosAcumulados ??
                  stampResult.sellosAcumulados}{" "}
                {stampResult.unidad ?? "sellos"}
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
                {canjeResult.saldoRestante} {canjeResult.unidad ?? "sellos"}
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
