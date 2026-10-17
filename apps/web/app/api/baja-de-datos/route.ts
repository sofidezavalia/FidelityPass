import { bajaDeDatosSchema } from "@fidelitypass/contracts";
import { customers, db } from "@fidelitypass/db";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { cascadeDeleteCustomerData } from "../../../lib/cascade-delete-customer";

/**
 * POST /api/baja-de-datos (público)
 * Borra en cascada todos los datos personales del cliente para el comercio especificado.
 * Si el email no existe, devuelve el mismo mensaje exitoso para no revelar existencia de datos.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de solicitud inválido" },
      { status: 400 },
    );
  }

  const validation = bajaDeDatosSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const { merchantId, email } = validation.data;
  const cleanEmail = email.trim().toLowerCase();

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, cleanEmail))
    .limit(1);

  if (customer) {
    await cascadeDeleteCustomerData(customer.id, merchantId);
  }

  return NextResponse.json({
    ok: true,
    mensaje: "Tus datos fueron eliminados.",
  });
}
