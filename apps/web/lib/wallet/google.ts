import crypto from "node:crypto";
import { colors } from "@fidelitypass/ui";
import jwt from "jsonwebtoken";
import { env } from "../env";

export function isGoogleWalletConfigured(): boolean {
  return Boolean(
    env.GOOGLE_WALLET_ISSUER_ID &&
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

/**
 * Gotcha documentado: La private key de Google Cloud se guarda con los \n literales
 * (tal cual viene en el JSON descargado) y en runtime se restauran los saltos reales
 * con .replace(/\\n/g, "\n") antes de firmar con RS256.
 */
function getFormattedPrivateKey(): string {
  const rawKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
  return rawKey.replace(/\\n/g, "\n");
}

export interface MerchantPassData {
  id: string;
  nombre: string;
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  logoUrl?: string | null;
}

export interface CustomerPassData {
  id: string;
  nombre: string;
}

export interface IssuedPassResult {
  saveUrl: string;
  googleWalletObjectId: string;
  serialNumber: string;
}

/**
 * Genera la definición de la clase (programa de fidelidad del comercio)
 */
export function getOrCreateClass(merchant: MerchantPassData) {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID || "ISSUER_UNSET";
  const classId = `${issuerId}.${merchant.id}`;
  const hexBackgroundColor = merchant.colorPrimario || colors.azulNoche;

  const loyaltyClass: Record<string, unknown> = {
    id: classId,
    issuerName: merchant.nombre,
    programName: `Fidelidad ${merchant.nombre}`,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor,
  };

  if (merchant.logoUrl) {
    loyaltyClass.programLogo = {
      sourceUri: {
        uri: merchant.logoUrl,
      },
    };
  }

  return loyaltyClass;
}

/**
 * Emite el pase para el cliente, generando el objeto y el JWT firmado para guardar en Google Wallet
 */
export function issuePass(
  merchant: MerchantPassData,
  customer: CustomerPassData,
): IssuedPassResult {
  if (!isGoogleWalletConfigured()) {
    throw new Error(
      "Google Wallet no está configurado en las variables de entorno",
    );
  }
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID;
  const serviceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!issuerId || !serviceAccountEmail) {
    throw new Error(
      "Google Wallet no está configurado en las variables de entorno",
    );
  }
  const privateKey = getFormattedPrivateKey();

  // 1. Generamos un serialNumber único con crypto.randomUUID()
  const serialNumber = crypto.randomUUID();
  const classId = `${issuerId}.${merchant.id}`;
  const googleWalletObjectId = `${issuerId}.${serialNumber}`;
  const hexBackgroundColor = merchant.colorPrimario || colors.azulNoche;

  const loyaltyClass: Record<string, unknown> = {
    id: classId,
    issuerName: merchant.nombre,
    programName: `Fidelidad ${merchant.nombre}`,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor,
  };

  if (merchant.logoUrl) {
    loyaltyClass.programLogo = {
      sourceUri: {
        uri: merchant.logoUrl,
      },
    };
  }

  const loyaltyObject = {
    id: googleWalletObjectId,
    classId: classId,
    state: "ACTIVE",
    // Anti-fraude: nombre del titular visible en el pase
    accountName: customer.nombre,
    accountId: customer.id,
    // Código de barras QR con valor = serialNumber (que escanea la PR-06)
    barcode: {
      type: "QR_CODE",
      value: serialNumber,
      alternateText: serialNumber,
    },
  };

  // 2. Armamos el payload JWT según la especificación oficial de Google Wallet Save Link
  const claims = {
    iss: serviceAccountEmail,
    aud: "google",
    typ: "savetojwt",
    iat: Math.floor(Date.now() / 1000),
    origins: [env.BETTER_AUTH_URL],
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
  };

  // 3. Firma con RS256 usando la clave privada de la Service Account
  const token = jwt.sign(claims, privateKey, { algorithm: "RS256" });
  const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

  return {
    saveUrl,
    googleWalletObjectId,
    serialNumber,
  };
}
