import { appleDevices, db, passes } from "@fidelitypass/db";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { isAppleWalletConfigured } from "../../../../../../../../../../lib/wallet/apple";

type Context = {
  params: Promise<{
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
    serialNumber: string;
  }>;
};

/**
 * Valida la cabecera de autorización de Apple: "ApplePass <authenticationToken>"
 */
async function authenticatePass(
  request: NextRequest,
  serialNumber: string,
): Promise<{ ok: boolean; passId?: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("ApplePass ")) {
    return { ok: false };
  }

  const token = authHeader.replace("ApplePass ", "").trim();

  const [pass] = await db
    .select({ id: passes.id, appleAuthToken: passes.appleAuthToken })
    .from(passes)
    .where(eq(passes.serialNumber, serialNumber))
    .limit(1);

  if (!pass?.appleAuthToken || pass.appleAuthToken !== token) {
    return { ok: false };
  }

  return { ok: true, passId: pass.id };
}

/**
 * POST: Registra un dispositivo Apple para recibir notificaciones push para un pase
 */
export async function POST(request: NextRequest, context: Context) {
  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet no está configurado todavía" },
      { status: 503 },
    );
  }

  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } =
    await context.params;

  const auth = await authenticatePass(request, serialNumber);
  if (!auth.ok || !auth.passId) {
    return new Response(null, { status: 401 });
  }

  let body: { pushToken?: string };
  try {
    body = (await request.json()) as { pushToken?: string };
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!body.pushToken) {
    return new Response(null, { status: 400 });
  }

  // Verificamos si ya existe la registración
  const [existing] = await db
    .select({ id: appleDevices.id })
    .from(appleDevices)
    .where(
      and(
        eq(appleDevices.deviceLibraryIdentifier, deviceLibraryIdentifier),
        eq(appleDevices.passTypeIdentifier, passTypeIdentifier),
        eq(appleDevices.serialNumber, serialNumber),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(appleDevices)
      .set({
        pushToken: body.pushToken,
        updatedAt: new Date(),
      })
      .where(eq(appleDevices.id, existing.id));

    return new Response(null, { status: 200 });
  }

  await db.insert(appleDevices).values({
    deviceLibraryIdentifier,
    pushToken: body.pushToken,
    passTypeIdentifier,
    serialNumber,
    passId: auth.passId,
  });

  return new Response(null, { status: 201 });
}

/**
 * DELETE: Desregistra un dispositivo Apple para dejar de recibir push para un pase
 */
export async function DELETE(request: NextRequest, context: Context) {
  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Apple Wallet no está configurado todavía" },
      { status: 503 },
    );
  }

  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } =
    await context.params;

  const auth = await authenticatePass(request, serialNumber);
  if (!auth.ok) {
    return new Response(null, { status: 401 });
  }

  await db
    .delete(appleDevices)
    .where(
      and(
        eq(appleDevices.deviceLibraryIdentifier, deviceLibraryIdentifier),
        eq(appleDevices.passTypeIdentifier, passTypeIdentifier),
        eq(appleDevices.serialNumber, serialNumber),
      ),
    );

  return new Response(null, { status: 200 });
}
