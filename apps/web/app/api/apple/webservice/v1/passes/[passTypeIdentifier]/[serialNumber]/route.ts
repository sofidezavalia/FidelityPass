import { customers, db, merchants, passes, stamps } from "@fidelitypass/db";
import { count, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  generateApplePass,
  isAppleWalletConfigured,
} from "../../../../../../../../lib/wallet/apple";

type Context = {
  params: Promise<{
    passTypeIdentifier: string;
    serialNumber: string;
  }>;
};

/**
 * GET: Entrega la versión más reciente del archivo binario .pkpass para un dispositivo
 */
export async function GET(request: NextRequest, context: Context) {
  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet no está configurado todavía" },
      { status: 503 },
    );
  }

  const { serialNumber } = await context.params;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("ApplePass ")) {
    return new Response(null, { status: 401 });
  }

  const token = authHeader.replace("ApplePass ", "").trim();

  const [row] = await db
    .select({
      id: passes.id,
      serialNumber: passes.serialNumber,
      appleAuthToken: passes.appleAuthToken,
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
    .where(eq(passes.serialNumber, serialNumber))
    .limit(1);

  if (!row?.appleAuthToken || row.appleAuthToken !== token) {
    return new Response(null, { status: 401 });
  }

  const [stampCount] = await db
    .select({ total: count() })
    .from(stamps)
    .where(eq(stamps.passId, row.id));

  const sellos = Number(stampCount?.total ?? 0);

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
      authToken: row.appleAuthToken,
      sellos,
    });

    return new Response(new Uint8Array(pkpassBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": new Date().toUTCString(),
      },
    });
  } catch (err) {
    console.error("Error al generar .pkpass en webService:", err);
    return new Response(null, { status: 500 });
  }
}
