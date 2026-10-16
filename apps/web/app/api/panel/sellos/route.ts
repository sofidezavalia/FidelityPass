import { sellosListSchema } from "@fidelitypass/contracts";
import { customers, db, passes, staff, stamps } from "@fidelitypass/db";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  // Últimos 50 sellos del comercio con cliente y nombre del staff o "Titular"
  const rows = await db
    .select({
      id: stamps.id,
      clienteNombre: customers.nombre,
      staffNombre: staff.nombre,
      createdAt: stamps.createdAt,
    })
    .from(stamps)
    .innerJoin(passes, eq(stamps.passId, passes.id))
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .leftJoin(staff, eq(stamps.staffId, staff.id))
    .where(eq(stamps.merchantId, merchant.id))
    .orderBy(desc(stamps.createdAt))
    .limit(50);

  const payload = rows.map((r) => ({
    id: r.id,
    clienteNombre: r.clienteNombre,
    otorgadoPor: r.staffNombre || "Titular",
    createdAt: r.createdAt.toISOString(),
  }));

  // Validación con contrato Zod antes de responder
  const validated = sellosListSchema.parse(payload);
  return NextResponse.json(validated);
}
