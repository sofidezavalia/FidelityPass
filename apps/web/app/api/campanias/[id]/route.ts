import { editarCampaniaSchema } from "@fidelitypass/contracts";
import { campanias, db } from "@fidelitypass/db";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

/**
 * PATCH /api/campanias/[id]
 * Edita título/cuerpo/fecha de una campaña en estado borrador o programada.
 * Si ya está enviada, responde 409 Conflict.
 */
export async function PATCH(
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

  const validation = editarCampaniaSchema.safeParse(body);
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

  if (campania.estado === "enviada") {
    return NextResponse.json(
      { error: "No se puede editar una campaña ya enviada" },
      { status: 409 },
    );
  }

  const updateData: Partial<typeof campanias.$inferInsert> = {};
  if (validation.data.titulo !== undefined) {
    updateData.titulo = validation.data.titulo;
  }
  if (validation.data.cuerpo !== undefined) {
    updateData.cuerpo = validation.data.cuerpo;
  }
  if (validation.data.programadaPara !== undefined) {
    updateData.programadaPara = validation.data.programadaPara
      ? new Date(validation.data.programadaPara)
      : null;
  }

  const [updated] = await db
    .update(campanias)
    .set(updateData)
    .where(eq(campanias.id, campania.id))
    .returning();

  return NextResponse.json({ ok: true, campania: updated });
}
