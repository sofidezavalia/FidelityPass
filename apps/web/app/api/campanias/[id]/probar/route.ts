import { probarCampaniaSchema } from "@fidelitypass/contracts";
import { campanias, db, passes } from "@fidelitypass/db";
import { and, eq, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../../lib/get-authenticated-merchant";
import { sendSinglePassCampaign } from "../../../../../lib/wallet/notifications";

/**
 * POST /api/campanias/[id]/probar
 * Envía la campaña solo al pase especificado (por serialNumber o codigoCorto)
 * para que el comercio la pruebe en su propio teléfono.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de solicitud inválido" },
      { status: 400 },
    );
  }

  const validation = probarCampaniaSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

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

  const trimmed = validation.data.serialNumber.trim();
  const [targetPass] = await db
    .select({
      id: passes.id,
      serialNumber: passes.serialNumber,
      googleWalletObjectId: passes.googleWalletObjectId,
    })
    .from(passes)
    .where(
      and(
        eq(passes.merchantId, merchant.id),
        or(
          eq(passes.serialNumber, trimmed),
          eq(passes.codigoCorto, trimmed.toUpperCase()),
        ),
      ),
    )
    .limit(1);

  if (!targetPass) {
    return NextResponse.json(
      { error: "Pase no encontrado para este comercio" },
      { status: 404 },
    );
  }

  await sendSinglePassCampaign({
    serialNumber: targetPass.serialNumber,
    googleWalletObjectId: targetPass.googleWalletObjectId,
    titulo: campania.titulo,
    cuerpo: campania.cuerpo,
  });

  return NextResponse.json({
    ok: true,
    mensaje: "Campaña de prueba enviada",
    serialNumber: targetPass.serialNumber,
  });
}
