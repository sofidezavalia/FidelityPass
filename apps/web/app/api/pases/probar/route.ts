import crypto from "node:crypto";
import { customers, db, passes } from "@fidelitypass/db";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "../../../../lib/env";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";
import { generateUniqueCodigoCorto } from "../../../../lib/passes";
import { isAppleWalletConfigured } from "../../../../lib/wallet/apple";
import {
  isGoogleWalletConfigured,
  issuePass,
} from "../../../../lib/wallet/google";

/**
 * POST /api/pases/probar
 * Crea un pase de prueba con nombre de cliente "Pase de prueba", esPrueba = true,
 * con la personalización actual del comercio (incluyendo heroUrl si está presente).
 * Devuelve { saveUrl } o { downloadUrl } según la wallet configurada.
 */
export async function POST(request: NextRequest) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const googleConfigured = isGoogleWalletConfigured();
  const appleConfigured = isAppleWalletConfigured();

  if (!googleConfigured && !appleConfigured) {
    return NextResponse.json(
      { error: "Wallets no configurados" },
      { status: 503 },
    );
  }

  let requestedWallet: string | undefined;
  try {
    const body = (await request.json()) as { walletType?: string };
    requestedWallet = body?.walletType?.toLowerCase();
  } catch {
    // Body opcional
  }

  // 1. Crear cliente "Pase de prueba"
  const [customer] = await db
    .insert(customers)
    .values({
      nombre: "Pase de prueba",
    })
    .returning();

  if (!customer) {
    return NextResponse.json(
      { error: "Error al crear cliente de prueba" },
      { status: 500 },
    );
  }

  const codigoCorto = await generateUniqueCodigoCorto();
  const appleAuthToken = crypto.randomBytes(16).toString("hex");

  // Preferir Apple si se solicitó explícitamente y está configurado, o si solo Apple está configurado
  const shouldUseAppleOnly =
    (requestedWallet === "apple" && appleConfigured) ||
    (!googleConfigured && appleConfigured);

  if (shouldUseAppleOnly) {
    const serialNumber = crypto.randomUUID();
    const [newPass] = await db
      .insert(passes)
      .values({
        merchantId: merchant.id,
        customerId: customer.id,
        serialNumber,
        codigoCorto,
        appleAuthToken,
        estado: "activa",
        esPrueba: true,
      })
      .returning();

    if (!newPass) {
      return NextResponse.json(
        { error: "Error al crear el pase de prueba" },
        { status: 500 },
      );
    }

    const baseUrl = env.BETTER_AUTH_URL
      ? env.BETTER_AUTH_URL.replace(/\/$/, "")
      : "";
    const downloadUrl = `${baseUrl}/api/pases/apple/${serialNumber}/download`;

    return NextResponse.json(
      {
        ok: true,
        id: newPass.id,
        serialNumber,
        codigoCorto,
        downloadUrl,
      },
      { status: 201 },
    );
  }

  // Emisión Google Wallet (reutiliza issuePass con personalización y heroUrl)
  const { saveUrl, googleWalletObjectId, serialNumber } = issuePass(
    {
      id: merchant.id,
      nombre: merchant.nombre,
      logoUrl: merchant.logoUrl,
      heroImageUrl: merchant.heroUrl,
      colorPrimario: merchant.colorPrimario,
      colorSecundario: merchant.colorSecundario,
    },
    { id: customer.id, nombre: customer.nombre },
    0,
  );

  const [newPass] = await db
    .insert(passes)
    .values({
      merchantId: merchant.id,
      customerId: customer.id,
      serialNumber,
      codigoCorto,
      googleWalletObjectId,
      appleAuthToken,
      estado: "activa",
      esPrueba: true,
    })
    .returning();

  if (!newPass) {
    return NextResponse.json(
      { error: "Error al crear el pase de prueba" },
      { status: 500 },
    );
  }

  const baseUrl = env.BETTER_AUTH_URL
    ? env.BETTER_AUTH_URL.replace(/\/$/, "")
    : "";
  const downloadUrl = appleConfigured
    ? `${baseUrl}/api/pases/apple/${serialNumber}/download`
    : undefined;

  return NextResponse.json(
    {
      ok: true,
      id: newPass.id,
      serialNumber,
      codigoCorto,
      saveUrl,
      downloadUrl,
    },
    { status: 201 },
  );
}
