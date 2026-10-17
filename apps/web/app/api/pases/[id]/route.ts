import { db, passes } from "@fidelitypass/db";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

/**
 * DELETE /api/pases/[id]
 * Elimina un pase de prueba perteneciente al comercio autenticado.
 * Solo si esPrueba = true (400 en otro caso).
 */
export async function DELETE(
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

  // Buscar el pase asegurando que pertenezca al comercio
  const [pass] = await db
    .select({
      id: passes.id,
      merchantId: passes.merchantId,
      esPrueba: passes.esPrueba,
    })
    .from(passes)
    .where(and(eq(passes.id, id), eq(passes.merchantId, merchant.id)))
    .limit(1);

  if (!pass) {
    return NextResponse.json({ error: "Pase no encontrado" }, { status: 404 });
  }

  if (!pass.esPrueba) {
    return NextResponse.json(
      { error: "Solo se pueden eliminar pases de prueba" },
      { status: 400 },
    );
  }

  await db.delete(passes).where(eq(passes.id, pass.id));

  return NextResponse.json({ ok: true, id: pass.id });
}
