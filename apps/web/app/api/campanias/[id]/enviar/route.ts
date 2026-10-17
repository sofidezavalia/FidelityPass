import { campanias, db } from "@fidelitypass/db";
import { and, eq, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../../lib/get-authenticated-merchant";
import { isAppleWalletConfigured } from "../../../../../lib/wallet/apple";
import { isGoogleWalletConfigured } from "../../../../../lib/wallet/google";
import { sendCampaign } from "../../../../../lib/wallet/notifications";

/**
 * POST /api/campanias/[id]/enviar
 * Envía una campaña en estado borrador o programada inmediatamente.
 * Idempotente: si ya está enviada, responde 409 Conflict.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const { id } = await params;

  const [campania] = await db
    .select()
    .from(campanias)
    .where(and(eq(campanias.id, id), eq(campanias.merchantId, merchant.id)))
    .limit(1);

  if (!campania) {
    return NextResponse.json(
      { error: "Campaña no encontrada" },
      { status: 404 },
    );
  }

  if (campania.estado === "enviada") {
    return NextResponse.json(
      { error: "La campaña ya fue enviada" },
      { status: 409 },
    );
  }

  if (!isGoogleWalletConfigured() && !isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Wallets no configurados" },
      { status: 503 },
    );
  }

  // Idempotencia atómica: reclamar asegurando que el estado no sea 'enviada'
  const [claimed] = await db
    .update(campanias)
    .set({ estado: "enviada" })
    .where(
      and(
        eq(campanias.id, campania.id),
        eq(campanias.merchantId, merchant.id),
        ne(campanias.estado, "enviada"),
      ),
    )
    .returning();

  if (!claimed) {
    return NextResponse.json(
      { error: "La campaña ya fue enviada" },
      { status: 409 },
    );
  }

  const { enviadas, alcance } = await sendCampaign({
    merchantId: merchant.id,
    titulo: claimed.titulo,
    cuerpo: claimed.cuerpo,
    segmento: claimed.segmento,
  });

  return NextResponse.json({
    ok: true,
    id: claimed.id,
    estado: "enviada",
    segmento: claimed.segmento,
    alcance,
    enviadas,
  });
}
