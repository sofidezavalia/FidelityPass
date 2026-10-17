import { analyticsResumenQuerySchema } from "@fidelitypass/contracts";
import {
  db,
  passes,
  pointsLedger,
  redemptions,
  stamps,
} from "@fidelitypass/db";
import { and, count, eq, gte, lte, sum } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

/**
 * GET /api/analytics/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * KPIs de miembros, unidades otorgadas, canjes, tasa de canje y serie diaria de 14 días.
 */
export async function GET(request: NextRequest) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const desdeParam = searchParams.get("desde");
  const hastaParam = searchParams.get("hasta");

  const queryValidation = analyticsResumenQuerySchema.safeParse({
    desde: desdeParam || undefined,
    hasta: hastaParam || undefined,
  });

  if (!queryValidation.success) {
    return NextResponse.json(
      { error: queryValidation.error.issues[0]?.message || "Fechas inválidas" },
      { status: 400 },
    );
  }

  // Si no se envían fechas, default últimos 30 días
  const now = new Date();
  const defaultHasta = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const defaultDesde = thirtyDaysAgo.toISOString().slice(0, 10);

  const desdeStr = queryValidation.data.desde || defaultDesde;
  const hastaStr = queryValidation.data.hasta || defaultHasta;

  const desdeDate = new Date(`${desdeStr}T00:00:00.000Z`);
  const hastaDate = new Date(`${hastaStr}T23:59:59.999Z`);

  if (Number.isNaN(desdeDate.getTime()) || Number.isNaN(hastaDate.getTime())) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }

  // 1. Miembros activos (pases activos del comercio al momento)
  const [activosResult] = await db
    .select({ total: count() })
    .from(passes)
    .where(
      and(eq(passes.merchantId, merchant.id), eq(passes.estado, "activa")),
    );
  const miembrosActivos = Number(activosResult?.total ?? 0);

  // 2. Nuevos miembros en el rango
  const [nuevosResult] = await db
    .select({ total: count() })
    .from(passes)
    .where(
      and(
        eq(passes.merchantId, merchant.id),
        gte(passes.createdAt, desdeDate),
        lte(passes.createdAt, hastaDate),
      ),
    );
  const nuevosMiembros = Number(nuevosResult?.total ?? 0);

  // 3. Unidades otorgadas según el modo (sellos o puntos)
  const isPuntos = merchant.modoAcumulacion === "puntos_por_monto";
  const unidad: "sellos" | "puntos" = isPuntos ? "puntos" : "sellos";

  let unidadesOtorgadas = 0;
  if (isPuntos) {
    const [ptsResult] = await db
      .select({ total: sum(pointsLedger.puntos) })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.merchantId, merchant.id),
          gte(pointsLedger.createdAt, desdeDate),
          lte(pointsLedger.createdAt, hastaDate),
        ),
      );
    unidadesOtorgadas = Number(ptsResult?.total ?? 0);
  } else {
    const [stampsResult] = await db
      .select({ total: count() })
      .from(stamps)
      .where(
        and(
          eq(stamps.merchantId, merchant.id),
          gte(stamps.createdAt, desdeDate),
          lte(stamps.createdAt, hastaDate),
        ),
      );
    unidadesOtorgadas = Number(stampsResult?.total ?? 0);
  }

  // 4. Canjes realizados (cantidad de redenciones en el rango)
  const [canjesResult] = await db
    .select({
      totalCount: count(),
      unidadesUsadas: sum(redemptions.unidadesUsadas),
    })
    .from(redemptions)
    .where(
      and(
        eq(redemptions.merchantId, merchant.id),
        gte(redemptions.createdAt, desdeDate),
        lte(redemptions.createdAt, hastaDate),
      ),
    );
  const canjesRealizados = Number(canjesResult?.totalCount ?? 0);
  const unidadesCanjeadas = Number(canjesResult?.unidadesUsadas ?? 0);

  // 5. Tasa de canje = unidades canjeadas ÷ unidades otorgadas (%)
  const tasaCanje =
    unidadesOtorgadas > 0
      ? Math.round((unidadesCanjeadas / unidadesOtorgadas) * 100 * 10) / 10
      : 0;

  // 6. serieDiaria: últimos 14 días del rango
  const serieDiaria: Array<{ fecha: string; otorgadas: number }> = [];
  const endEpoch = new Date(`${hastaStr}T00:00:00.000Z`).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (let i = 13; i >= 0; i--) {
    const dayDate = new Date(endEpoch - i * DAY_MS);
    const dayStr = dayDate.toISOString().slice(0, 10);
    serieDiaria.push({ fecha: dayStr, otorgadas: 0 });
  }

  const firstDay = serieDiaria[0]?.fecha ?? hastaStr;
  const lastDay = serieDiaria[13]?.fecha ?? hastaStr;
  const startSerie = new Date(`${firstDay}T00:00:00.000Z`);
  const endSerie = new Date(`${lastDay}T23:59:59.999Z`);

  if (isPuntos) {
    const dailyPoints = await db
      .select({
        createdAt: pointsLedger.createdAt,
        puntos: pointsLedger.puntos,
      })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.merchantId, merchant.id),
          gte(pointsLedger.createdAt, startSerie),
          lte(pointsLedger.createdAt, endSerie),
        ),
      );

    const mapPoints: Record<string, number> = {};
    for (const row of dailyPoints) {
      const d = row.createdAt.toISOString().slice(0, 10);
      mapPoints[d] = (mapPoints[d] ?? 0) + Number(row.puntos);
    }
    for (const item of serieDiaria) {
      item.otorgadas = mapPoints[item.fecha] ?? 0;
    }
  } else {
    const dailyStamps = await db
      .select({
        createdAt: stamps.createdAt,
      })
      .from(stamps)
      .where(
        and(
          eq(stamps.merchantId, merchant.id),
          gte(stamps.createdAt, startSerie),
          lte(stamps.createdAt, endSerie),
        ),
      );

    const mapStamps: Record<string, number> = {};
    for (const row of dailyStamps) {
      const d = row.createdAt.toISOString().slice(0, 10);
      mapStamps[d] = (mapStamps[d] ?? 0) + 1;
    }
    for (const item of serieDiaria) {
      item.otorgadas = mapStamps[item.fecha] ?? 0;
    }
  }

  // 7. Tasa de retención (PR-17): % de miembros activos con al menos un movimiento en los últimos 30 días
  const thirtyDaysAgoRetention = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  );

  const stampsPasses = await db
    .selectDistinct({ passId: stamps.passId })
    .from(stamps)
    .innerJoin(passes, eq(stamps.passId, passes.id))
    .where(
      and(
        eq(stamps.merchantId, merchant.id),
        eq(passes.estado, "activa"),
        gte(stamps.createdAt, thirtyDaysAgoRetention),
      ),
    );

  const pointsPasses = await db
    .selectDistinct({ passId: pointsLedger.passId })
    .from(pointsLedger)
    .innerJoin(passes, eq(pointsLedger.passId, passes.id))
    .where(
      and(
        eq(pointsLedger.merchantId, merchant.id),
        eq(passes.estado, "activa"),
        gte(pointsLedger.createdAt, thirtyDaysAgoRetention),
      ),
    );

  const redemptionsPasses = await db
    .selectDistinct({ passId: redemptions.passId })
    .from(redemptions)
    .innerJoin(passes, eq(redemptions.passId, passes.id))
    .where(
      and(
        eq(redemptions.merchantId, merchant.id),
        eq(passes.estado, "activa"),
        gte(redemptions.createdAt, thirtyDaysAgoRetention),
      ),
    );

  const activeWithMovement = new Set<string>();
  for (const s of stampsPasses) activeWithMovement.add(s.passId);
  for (const p of pointsPasses) activeWithMovement.add(p.passId);
  for (const r of redemptionsPasses) activeWithMovement.add(r.passId);

  const tasaRetencion =
    miembrosActivos > 0
      ? Math.round((activeWithMovement.size / miembrosActivos) * 100 * 10) / 10
      : 0;

  return NextResponse.json({
    miembrosActivos,
    nuevosMiembros,
    unidadesOtorgadas,
    canjesRealizados,
    tasaCanje,
    tasaRetencion,
    unidad,
    serieDiaria,
  });
}
