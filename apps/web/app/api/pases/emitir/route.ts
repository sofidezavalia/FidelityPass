import { emitirPaseSchema, paseEmitidoSchema } from "@fidelitypass/contracts";
import { customers, db, merchants, passes } from "@fidelitypass/db";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  isGoogleWalletConfigured,
  issuePass,
} from "../../../../lib/wallet/google";

/**
 * POST /api/pases/emitir (público)
 * Emite una tarjeta de fidelidad digital para Google Wallet
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

  // 1. Validación de entrada con Zod
  const validation = emitirPaseSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const { merchantId, nombreCliente } = validation.data;

  // 2. Patrón "integración dormida": si las credenciales no están presentes, falla con 503 sin tocar la DB
  if (!isGoogleWalletConfigured()) {
    return NextResponse.json(
      { error: "Google Wallet no está configurado todavía" },
      { status: 503 },
    );
  }

  // 3. Buscar comercio en la base de datos
  const [merchant] = await db
    .select({
      id: merchants.id,
      nombre: merchants.nombre,
      logoUrl: merchants.logoUrl,
      colorPrimario: merchants.colorPrimario,
      colorSecundario: merchants.colorSecundario,
    })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);

  if (!merchant) {
    return NextResponse.json({ error: "Comercio inválido" }, { status: 400 });
  }

  // TODO (Producción): Agregar rate limiting por IP para prevenir abuso en este endpoint público.

  const [customer] = await db
    .insert(customers)
    .values({
      nombre: nombreCliente,
    })
    .returning({ id: customers.id, nombre: customers.nombre });

  if (!customer) {
    return NextResponse.json(
      { error: "Error al registrar cliente" },
      { status: 500 },
    );
  }

  // 5. Generar pase y firmado en Google Wallet con personalización del comercio
  const { saveUrl, googleWalletObjectId, serialNumber } = issuePass(
    {
      id: merchant.id,
      nombre: merchant.nombre,
      logoUrl: merchant.logoUrl,
      colorPrimario: merchant.colorPrimario,
      colorSecundario: merchant.colorSecundario,
    },
    { id: customer.id, nombre: customer.nombre },
  );

  // 6. Guardar pase en la DB
  await db.insert(passes).values({
    merchantId: merchant.id,
    customerId: customer.id,
    serialNumber,
    googleWalletObjectId,
    estado: "activa",
  });

  const responsePayload = paseEmitidoSchema.parse({ saveUrl });
  return NextResponse.json(responsePayload, { status: 201 });
}
