import { rewardUpdateSchema } from "@fidelitypass/contracts";
import { db, rewards } from "@fidelitypass/db";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * PATCH /api/rewards/[id]
 * Edita una recompensa del comercio autenticado.
 */
export async function PATCH(request: NextRequest, context: Context) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const { id } = await context.params;

  const [existing] = await db
    .select({ id: rewards.id })
    .from(rewards)
    .where(and(eq(rewards.id, id), eq(rewards.merchantId, merchant.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Recompensa no encontrada" },
      { status: 404 },
    );
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

  const validation = rewardUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const data = validation.data;
  const updatePayload: {
    nombre?: string;
    descripcion?: string | null;
    sellosRequeridos?: number;
    activa?: boolean;
  } = {};

  if (data.nombre !== undefined) updatePayload.nombre = data.nombre;
  if (data.descripcion !== undefined)
    updatePayload.descripcion = data.descripcion || null;
  if (data.sellosRequeridos !== undefined)
    updatePayload.sellosRequeridos = data.sellosRequeridos;
  if (data.activa !== undefined) updatePayload.activa = data.activa;

  const [updated] = await db
    .update(rewards)
    .set(updatePayload)
    .where(and(eq(rewards.id, id), eq(rewards.merchantId, merchant.id)))
    .returning();

  return NextResponse.json(updated);
}

/**
 * DELETE /api/rewards/[id]
 * Desactiva la recompensa (activa = false) preservando el historial de canjes.
 */
export async function DELETE(_request: NextRequest, context: Context) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const { id } = await context.params;

  const [existing] = await db
    .select({ id: rewards.id })
    .from(rewards)
    .where(and(eq(rewards.id, id), eq(rewards.merchantId, merchant.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Recompensa no encontrada" },
      { status: 404 },
    );
  }

  await db
    .update(rewards)
    .set({ activa: false })
    .where(and(eq(rewards.id, id), eq(rewards.merchantId, merchant.id)));

  return NextResponse.json({ ok: true });
}
