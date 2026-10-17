import { campaniaSchema } from "@fidelitypass/contracts";
import { campanias, db } from "@fidelitypass/db";
import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../lib/get-authenticated-merchant";
import { isAppleWalletConfigured } from "../../../lib/wallet/apple";
import { isGoogleWalletConfigured } from "../../../lib/wallet/google";
import {
  getTargetPassesForSegment,
  sendCampaign,
} from "../../../lib/wallet/notifications";

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
      segmento: campanias.segmento,
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
 * - "borrador": guarda en borrador con segmento
 * - "enviar": valida wallets, guarda como enviada y ejecuta fan-out push filtrando por segmento (PR-17)
 * - "programar": guarda como programada con programadaPara (futura) y segmento
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

  const { titulo, cuerpo, accion, programadaPara, segmento } = validation.data;
  const targetPasses = await getTargetPassesForSegment(
    merchant.id,
    segmento ?? "todos",
  );
  const alcance = targetPasses.length;

  if (accion === "borrador") {
    const [nueva] = await db
      .insert(campanias)
      .values({
        merchantId: merchant.id,
        titulo,
        cuerpo,
        estado: "borrador",
        segmento: segmento ?? "todos",
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
      {
        ok: true,
        id: nueva.id,
        estado: "borrador",
        segmento: nueva.segmento,
        alcance,
      },
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
        segmento: segmento ?? "todos",
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
        segmento: nueva.segmento,
        alcance,
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

  // 1. Guarda la fila en campanias con estado "enviada" y segmento
  const [nueva] = await db
    .insert(campanias)
    .values({
      merchantId: merchant.id,
      titulo,
      cuerpo,
      estado: "enviada",
      segmento: segmento ?? "todos",
    })
    .returning();

  if (!nueva) {
    return NextResponse.json(
      { error: "Error al crear la campaña" },
      { status: 500 },
    );
  }

  // 2. Fan-out a los pases del segmento del comercio
  const { enviadas } = await sendCampaign({
    merchantId: merchant.id,
    titulo,
    cuerpo,
    segmento: segmento ?? "todos",
  });

  return NextResponse.json(
    {
      ok: true,
      id: nueva.id,
      estado: "enviada",
      segmento: nueva.segmento,
      alcance,
      enviadas,
    },
    { status: 201 },
  );
}
