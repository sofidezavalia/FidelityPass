import { pasesListSchema } from "@fidelitypass/contracts";
import { customers, db, passes, stamps } from "@fidelitypass/db";
import { count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  // Obtenemos los pases del comercio autenticado con su cliente y cantidad de sellos
  const rows = await db
    .select({
      id: passes.id,
      clienteNombre: customers.nombre,
      estado: passes.estado,
      createdAt: passes.createdAt,
      sellosCount: count(stamps.id),
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .leftJoin(stamps, eq(stamps.passId, passes.id))
    .where(eq(passes.merchantId, merchant.id))
    .groupBy(passes.id, customers.nombre, passes.estado, passes.createdAt)
    .orderBy(desc(passes.createdAt));

  const payload = rows.map((r) => ({
    id: r.id,
    clienteNombre: r.clienteNombre,
    estado: r.estado,
    sellos: Number(r.sellosCount),
    createdAt: r.createdAt.toISOString(),
  }));

  // Validación con contrato Zod antes de responder
  const validated = pasesListSchema.parse(payload);
  return NextResponse.json(validated);
}
