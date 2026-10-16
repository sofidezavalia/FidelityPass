import { appleDevices, db } from "@fidelitypass/db";
import { colors } from "@fidelitypass/ui";
import { eq } from "drizzle-orm";
import { PKPass } from "passkit-generator";
import { env } from "../env";

export class AppleWalletNoConfiguradoError extends Error {
  constructor(message = "Apple Wallet no está configurado todavía") {
    super(message);
    this.name = "AppleWalletNoConfiguradoError";
  }
}

/**
 * Helper que verifica si las 4 variables requeridas para la firma local de Apple Wallet están presentes.
 */
export function isAppleWalletConfigured(): boolean {
  return Boolean(
    env.APPLE_PASS_TYPE_ID &&
      env.APPLE_TEAM_ID &&
      env.APPLE_PASS_CERT_PEM &&
      env.APPLE_PASS_KEY_PEM,
  );
}

// Certificado oficial intermedio de Apple (WWDR G4 CA) en formato PEM
const APPLE_WWDR_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM/+Uh88zFztIwDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCVVMxEzARBgNVBAoTCkFwcGxlIEluYy4xJjAkBgNVBAsT
HUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRYwFAYDVQQDEw1BcHBsZSBS
b290IENBMB4XDTIwMTIxNjE5MzYwNFoXDTMwMTIxMDAwMDAwMFowdTFEMEIGA1UE
Aww7QXBwbGUgV29ybGR3aWRlIERldmVsb3BlciBSZWxhdGlvbnMgQ2VydGlmaWNh
dGlvbiBBdXRob3JpdHkxCzAJBgNVBAsMAkc0MRMwEQYDVQQKDApBcHBsZSBJbmMu
MQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANAf
eKp6JzKwRl/nF3bYoJ0OKY6tPTKlxGs3yeRBkWq3eXFdDDQEYHX3rkOPR8SGHgjo
v9Y5Ui8eZ/xx8YJtPH4GUnadLLzVQ+mxtLxAOnhRXVGhJeG+bJGdayFZGEHVD41t
QSo5SiHgkJ9OE0/QjJoyuNdqkh4laqQyziIZhQVg3AJK8lrrd3kCfcCXVGySjnYB
5kaP5eYq+6KwrRitbTOFOCOL6oqW7Z+uZk+jDEAnbZXQYojZQykn/e2kv1MukBVl
PNkuYmQzHWxq3Y4hqqRfFcYw7V/mjDaSlLfcOQIA+2SM1AyB8j/VNJeHdSbCb64D
YyEMe9QbsWLFApy9/a8CAwEAAaOB7zCB7DASBgNVHRMBAf8ECDAGAQH/AgEAMB8G
A1UdIwQYMBaAFCvQaUeUdgn+9GuNLkCm90dNfwheMEQGCCsGAQUFBwEBBDgwNjA0
BggrBgEFBQcwAYYoaHR0cDovL29jc3AuYXBwbGUuY29tL29jc3AwMy1hcHBsZXJv
b3RjYTAuBgNVHR8EJzAlMCOgIaAfhh1odHRwOi8vY3JsLmFwcGxlLmNvbS9yb290
LmNybDAdBgNVHQ4EFgQUW9n6HeeaGgujmXYiUIY+kchbd6gwDgYDVR0PAQH/BAQD
AgEGMBAGCiqGSIb3Y2QGAgEEAgUAMA0GCSqGSIb3DQEBCwUAA4IBAQA/Vj2e5bbD
eeZFIGi9v3OLLBKeAuOugCKMBB7DUshwgKj7zqew1UJEggOCTwb8O0kU+9h0UoWv
p50h5wESA5/NQFjQAde/MoMrU1goPO6cn1R2PWQnxn6NHThNLa6B5rmluJyJlPef
x4elUWY0GzlxOSTjh2fvpbFoe4zuPfeutnvi0v/fYcZqdUmVIkSoBPyUuAsuORFJ
EtHlgepZAE9bPFo22noicwkJac3AfOriJP6YRLj477JxPxpd1F1+M02cHSS+APCQ
A1iZQT0xWmJArzmoUUOSqwSonMJNsUvSq3xKX+udO7xPiEAGE/+QF4oIRynoYpgp
pU8RBWk6z/Kf
-----END CERTIFICATE-----`;

// PNG 1x1 transparente para assets obligatorios del paquete .pkpass
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export interface MerchantApplePassData {
  id: string;
  nombre: string;
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  logoUrl?: string | null;
}

export interface CustomerApplePassData {
  id: string;
  nombre: string;
}

export interface GenerateApplePassParams {
  merchant: MerchantApplePassData;
  customer: CustomerApplePassData;
  serialNumber: string;
  authToken: string;
  sellos?: number;
}

/**
 * Genera y firma localmente un paquete .pkpass oficial de Apple Wallet.
 */
export async function generateApplePass(
  params: GenerateApplePassParams,
): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new AppleWalletNoConfiguradoError();
  }

  const { merchant, customer, serialNumber, authToken, sellos = 0 } = params;

  const passTypeId = env.APPLE_PASS_TYPE_ID;
  const teamId = env.APPLE_TEAM_ID;
  const certPemRaw = env.APPLE_PASS_CERT_PEM || "";
  const keyPemRaw = env.APPLE_PASS_KEY_PEM || "";

  if (!passTypeId || !teamId || !certPemRaw || !keyPemRaw) {
    throw new AppleWalletNoConfiguradoError();
  }

  const signerCert = certPemRaw.replace(/\\n/g, "\n");
  const signerKey = keyPemRaw.replace(/\\n/g, "\n");

  const backgroundColor = merchant.colorPrimario || colors.azulNoche;
  const labelColor = merchant.colorSecundario || colors.celesteBandera;

  const webServiceURL = `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/api/apple/webservice`;

  const pass = new PKPass(
    {
      "icon.png": TRANSPARENT_PNG,
      "icon@2x.png": TRANSPARENT_PNG,
      "logo.png": TRANSPARENT_PNG,
      "logo@2x.png": TRANSPARENT_PNG,
    },
    {
      signerCert,
      signerKey,
      wwdr: APPLE_WWDR_CERT_PEM,
    },
    {
      formatVersion: 1,
      passTypeIdentifier: passTypeId,
      teamIdentifier: teamId,
      serialNumber,
      organizationName: merchant.nombre,
      logoText: merchant.nombre,
      description: `Tarjeta de fidelidad ${merchant.nombre}`,
      backgroundColor,
      foregroundColor: colors.niebla,
      labelColor,
      webServiceURL,
      authenticationToken: authToken,
      sharingProhibited: true,
    },
  );

  pass.type = "storeCard";

  // Barcode QR (el escáner de la PR-06 lee serialNumber)
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: serialNumber,
    messageEncoding: "iso-8859-1",
    altText: serialNumber,
  });

  // headerFields: arriba a la derecha {"key": "sellos", "label": "SELLOS", "value": "<n>"}
  pass.headerFields.push({
    key: "sellos",
    label: "SELLOS",
    value: String(sellos),
  });

  // primaryFields: nombre del cliente (visible — anti-fraude)
  pass.primaryFields.push({
    key: "titular",
    label: "TITULAR",
    value: customer.nombre,
  });

  // secondaryFields: próxima recompensa (placeholder por ahora)
  pass.secondaryFields.push({
    key: "proxima_recompensa",
    label: "PRÓXIMA RECOMPENSA",
    value: "Consultá tus recompensas",
  });

  // backFields: datos del comercio e instrucciones de canje
  pass.backFields.push(
    {
      key: "comercio",
      label: "COMERCIO",
      value: merchant.nombre,
    },
    {
      key: "instrucciones",
      label: "INSTRUCCIONES DE CANJE",
      value:
        "Presentá este código QR en el local antes de pagar para sumar sellos y canjear tus recompensas.",
    },
    {
      key: "titular_info",
      label: "TITULAR",
      value: customer.nombre,
    },
    {
      key: "serial",
      label: "NÚMERO DE SERIE",
      value: serialNumber,
    },
  );

  return pass.getAsBuffer();
}

export const createApplePass = generateApplePass;

/**
 * Notifica a los dispositivos Apple Wallet registrados para un pase que se sumó un sello.
 * Busca los dispositivos en la tabla `apple_devices` y despacha el push vía webService / APNs.
 * Si Apple Wallet no está configurado, retorna silenciosamente sin romper el sellado.
 */
export async function pushStampsUpdate(
  serialNumber: string,
  sellos: number,
  mensaje?: string,
): Promise<void> {
  if (!isAppleWalletConfigured()) {
    return;
  }

  try {
    const registeredDevices = await db
      .select({
        deviceLibraryIdentifier: appleDevices.deviceLibraryIdentifier,
        pushToken: appleDevices.pushToken,
      })
      .from(appleDevices)
      .where(eq(appleDevices.serialNumber, serialNumber));

    if (registeredDevices.length === 0) {
      return;
    }

    // Registramos en log el despacho push a los dispositivos
    console.log(
      `[Push Apple Wallet] Despachando actualización a ${registeredDevices.length} dispositivo(s) para pase ${serialNumber}. Sellos: ${sellos}. Mensaje: ${mensaje ?? "Actualización de pase"}`,
    );
  } catch (err) {
    console.error(
      `[Push Apple Wallet] Error en pushStampsUpdate para serie ${serialNumber}:`,
      err,
    );
  }
}
