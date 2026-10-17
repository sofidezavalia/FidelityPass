import { actividadQuerySchema } from "@fidelitypass/contracts";
import { type NextRequest, NextResponse } from "next/server";
import { getActividadEventos } from "../../../../lib/analytics-actividad";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/analytics/actividad.csv?desde=&hasta=&q=
 * Devuelve CSV descargable con columnas: fecha,tipo,cliente,empleado,detalle,unidades.
 * Content-Disposition: attachment.
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

  const queryValidation = actividadQuerySchema.safeParse({
    desde: desdeParam || undefined,
    hasta: hastaParam || undefined,
    q: qParam || undefined,
    page: 1,
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

  const { desde, hasta, q } = queryValidation.data;

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

  const headers = [
    "fecha",
    "tipo",
    "cliente",
    "empleado",
    "detalle",
    "unidades",
  ];
  const rows = allEvents.map((e) => [
    escapeCsv(e.fecha),
    escapeCsv(e.tipo),
    escapeCsv(e.cliente),
    escapeCsv(e.empleado ?? ""),
    escapeCsv(e.detalle),
    escapeCsv(e.unidades),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
    "\n",
  );

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="actividad.csv"',
      "Cache-Control": "no-store",
    },
  });
}
