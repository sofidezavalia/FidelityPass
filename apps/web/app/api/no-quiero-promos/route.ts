import { noQuieroPromosSchema } from "@fidelitypass/contracts";
import { customers, db } from "@fidelitypass/db";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/no-quiero-promos (público)
 * Revoca el consentimiento de marketing para el cliente sin requerir autenticación.
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

  const validation = noQuieroPromosSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const { email } = validation.data;
  const cleanEmail = email.trim().toLowerCase();

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, cleanEmail))
    .limit(1);

  if (customer) {
    await db
      .update(customers)
      .set({
        consentimientoMarketing: false,
        marketingConsentAt: null,
      })
      .where(eq(customers.id, customer.id));
  }

  return NextResponse.json({
    ok: true,
    mensaje: "Listo, no te vamos a mandar más promos.",
  });
}
