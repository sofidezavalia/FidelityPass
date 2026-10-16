import { rewardSchema } from "@fidelitypass/contracts";
import { db, rewards } from "@fidelitypass/db";
import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../lib/get-authenticated-merchant";

/**
 * GET /api/rewards
 * Lista todas las recompensas del comercio autenticado (activas e inactivas).
 */
export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const list = await db
    .select()
    .from(rewards)
    .where(eq(rewards.merchantId, merchant.id))
    .orderBy(desc(rewards.createdAt));

  return NextResponse.json(list);
}

/**
 * POST /api/rewards
 * Crea una nueva recompensa asociada al comercio autenticado.
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

  const validation = rewardSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const { nombre, descripcion, sellosRequeridos, activa } = validation.data;

  const [created] = await db
    .insert(rewards)
    .values({
      merchantId: merchant.id,
      nombre,
      descripcion: descripcion || null,
      sellosRequeridos,
      activa: activa ?? true,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
