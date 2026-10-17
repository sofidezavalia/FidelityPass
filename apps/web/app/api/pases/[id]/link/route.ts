import { customers, db, passes } from "@fidelitypass/db";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "../../../../../lib/env";
import { getAuthenticatedMerchant } from "../../../../../lib/get-authenticated-merchant";
import { isAppleWalletConfigured } from "../../../../../lib/wallet/apple";
import {
  isGoogleWalletConfigured,
  regenerateSaveUrl,
} from "../../../../../lib/wallet/google";

/**
 * GET /api/pases/[id]/link (sesión comercio)
 * Devuelve el link vigente del pase sin crear filas nuevas.
 * - Google Wallet: regenera el JWT sobre el objeto existente ({ saveUrl }).
 * - Apple Wallet: { downloadUrl }.
 * Verifica que el pase sea del comercio. Si la wallet no está configurada -> 503.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return (
      errorResponse ||
      NextResponse.json({ error: "No autorizado" }, { status: 401 })
    );
  }

  const { id } = await params;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    return NextResponse.json({ error: "ID de pase inválido" }, { status: 400 });
  }

  const googleConfigured = isGoogleWalletConfigured();
  const appleConfigured = isAppleWalletConfigured();

  if (!googleConfigured && !appleConfigured) {
    return NextResponse.json(
      { error: "Wallets no configurados" },
      { status: 503 },
    );
  }

  const [row] = await db
    .select({
      id: passes.id,
      merchantId: passes.merchantId,
      serialNumber: passes.serialNumber,
      codigoCorto: passes.codigoCorto,
      googleWalletObjectId: passes.googleWalletObjectId,
      appleAuthToken: passes.appleAuthToken,
      estado: passes.estado,
      customerId: customers.id,
      clienteNombre: customers.nombre,
      telefono: customers.telefono,
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .where(and(eq(passes.id, id), eq(passes.merchantId, merchant.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Pase no encontrado" }, { status: 404 });
  }

  let saveUrl: string | undefined;
  if (googleConfigured) {
    saveUrl = regenerateSaveUrl(
      {
        id: merchant.id,
        nombre: merchant.nombre,
        logoUrl: merchant.logoUrl,
        heroImageUrl: merchant.heroUrl,
        colorPrimario: merchant.colorPrimario,
        colorSecundario: merchant.colorSecundario,
      },
      {
        id: row.customerId,
        nombre: row.clienteNombre,
      },
      {
        googleWalletObjectId: row.googleWalletObjectId,
        serialNumber: row.serialNumber,
      },
    );
  }

  let downloadUrl: string | undefined;
  const baseUrl = env.BETTER_AUTH_URL
    ? env.BETTER_AUTH_URL.replace(/\/$/, "")
    : "";
  if (appleConfigured || row.appleAuthToken) {
    downloadUrl = `${baseUrl}/api/pases/apple/${row.serialNumber}/download`;
  }

  const link = saveUrl || downloadUrl || "";

  return NextResponse.json({
    ok: true,
    id: row.id,
    serialNumber: row.serialNumber,
    codigoCorto: row.codigoCorto,
    clienteNombre: row.clienteNombre,
    telefono: row.telefono,
    saveUrl,
    downloadUrl,
    link,
  });
}
