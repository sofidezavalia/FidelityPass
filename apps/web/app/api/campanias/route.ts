import { campaniaSchema } from "@fidelitypass/contracts";
import { campanias, db } from "@fidelitypass/db";
import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../lib/get-authenticated-merchant";
import { isAppleWalletConfigured } from "../../../lib/wallet/apple";
import { isGoogleWalletConfigured } from "../../../lib/wallet/google";
import { sendCampaign } from "../../../lib/wallet/notifications";

/**
 * GET /api/campanias
 * Retorna el historial de campañas enviadas por el comercio autenticado.
 */
export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const list = await db
    .select({
      id: campanias.id,
      titulo: campanias.titulo,
      cuerpo: campanias.cuerpo,
      createdAt: campanias.createdAt,
    })
    .from(campanias)
    .where(eq(campanias.merchantId, merchant.id))
    .orderBy(desc(campanias.createdAt));

  return NextResponse.json(list);
}

/**
 * POST /api/campanias
 * Envía una campaña push masiva a todas las tarjetas activas del comercio.
 * Si ninguna wallet está configurada, responde 503 "Wallets no configurados" sin guardar la campaña.
 */
export async function POST(request: NextRequest) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de solicitud inválido" },
      { status: 400 },
    );
  }

  const validation = campaniaSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  // Patrón "integración dormida": si ninguna plataforma de wallet está configurada,
  // responde 503 y NO guarda la campaña en la base de datos.
  if (!isGoogleWalletConfigured() && !isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Wallets no configurados" },
      { status: 503 },
    );
  }

  const { titulo, cuerpo } = validation.data;

  // 1. Guarda la fila en campanias
  await db.insert(campanias).values({
    merchantId: merchant.id,
    titulo,
    cuerpo,
  });

  // 2. Fan-out a todos los pases activos del comercio
  const { enviadas } = await sendCampaign({
    merchantId: merchant.id,
    titulo,
    cuerpo,
  });

  return NextResponse.json({ ok: true, enviadas }, { status: 201 });
}
