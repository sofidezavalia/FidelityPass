import crypto from "node:crypto";
import {
  applePassResultSchema,
  emitirPaseSchema,
} from "@fidelitypass/contracts";
import { customers, db, merchants, passes } from "@fidelitypass/db";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  AppleWalletNoConfiguradoError,
  createApplePass,
  isAppleWalletConfigured,
} from "../../../../lib/wallet/apple";

/**
 * POST /api/pases/emitir-apple (público)
 * Emite una tarjeta de fidelidad digital para Apple Wallet (.pkpass)
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

  // 2. Patrón "integración dormida": si la API key no está presente, 503 sin tocar la DB
  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet no está configurado todavía" },
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

  // 4. Crear cliente en la DB
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

  // 5. Generar serialNumber (compartido y compatible con escáner PR-06) y llamar al proveedor de Apple Wallet
  const serialNumber = crypto.randomUUID();

  try {
    const { downloadUrl, applePassId } = await createApplePass(
      {
        id: merchant.id,
        nombre: merchant.nombre,
        logoUrl: merchant.logoUrl,
        colorPrimario: merchant.colorPrimario,
        colorSecundario: merchant.colorSecundario,
      },
      { id: customer.id, nombre: customer.nombre },
      serialNumber,
    );

    // 6. Guardar pase en la DB
    await db.insert(passes).values({
      merchantId: merchant.id,
      customerId: customer.id,
      serialNumber,
      applePassId,
      estado: "activa",
    });

    const responsePayload = applePassResultSchema.parse({ downloadUrl });
    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    if (error instanceof AppleWalletNoConfiguradoError) {
      return NextResponse.json(
        { error: "Apple Wallet no está configurado todavía" },
        { status: 503 },
      );
    }
    console.error("Error al emitir pase para Apple Wallet:", error);
    return NextResponse.json(
      { error: "No se pudo generar el pase de Apple Wallet en este momento" },
      { status: 502 },
    );
  }
}
