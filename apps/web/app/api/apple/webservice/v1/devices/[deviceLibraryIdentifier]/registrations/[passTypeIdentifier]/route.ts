import { appleDevices, db } from "@fidelitypass/db";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { isAppleWalletConfigured } from "../../../../../../../../../lib/wallet/apple";

type Context = {
  params: Promise<{
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
  }>;
};

/**
 * GET: Obtiene los números de serie de los pases asociados a un dispositivo Apple
 */
export async function GET(_request: NextRequest, context: Context) {
  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet no está configurado todavía" },
      { status: 503 },
    );
  }

  const { deviceLibraryIdentifier, passTypeIdentifier } = await context.params;

  const rows = await db
    .select({
      serialNumber: appleDevices.serialNumber,
      updatedAt: appleDevices.updatedAt,
    })
    .from(appleDevices)
    .where(
      and(
        eq(appleDevices.deviceLibraryIdentifier, deviceLibraryIdentifier),
        eq(appleDevices.passTypeIdentifier, passTypeIdentifier),
      ),
    );

  if (rows.length === 0) {
    // Especificación de Apple: 204 No Content si no hay pases
    return new Response(null, { status: 204 });
  }

  const serialNumbers = rows.map((r) => r.serialNumber);
  const maxUpdatedAt = Math.max(
    ...rows.map((r) => new Date(r.updatedAt).getTime()),
  );

  return NextResponse.json({
    lastUpdated: String(maxUpdatedAt),
    serialNumbers,
  });
}
