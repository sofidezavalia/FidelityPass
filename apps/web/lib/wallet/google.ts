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
  heroImageUrl?: string | null;
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
 * Formato exacto Google Wallet LoyaltyClass:
 * - programName = nombre del comercio
 * - hexBackgroundColor = colorPrimario del comercio (fallback al theme)
 * - programLogo = logoUrl del comercio
 * - heroImage opcional (banner 3:1)
 */
export function getOrCreateClass(merchant: MerchantPassData) {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID || "ISSUER_UNSET";
  const classId = `${issuerId}.${merchant.id}`;
  const hexBackgroundColor = merchant.colorPrimario || colors.azulNoche;

  const loyaltyClass: Record<string, unknown> = {
    id: classId,
    issuerName: merchant.nombre,
    programName: merchant.nombre,
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

  if (merchant.heroImageUrl) {
    loyaltyClass.heroImage = {
      sourceUri: {
        uri: merchant.heroImageUrl,
      },
    };
  }

  return loyaltyClass;
}

/**
 * Emite el pase para el cliente, generando el objeto y el JWT firmado para guardar en Google Wallet
 * Formato exacto Google Wallet LoyaltyObject:
 * - balance de puntos = "<n> sellos"
 * - nombre del titular visible = nombre del cliente (anti-fraude)
 * - filas extra (textModulesData) con la próxima recompensa (placeholder)
 * - barcode QR = serialNumber
 */
export function issuePass(
  merchant: MerchantPassData,
  customer: CustomerPassData,
  sellos = 0,
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

  const loyaltyClass = getOrCreateClass(merchant);

  const loyaltyObject: Record<string, unknown> = {
    id: googleWalletObjectId,
    classId: classId,
    state: "ACTIVE",
    // Anti-fraude: nombre del titular visible en el pase
    accountName: customer.nombre,
    accountId: customer.id,
    // Balance de puntos = "<n> sellos"
    loyaltyPoints: {
      label: "Sellos",
      balance: {
        string: `${sellos} sellos`,
      },
    },
    // Filas extra con la próxima recompensa (placeholder)
    textModulesData: [
      {
        id: "proxima_recompensa",
        header: "Próxima recompensa",
        body: "Consultá en el comercio tus recompensas disponibles",
      },
    ],
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

/**
 * Regenera el link de guardado para Google Wallet sin crear un nuevo serialNumber ni cambiar el objeto.
 * Se utiliza para reenviar el pase (por ejemplo, vía WhatsApp).
 */
export function regenerateSaveUrl(
  merchant: MerchantPassData,
  customer: CustomerPassData,
  pass: { googleWalletObjectId?: string | null; serialNumber: string },
  sellos = 0,
): string {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID || "ISSUER_UNSET";
  const serviceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const privateKey = getFormattedPrivateKey();

  const classId = `${issuerId}.${merchant.id}`;
  const loyaltyClass = getOrCreateClass(merchant);
  const googleWalletObjectId =
    pass.googleWalletObjectId || `${issuerId}.${pass.serialNumber}`;

  const loyaltyObject: Record<string, unknown> = {
    id: googleWalletObjectId,
    classId: classId,
    state: "ACTIVE",
    accountName: customer.nombre,
    accountId: customer.id,
    loyaltyPoints: {
      label: "Sellos",
      balance: {
        string: `${sellos} sellos`,
      },
    },
    textModulesData: [
      {
        id: "proxima_recompensa",
        header: "Próxima recompensa",
        body: "Consultá en el comercio tus recompensas disponibles",
      },
    ],
    barcode: {
      type: "QR_CODE",
      value: pass.serialNumber,
      alternateText: pass.serialNumber,
    },
  };

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

  const token = jwt.sign(claims, privateKey, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}
