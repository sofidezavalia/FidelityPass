import { db, merchants } from "@fidelitypass/db";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { isAppleWalletConfigured } from "../../../../lib/wallet/apple";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get("c");

  if (!merchantId) {
    return NextResponse.json(
      { error: "Falta el identificador del comercio" },
      { status: 400 },
    );
  }

  const [merchant] = await db
    .select({
      id: merchants.id,
      nombre: merchants.nombre,
      bonoBienvenida: merchants.bonoBienvenida,
      modoAcumulacion: merchants.modoAcumulacion,
    })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);

  if (!merchant) {
    return NextResponse.json(
      { error: "Comercio no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ...merchant,
    isAppleWalletConfigured: isAppleWalletConfigured(),
  });
}
