import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";
import { getTargetPassesForSegment } from "../../../../lib/wallet/notifications";

/**
 * GET /api/campanias/alcance?segmento=...
 * Calcula el número de tarjetas activas alcanzadas por un segmento dado para el comercio autenticado.
 */
export async function GET(request: NextRequest) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const segmento = searchParams.get("segmento") || "todos";

  const targetPasses = await getTargetPassesForSegment(merchant.id, segmento);

  return NextResponse.json({
    ok: true,
    segmento,
    alcance: targetPasses.length,
  });
}
