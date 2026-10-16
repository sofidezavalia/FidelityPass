import { type NextRequest, NextResponse } from "next/server";
import { isAppleWalletConfigured } from "../../../../../../lib/wallet/apple";

/**
 * POST /api/apple/webservice/v1/log
 * Recibe logs del cliente Apple Wallet en caso de errores en el dispositivo
 */
export async function POST(request: NextRequest) {
  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet no está configurado todavía" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { logs?: string[] };
    if (body.logs && Array.isArray(body.logs)) {
      console.log(
        "[Apple Wallet Client Log]:",
        JSON.stringify(body.logs, null, 2),
      );
    }
  } catch {
    // Si el body es inválido se ignora silenciosamente
  }

  return new Response(null, { status: 200 });
}
