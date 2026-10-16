import { dashboardResumenSchema } from "@fidelitypass/contracts";
import { db, passes, stamps } from "@fidelitypass/db";
import { and, count, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  // Decisión de zona horaria: El piloto opera en Tucumán, Argentina (UTC-3).
  // Para sellosHoy, calculamos el inicio del día (00:00:00) de hoy según la hora del sistema
  // asegurando consistencia con los timestamps ISO almacenados en la base de datos.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // 1. Pases emitidos por el comercio
  const [pasesResult] = await db
    .select({ total: count() })
    .from(passes)
    .where(eq(passes.merchantId, merchant.id));

  // 2. Total histórico de sellos del comercio
  const [sellosTotalResult] = await db
    .select({ total: count() })
    .from(stamps)
    .where(eq(stamps.merchantId, merchant.id));

  // 3. Sellos otorgados hoy
  const [sellosHoyResult] = await db
    .select({ total: count() })
    .from(stamps)
    .where(
      and(
        eq(stamps.merchantId, merchant.id),
        gte(stamps.createdAt, startOfDay),
      ),
    );

  const payload = {
    pasesEmitidos: Number(pasesResult?.total ?? 0),
    sellosHoy: Number(sellosHoyResult?.total ?? 0),
    sellosTotal: Number(sellosTotalResult?.total ?? 0),
  };

  // Validación con contrato Zod antes de responder
  const validated = dashboardResumenSchema.parse(payload);
  return NextResponse.json(validated);
}
