import { db, passes } from "@fidelitypass/db";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { cascadeDeleteCustomerData } from "../../../../lib/cascade-delete-customer";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

/**
 * DELETE /api/customers/[id] (sesión comercio)
 * Elimina todos los datos del cliente para el comercio autenticado en cascada.
 * Devuelve 404 si el cliente no pertenece al comercio.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const { id: customerId } = await params;

  // Verificar que el cliente tenga al menos un pase con este comercio
  const [existingPass] = await db
    .select({ id: passes.id })
    .from(passes)
    .where(
      and(
        eq(passes.customerId, customerId),
        eq(passes.merchantId, merchant.id),
      ),
    )
    .limit(1);

  if (!existingPass) {
    return NextResponse.json(
      { error: "Cliente no encontrado" },
      { status: 404 },
    );
  }

  // Borrado en cascada
  await cascadeDeleteCustomerData(customerId, merchant.id);

  return NextResponse.json({
    ok: true,
    mensaje: "Cliente y sus datos eliminados correctamente",
  });
}
