import { reglasSchema } from "@fidelitypass/contracts";
import { db, merchants } from "@fidelitypass/db";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

/**
 * GET /api/merchants/reglas
 * Retorna las reglas de sellado configuradas para el comercio.
 */
export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  return NextResponse.json({
    maxSellosPorDia: merchant.maxSellosPorDia,
  });
}

/**
 * PATCH /api/merchants/reglas
 * Configura la regla anti-fraude maxSellosPorDia para el comercio.
 */
export async function PATCH(request: NextRequest) {
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

  const validation = reglasSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Regla inválida" },
      { status: 400 },
    );
  }

  const { maxSellosPorDia } = validation.data;

  const [updated] = await db
    .update(merchants)
    .set({ maxSellosPorDia })
    .where(eq(merchants.id, merchant.id))
    .returning({ maxSellosPorDia: merchants.maxSellosPorDia });

  return NextResponse.json({
    ok: true,
    maxSellosPorDia: updated?.maxSellosPorDia ?? maxSellosPorDia,
  });
}
