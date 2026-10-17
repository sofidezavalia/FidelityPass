import { campaniaSchema } from "@fidelitypass/contracts";
import { campanias, db } from "@fidelitypass/db";
import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../lib/get-authenticated-merchant";
import { isAppleWalletConfigured } from "../../../lib/wallet/apple";
import { isGoogleWalletConfigured } from "../../../lib/wallet/google";
import { sendCampaign } from "../../../lib/wallet/notifications";

/**
 * GET /api/campanias
 * Retorna el historial de campañas enviadas/programadas/borradores del comercio autenticado.
 */
export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const list = await db
    .select({
      id: campanias.id,
      titulo: campanias.titulo,
      cuerpo: campanias.cuerpo,
      estado: campanias.estado,
      programadaPara: campanias.programadaPara,
      createdAt: campanias.createdAt,
    })
    .from(campanias)
    .where(eq(campanias.merchantId, merchant.id))
    .orderBy(desc(campanias.createdAt));

  return NextResponse.json(list);
}

/**
 * POST /api/campanias
 * Según accion:
 * - "borrador": guarda en borrador
 * - "enviar": valida wallets, guarda como enviada y ejecuta fan-out push (PR-10)
 * - "programar": guarda como programada con programadaPara (futura)
 */
export async function POST(request: NextRequest) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de solicitud inválido" },
      { status: 400 },
    );
  }

  const validation = campaniaSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const { titulo, cuerpo, accion, programadaPara } = validation.data;

  if (accion === "borrador") {
    const [nueva] = await db
      .insert(campanias)
      .values({
        merchantId: merchant.id,
        titulo,
        cuerpo,
        estado: "borrador",
        programadaPara: programadaPara ? new Date(programadaPara) : null,
      })
      .returning();

    if (!nueva) {
      return NextResponse.json(
        { error: "Error al crear la campaña" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, id: nueva.id, estado: "borrador" },
      { status: 201 },
    );
  }

  if (accion === "programar") {
    if (!programadaPara) {
      return NextResponse.json(
        { error: "programadaPara requerida para programar" },
        { status: 400 },
      );
    }

    const [nueva] = await db
      .insert(campanias)
      .values({
        merchantId: merchant.id,
        titulo,
        cuerpo,
        estado: "programada",
        programadaPara: new Date(programadaPara),
      })
      .returning();

    if (!nueva) {
      return NextResponse.json(
        { error: "Error al crear la campaña" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        id: nueva.id,
        estado: "programada",
        programadaPara: nueva.programadaPara?.toISOString(),
      },
      { status: 201 },
    );
  }

  // accion === "enviar"
  // Patrón "integración dormida": si ninguna plataforma de wallet está configurada,
  // responde 503 y NO guarda la campaña en la base de datos.
  if (!isGoogleWalletConfigured() && !isAppleWalletConfigured()) {
    return NextResponse.json(
      { error: "Wallets no configurados" },
      { status: 503 },
    );
  }

  // 1. Guarda la fila en campanias con estado "enviada"
  const [nueva] = await db
    .insert(campanias)
    .values({
      merchantId: merchant.id,
      titulo,
      cuerpo,
      estado: "enviada",
    })
    .returning();

  if (!nueva) {
    return NextResponse.json(
      { error: "Error al crear la campaña" },
      { status: 500 },
    );
  }

  // 2. Fan-out a todos los pases activos del comercio
  const { enviadas } = await sendCampaign({
    merchantId: merchant.id,
    titulo,
    cuerpo,
  });

  return NextResponse.json(
    { ok: true, id: nueva.id, estado: "enviada", enviadas },
    { status: 201 },
  );
}
