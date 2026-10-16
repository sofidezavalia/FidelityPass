import { mensajeSelloSchema } from "@fidelitypass/contracts";
import { db, passes } from "@fidelitypass/db";
import { and, eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { isAppleWalletConfigured, pushStampsUpdate } from "./apple";
import { isGoogleWalletConfigured } from "./google";

export interface NotifyStampAddedArgs {
  merchantNombre: string;
  sellosAcumulados: number;
  googleWalletObjectId?: string | null;
  serialNumber?: string | null;
}

export interface SendCampaignArgs {
  merchantId: string;
  titulo: string;
  cuerpo: string;
}

export interface SendBirthdayGreetingArgs {
  customerNombre: string;
  merchantNombre: string;
  googleWalletObjectId?: string | null;
  serialNumber?: string | null;
}

/**
 * Obtiene un token OAuth2 de corta duración mediante JWT bearer assertion
 * para autenticarse contra la REST API de Google Wallet.
 */
async function getGoogleWalletAccessToken(): Promise<string> {
  const issuer = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const assertionClaims = {
    iss: issuer,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const assertion = jwt.sign(assertionClaims, privateKey, {
    algorithm: "RS256",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error al autenticar con Google OAuth (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Agrega un mensaje push transaccional a la tarjeta de Google Wallet
 * utilizando la Messages API de Google Wallet.
 */
async function sendGoogleWalletMessage(
  googleWalletObjectId: string,
  titulo: string,
  cuerpo: string,
): Promise<void> {
  const token = await getGoogleWalletAccessToken();

  const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(googleWalletObjectId)}/addMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        header: titulo,
        body: cuerpo,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error en Google Wallet Messages API (${response.status}): ${errorText}`,
    );
  }
}

/**
 * Notificación transaccional al sumar un sello en FidelityPass.
 *
 * Reglas de diseño:
 * 1. El texto se construye y valida en el servidor con los datos oficiales.
 * 2. Cada plataforma (Google y Apple) se intenta de forma independiente.
 * 3. Si la notificación falla o está en modo dormido, NUNCA revierte el sello ni lanza error.
 */
export async function notifyStampAdded(
  args: NotifyStampAddedArgs,
): Promise<void> {
  const {
    merchantNombre,
    sellosAcumulados,
    googleWalletObjectId,
    serialNumber,
  } = args;

  // 1. Armamos y validamos el mensaje en el servidor
  const mensaje = mensajeSelloSchema.parse({
    titulo: `¡Sello sumado en ${merchantNombre}!`,
    cuerpo: `¡Sello sumado en ${merchantNombre}! Llevás ${sellosAcumulados} sellos.`,
  });

  // 2. Google Wallet: si está configurado y el pase tiene id de Google Wallet
  if (isGoogleWalletConfigured() && googleWalletObjectId) {
    try {
      await sendGoogleWalletMessage(
        googleWalletObjectId,
        mensaje.titulo,
        mensaje.cuerpo,
      );
    } catch (err) {
      console.error(
        `[Push Google Wallet] Error al notificar objeto ${googleWalletObjectId}:`,
        err,
      );
    }
  }

  // 3. Apple Wallet: notifica a los dispositivos registrados en apple_devices
  if (serialNumber) {
    try {
      await pushStampsUpdate(serialNumber, sellosAcumulados, mensaje.cuerpo);
    } catch (err) {
      console.error(
        `[Push Apple Wallet] Error al notificar pase ${serialNumber}:`,
        err,
      );
    }
  }
}

/**
 * Envío de campaña push masiva a todas las tarjetas activas del comercio.
 * Fan-out independiente:
 * - Google Wallet: Messages API por objeto.
 * - Apple Wallet: push a los dispositivos registrados de cada pase.
 * Si falla un envío individual, se loguea y continúa con los restantes.
 * Devuelve el número de pases activos alcanzados.
 */
export async function sendCampaign(
  args: SendCampaignArgs,
): Promise<{ enviadas: number }> {
  const { merchantId, titulo, cuerpo } = args;

  // 1. Obtener todos los pases activos del comercio
  const activePasses = await db
    .select({
      id: passes.id,
      serialNumber: passes.serialNumber,
      googleWalletObjectId: passes.googleWalletObjectId,
    })
    .from(passes)
    .where(and(eq(passes.merchantId, merchantId), eq(passes.estado, "activa")));

  const googleConfigured = isGoogleWalletConfigured();
  const appleConfigured = isAppleWalletConfigured();

  // Fan-out a todas las tarjetas activas
  for (const pass of activePasses) {
    // Google Wallet Messages API
    if (googleConfigured && pass.googleWalletObjectId) {
      try {
        await sendGoogleWalletMessage(
          pass.googleWalletObjectId,
          titulo,
          cuerpo,
        );
      } catch (err) {
        console.error(
          `[Campaña Google Wallet] Error al notificar objeto ${pass.googleWalletObjectId}:`,
          err,
        );
      }
    }

    // Apple Wallet Push a dispositivos registrados
    if (appleConfigured && pass.serialNumber) {
      try {
        await pushStampsUpdate(pass.serialNumber, 0, cuerpo);
      } catch (err) {
        console.error(
          `[Campaña Apple Wallet] Error al notificar serie ${pass.serialNumber}:`,
          err,
        );
      }
    }
  }

  return { enviadas: activePasses.length };
}

/**
 * Envía un push de saludo de cumpleaños al pase activo del cliente.
 * Formato del mensaje:
 * "¡Feliz cumpleaños, {nombre}! 🎉 Pasá por {comercio} que tenemos algo para vos."
 * Patrón "integración dormida":
 * - Si ninguna plataforma está configurada, no envía nada y lo loguea (no falla).
 * - Si Google Wallet está configurada: Messages API por objeto.
 * - Si Apple Wallet está configurada: push APNs a los dispositivos registrados.
 */
export async function sendBirthdayGreeting(
  args: SendBirthdayGreetingArgs,
): Promise<void> {
  const { customerNombre, merchantNombre, googleWalletObjectId, serialNumber } =
    args;
  const pushMessage = `¡Feliz cumpleaños, ${customerNombre}! 🎉 Pasá por ${merchantNombre} que tenemos algo para vos.`;
  const titulo = `¡Feliz cumpleaños, ${customerNombre}! 🎉`;

  const googleConfigured = isGoogleWalletConfigured();
  const appleConfigured = isAppleWalletConfigured();

  if (!googleConfigured && !appleConfigured) {
    console.log(
      `[Cumpleaños] Plataformas de wallet no configuradas. Saludo no enviado a ${customerNombre} (modo dormido).`,
    );
    return;
  }

  // Google Wallet Messages API
  if (googleConfigured && googleWalletObjectId) {
    try {
      await sendGoogleWalletMessage(googleWalletObjectId, titulo, pushMessage);
    } catch (err) {
      console.error(
        `[Cumpleaños Google Wallet] Error al enviar saludo a objeto ${googleWalletObjectId}:`,
        err,
      );
    }
  }

  // Apple Wallet APNs push a dispositivos registrados
  if (appleConfigured && serialNumber) {
    try {
      await pushStampsUpdate(serialNumber, 0, pushMessage);
    } catch (err) {
      console.error(
        `[Cumpleaños Apple Wallet] Error al enviar saludo a serie ${serialNumber}:`,
        err,
      );
    }
  }
}
