import { mensajeSelloSchema } from "@fidelitypass/contracts";
import {
  customers,
  db,
  passes,
  pointsLedger,
  redemptions,
  stamps,
} from "@fidelitypass/db";
import { and, eq, gte } from "drizzle-orm";
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
  segmento?: string;
}

export interface SendBirthdayGreetingArgs {
  customerNombre: string;
  merchantNombre: string;
  googleWalletObjectId?: string | null;
  serialNumber?: string | null;
  bono?: number;
  unidad?: "sellos" | "puntos";
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
/**
 * Obtiene los pases objetivo según el segmento de audiencia configurado (PR-17).
 * Segmentos disponibles:
 * - 'todos': todos los pases activos del comercio.
 * - 'cumple_mes': clientes que cumplen años en el mes actual.
 * - 'inactivos_30': pases activos sin movimientos (sellos, puntos o canjes) en los últimos 30 días.
 * - 'con_canjes': pases activos con al menos un canje registrado (los más fieles).
 * - 'nuevos_30': pases activos creados en los últimos 30 días.
 */
export async function getTargetPassesForSegment(
  merchantId: string,
  segmento: string = "todos",
) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Consulta base: pases activos del comercio
  const baseActivePasses = await db
    .select({
      id: passes.id,
      serialNumber: passes.serialNumber,
      googleWalletObjectId: passes.googleWalletObjectId,
      customerId: passes.customerId,
      createdAt: passes.createdAt,
      fechaNacimiento: customers.fechaNacimiento,
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .where(and(eq(passes.merchantId, merchantId), eq(passes.estado, "activa")));

  if (segmento === "todos") {
    return baseActivePasses;
  }

  if (segmento === "nuevos_30") {
    return baseActivePasses.filter((p) => p.createdAt >= thirtyDaysAgo);
  }

  if (segmento === "cumple_mes") {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    return baseActivePasses.filter((p) => {
      if (!p.fechaNacimiento) return false;
      const m =
        typeof p.fechaNacimiento === "string"
          ? Number.parseInt(p.fechaNacimiento.split("-")[1] || "0", 10)
          : new Date(p.fechaNacimiento).getMonth() + 1;
      return m === currentMonth;
    });
  }

  if (segmento === "con_canjes") {
    const redPasses = await db
      .selectDistinct({ passId: redemptions.passId })
      .from(redemptions)
      .where(eq(redemptions.merchantId, merchantId));
    const passIdsWithCanjes = new Set(redPasses.map((r) => r.passId));
    return baseActivePasses.filter((p) => passIdsWithCanjes.has(p.id));
  }

  if (segmento === "inactivos_30") {
    // Pases activos SIN movimientos (sellos, puntos o canjes) en los últimos 30 días
    const recentStamps = await db
      .selectDistinct({ passId: stamps.passId })
      .from(stamps)
      .where(
        and(
          eq(stamps.merchantId, merchantId),
          gte(stamps.createdAt, thirtyDaysAgo),
        ),
      );
    const recentPoints = await db
      .selectDistinct({ passId: pointsLedger.passId })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.merchantId, merchantId),
          gte(pointsLedger.createdAt, thirtyDaysAgo),
        ),
      );
    const recentRedemptions = await db
      .selectDistinct({ passId: redemptions.passId })
      .from(redemptions)
      .where(
        and(
          eq(redemptions.merchantId, merchantId),
          gte(redemptions.createdAt, thirtyDaysAgo),
        ),
      );

    const activePassIdsWithRecentMovements = new Set<string>();
    for (const r of recentStamps) {
      if (r.passId) activePassIdsWithRecentMovements.add(r.passId);
    }
    for (const r of recentPoints) {
      if (r.passId) activePassIdsWithRecentMovements.add(r.passId);
    }
    for (const r of recentRedemptions) {
      if (r.passId) activePassIdsWithRecentMovements.add(r.passId);
    }

    return baseActivePasses.filter(
      (p) => !activePassIdsWithRecentMovements.has(p.id),
    );
  }

  return baseActivePasses;
}

/**
 * Envío de campaña push masiva a las tarjetas del segmento seleccionado (PR-10 / PR-16 / PR-17).
 * Fan-out independiente:
 * - Google Wallet: Messages API por objeto.
 * - Apple Wallet: push a los dispositivos registrados de cada pase.
 * Si falla un envío individual, se loguea y continúa con los restantes.
 * Devuelve el número de pases enviados y el alcance total.
 */
export async function sendCampaign(
  args: SendCampaignArgs,
): Promise<{ enviadas: number; alcance: number }> {
  const { merchantId, titulo, cuerpo, segmento = "todos" } = args;

  const targetPasses = await getTargetPassesForSegment(merchantId, segmento);

  const googleConfigured = isGoogleWalletConfigured();
  const appleConfigured = isAppleWalletConfigured();

  // Fan-out a las tarjetas del segmento
  for (const pass of targetPasses) {
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

  return { enviadas: targetPasses.length, alcance: targetPasses.length };
}

export interface SendSinglePassCampaignArgs {
  serialNumber?: string | null;
  googleWalletObjectId?: string | null;
  titulo: string;
  cuerpo: string;
}

/**
 * Envío de campaña de prueba a un único pase específico (Google y/o Apple).
 */
export async function sendSinglePassCampaign(
  args: SendSinglePassCampaignArgs,
): Promise<{ enviada: boolean }> {
  const { serialNumber, googleWalletObjectId, titulo, cuerpo } = args;

  const googleConfigured = isGoogleWalletConfigured();
  const appleConfigured = isAppleWalletConfigured();

  let sent = false;

  if (googleConfigured && googleWalletObjectId) {
    try {
      await sendGoogleWalletMessage(googleWalletObjectId, titulo, cuerpo);
      sent = true;
    } catch (err) {
      console.error(
        `[Campaña de prueba Google Wallet] Error al notificar objeto ${googleWalletObjectId}:`,
        err,
      );
    }
  }

  if (appleConfigured && serialNumber) {
    try {
      await pushStampsUpdate(serialNumber, 0, cuerpo);
      sent = true;
    } catch (err) {
      console.error(
        `[Campaña de prueba Apple Wallet] Error al notificar serie ${serialNumber}:`,
        err,
      );
    }
  }

  return { enviada: sent || (!googleConfigured && !appleConfigured) };
}

/**
 * Envía un push de saludo de cumpleaños al pase activo del cliente.
 * Si bono > 0:
 * "¡Feliz cumpleaños, {nombre}! 🎉 Te regalamos N sellos/puntos en {comercio}."
 * Si bono == 0:
 * "¡Feliz cumpleaños, {nombre}! 🎉 Pasá por {comercio} que tenemos algo para vos."
 */
export async function sendBirthdayGreeting(
  args: SendBirthdayGreetingArgs,
): Promise<void> {
  const {
    customerNombre,
    merchantNombre,
    googleWalletObjectId,
    serialNumber,
    bono = 0,
    unidad = "sellos",
  } = args;

  const unidadTexto =
    unidad === "puntos"
      ? bono === 1
        ? "punto"
        : "puntos"
      : bono === 1
        ? "sello"
        : "sellos";

  const pushMessage =
    bono > 0
      ? `¡Feliz cumpleaños, ${customerNombre}! 🎉 Te regalamos ${bono} ${unidadTexto} en ${merchantNombre}.`
      : `¡Feliz cumpleaños, ${customerNombre}! 🎉 Pasá por ${merchantNombre} que tenemos algo para vos.`;

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
