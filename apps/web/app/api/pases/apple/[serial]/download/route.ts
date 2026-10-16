import crypto from "node:crypto";
import { customers, db, merchants, passes, stamps } from "@fidelitypass/db";
import { count, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  generateApplePass,
  isAppleWalletConfigured,
} from "../../../../../../lib/wallet/apple";

/**
 * GET /api/pases/apple/[serial]/download
 * Descarga directa del archivo binario .pkpass para Apple Wallet
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ serial: string }> },
) {
  // Patrón integración dormida: 503 si Apple Wallet no está configurado
  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet no está configurado todavía" },
      { status: 503 },
    );
  }

  const { serial } = await context.params;

  if (!serial) {
    return NextResponse.json(
      { error: "Número de serie faltante" },
      { status: 400 },
    );
  }

  // 1. Buscamos el pase con sus datos de comercio y cliente
  const [row] = await db
    .select({
      id: passes.id,
      serialNumber: passes.serialNumber,
      appleAuthToken: passes.appleAuthToken,
      estado: passes.estado,
      customerNombre: customers.nombre,
      merchantId: merchants.id,
      merchantNombre: merchants.nombre,
      colorPrimario: merchants.colorPrimario,
      colorSecundario: merchants.colorSecundario,
      logoUrl: merchants.logoUrl,
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .innerJoin(merchants, eq(passes.merchantId, merchants.id))
    .where(eq(passes.serialNumber, serial))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Pase no encontrado" }, { status: 404 });
  }

  // 2. Calculamos los sellos acumulados
  const [stampCount] = await db
    .select({ total: count() })
    .from(stamps)
    .where(eq(stamps.passId, row.id));

  const sellos = Number(stampCount?.total ?? 0);

  // 3. Garantizamos un authenticationToken válido
  let authToken = row.appleAuthToken;
  if (!authToken) {
    authToken = crypto.randomBytes(16).toString("hex");
    await db
      .update(passes)
      .set({ appleAuthToken: authToken })
      .where(eq(passes.id, row.id));
  }

  try {
    const pkpassBuffer = await generateApplePass({
      merchant: {
        id: row.merchantId,
        nombre: row.merchantNombre,
        colorPrimario: row.colorPrimario,
        colorSecundario: row.colorSecundario,
        logoUrl: row.logoUrl,
      },
      customer: {
        id: row.id,
        nombre: row.customerNombre,
      },
      serialNumber: row.serialNumber,
      authToken,
      sellos,
    });

    return new Response(new Uint8Array(pkpassBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="tarjeta-${serial}.pkpass"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Error al generar .pkpass:", err);
    return NextResponse.json(
      { error: "Error al generar la tarjeta de Apple Wallet" },
      { status: 500 },
    );
  }
}
