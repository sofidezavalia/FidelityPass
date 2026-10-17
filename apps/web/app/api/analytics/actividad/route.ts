import { actividadQuerySchema } from "@fidelitypass/contracts";
import { type NextRequest, NextResponse } from "next/server";
import { getActividadEventos } from "../../../../lib/analytics-actividad";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

/**
 * GET /api/analytics/actividad?desde=&hasta=&q=&page=1
 * Lista paginada (20 por página) unificada de eventos del comercio en el rango.
 */
export async function GET(request: NextRequest) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const desdeParam = searchParams.get("desde")?.trim();
  const hastaParam = searchParams.get("hasta")?.trim();
  const qParam = searchParams.get("q")?.trim();
  const pageParam = searchParams.get("page")?.trim();

  const queryValidation = actividadQuerySchema.safeParse({
    desde: desdeParam || undefined,
    hasta: hastaParam || undefined,
    q: qParam || undefined,
    page: pageParam ? Number(pageParam) : 1,
  });

  if (!queryValidation.success) {
    return NextResponse.json(
      {
        error:
          queryValidation.error.issues[0]?.message || "Parámetros inválidos",
      },
      { status: 400 },
    );
  }

  const { desde, hasta, q, page } = queryValidation.data;

  // Si no se envían fechas, default últimos 30 días
  const now = new Date();
  const defaultHasta = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const defaultDesde = thirtyDaysAgo.toISOString().slice(0, 10);

  const desdeStr = desde || defaultDesde;
  const hastaStr = hasta || defaultHasta;

  const desdeDate = new Date(`${desdeStr}T00:00:00.000Z`);
  const hastaDate = new Date(`${hastaStr}T23:59:59.999Z`);

  if (Number.isNaN(desdeDate.getTime()) || Number.isNaN(hastaDate.getTime())) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }

  const allEvents = await getActividadEventos({
    merchantId: merchant.id,
    modoAcumulacion: merchant.modoAcumulacion,
    desdeDate,
    hastaDate,
    q,
  });

  const total = allEvents.length;
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize) || (total === 0 ? 0 : 1);
  const currentPage = Math.max(1, page);
  const offset = (currentPage - 1) * pageSize;
  const paged = allEvents.slice(offset, offset + pageSize);

  const eventos = paged.map((e) => ({
    id: e.id,
    fecha: e.fecha,
    tipo: e.tipo,
    cliente: e.cliente,
    empleado: e.empleado,
    detalle: e.detalle,
    unidades: e.unidades,
  }));

  return NextResponse.json({
    eventos,
    total,
    page: currentPage,
    pageSize,
    totalPages,
  });
}
