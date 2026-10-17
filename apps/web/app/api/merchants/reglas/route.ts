import { reglasSchema } from "@fidelitypass/contracts";
import { db, merchants, pointsLedger, stamps } from "@fidelitypass/db";
import { count, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

/**
 * GET /api/merchants/reglas
 * Retorna las reglas de acumulación y sellado configuradas para el comercio.
 */
export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const [stampCount] = await db
    .select({ count: count() })
    .from(stamps)
    .where(eq(stamps.merchantId, merchant.id));

  const [pointCount] = await db
    .select({ count: count() })
    .from(pointsLedger)
    .where(eq(pointsLedger.merchantId, merchant.id));

  const tieneMovimientos =
    Number(stampCount?.count ?? 0) > 0 || Number(pointCount?.count ?? 0) > 0;

  return NextResponse.json({
    maxSellosPorDia: merchant.maxSellosPorDia,
    modoAcumulacion: merchant.modoAcumulacion,
    montoMinimoSello: merchant.montoMinimoSello
      ? Number(merchant.montoMinimoSello)
      : null,
    montoPorSello: merchant.montoPorSello
      ? Number(merchant.montoPorSello)
      : null,
    puntosPorUnidad: merchant.puntosPorUnidad
      ? Number(merchant.puntosPorUnidad)
      : null,
    bonoBienvenida: merchant.bonoBienvenida ?? 0,
    bonoCumpleanios: merchant.bonoCumpleanios ?? 0,
    pedirTicket: merchant.pedirTicket ?? false,
    maxUnidadesPorTicket: merchant.maxUnidadesPorTicket ?? null,
    tieneMovimientos,
  });
}

/**
 * PATCH /api/merchants/reglas
 * Configura el modelo de acumulación y las reglas asociadas.
 * Cambio de modo: solo permitido si el comercio todavía no otorgó unidades (sellos ni puntos).
 * Si ya hay movimientos → 422 "Ya otorgaste sellos/puntos con el modo actual; para cambiarlo escribinos".
 */
export async function PATCH(request: NextRequest) {
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

  const validation = reglasSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Regla inválida" },
      { status: 400 },
    );
  }

  const {
    maxSellosPorDia,
    modoAcumulacion,
    montoMinimoSello,
    montoPorSello,
    puntosPorUnidad,
    bonoBienvenida,
    bonoCumpleanios,
    pedirTicket,
    maxUnidadesPorTicket,
  } = validation.data;

  // Si intenta cambiar de modo, validar que no tenga sellos ni puntos previos
  if (modoAcumulacion !== merchant.modoAcumulacion) {
    const [stampCount] = await db
      .select({ count: count() })
      .from(stamps)
      .where(eq(stamps.merchantId, merchant.id));

    const [pointCount] = await db
      .select({ count: count() })
      .from(pointsLedger)
      .where(eq(pointsLedger.merchantId, merchant.id));

    if (
      Number(stampCount?.count ?? 0) > 0 ||
      Number(pointCount?.count ?? 0) > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Ya otorgaste sellos/puntos con el modo actual; para cambiarlo escribinos",
        },
        { status: 422 },
      );
    }
  }

  const [updated] = await db
    .update(merchants)
    .set({
      maxSellosPorDia: maxSellosPorDia ?? merchant.maxSellosPorDia,
      modoAcumulacion,
      bonoBienvenida:
        bonoBienvenida !== undefined ? bonoBienvenida : merchant.bonoBienvenida,
      bonoCumpleanios:
        bonoCumpleanios !== undefined
          ? bonoCumpleanios
          : merchant.bonoCumpleanios,
      pedirTicket:
        pedirTicket !== undefined ? pedirTicket : merchant.pedirTicket,
      maxUnidadesPorTicket:
        maxUnidadesPorTicket !== undefined
          ? maxUnidadesPorTicket
          : merchant.maxUnidadesPorTicket,
      montoMinimoSello:
        montoMinimoSello !== undefined
          ? montoMinimoSello !== null
            ? montoMinimoSello.toString()
            : null
          : merchant.montoMinimoSello,
      montoPorSello:
        montoPorSello !== undefined
          ? montoPorSello !== null
            ? montoPorSello.toString()
            : null
          : merchant.montoPorSello,
      puntosPorUnidad:
        puntosPorUnidad !== undefined
          ? puntosPorUnidad !== null
            ? puntosPorUnidad.toString()
            : null
          : merchant.puntosPorUnidad,
    })
    .where(eq(merchants.id, merchant.id))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Error al actualizar las reglas del comercio" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    maxSellosPorDia: updated.maxSellosPorDia,
    modoAcumulacion: updated.modoAcumulacion,
    montoMinimoSello: updated.montoMinimoSello
      ? Number(updated.montoMinimoSello)
      : null,
    montoPorSello: updated.montoPorSello ? Number(updated.montoPorSello) : null,
    puntosPorUnidad: updated.puntosPorUnidad
      ? Number(updated.puntosPorUnidad)
      : null,
    bonoBienvenida: updated.bonoBienvenida ?? 0,
    bonoCumpleanios: updated.bonoCumpleanios ?? 0,
    pedirTicket: updated.pedirTicket ?? false,
    maxUnidadesPorTicket: updated.maxUnidadesPorTicket ?? null,
  });
}
