import { miTurnoSchema } from "@fidelitypass/contracts";
import {
  customers,
  db,
  merchants,
  passes,
  pointsLedger,
  redemptions,
  stamps,
} from "@fidelitypass/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthenticatedStaff } from "../../../../lib/staff-auth";

function formatHaceCuanto(date: Date): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 1) return "recién";
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "hace 1 hora";
  if (diffHours < 24) return `hace ${diffHours} horas`;
  return "hoy";
}

interface OperacionItem {
  cliente: string;
  fecha: Date;
  unidades: number;
}

/**
 * GET /api/empleado/mi-turno
 * Resumen de hoy para el empleado autenticado: operaciones, unidades otorgadas y última operación.
 */
export async function GET() {
  const staffSession = await getAuthenticatedStaff();
  if (!staffSession) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [merchant] = await db
    .select({
      modoAcumulacion: merchants.modoAcumulacion,
    })
    .from(merchants)
    .where(eq(merchants.id, staffSession.merchantId))
    .limit(1);

  const isPuntos = merchant?.modoAcumulacion === "puntos_por_monto";
  const unidad: "sellos" | "puntos" = isPuntos ? "puntos" : "sellos";

  const allOps: OperacionItem[] = [];

  let unidadesOtorgadas = 0;
  let countOtorgadas = 0;

  if (isPuntos) {
    const pointsRows = await db
      .select({
        puntos: pointsLedger.puntos,
        createdAt: pointsLedger.createdAt,
        clienteNombre: customers.nombre,
      })
      .from(pointsLedger)
      .innerJoin(passes, eq(pointsLedger.passId, passes.id))
      .innerJoin(customers, eq(passes.customerId, customers.id))
      .where(
        and(
          eq(pointsLedger.staffId, staffSession.staffId),
          gte(pointsLedger.createdAt, startOfDay),
        ),
      )
      .orderBy(desc(pointsLedger.createdAt));

    countOtorgadas = pointsRows.length;
    for (const r of pointsRows) {
      unidadesOtorgadas += r.puntos;
      allOps.push({
        cliente: r.clienteNombre,
        fecha: r.createdAt,
        unidades: r.puntos,
      });
    }
  } else {
    const stampRows = await db
      .select({
        createdAt: stamps.createdAt,
        clienteNombre: customers.nombre,
      })
      .from(stamps)
      .innerJoin(passes, eq(stamps.passId, passes.id))
      .innerJoin(customers, eq(passes.customerId, customers.id))
      .where(
        and(
          eq(stamps.staffId, staffSession.staffId),
          gte(stamps.createdAt, startOfDay),
        ),
      )
      .orderBy(desc(stamps.createdAt));

    countOtorgadas = stampRows.length;
    unidadesOtorgadas = stampRows.length;
    for (const s of stampRows) {
      allOps.push({
        cliente: s.clienteNombre,
        fecha: s.createdAt,
        unidades: 1,
      });
    }
  }

  // Canjes realizados por el empleado hoy
  const redemptionRows = await db
    .select({
      unidadesUsadas: redemptions.unidadesUsadas,
      createdAt: redemptions.createdAt,
      clienteNombre: customers.nombre,
    })
    .from(redemptions)
    .innerJoin(passes, eq(redemptions.passId, passes.id))
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .where(
      and(
        eq(redemptions.staffId, staffSession.staffId),
        gte(redemptions.createdAt, startOfDay),
      ),
    )
    .orderBy(desc(redemptions.createdAt));

  for (const red of redemptionRows) {
    allOps.push({
      cliente: red.clienteNombre,
      fecha: red.createdAt,
      unidades: red.unidadesUsadas,
    });
  }

  allOps.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const operaciones = countOtorgadas + redemptionRows.length;

  const ultimaOperacion =
    allOps.length > 0 && allOps[0]
      ? {
          cliente: allOps[0].cliente,
          haceCuanto: formatHaceCuanto(allOps[0].fecha),
          unidades: allOps[0].unidades,
        }
      : null;

  const responsePayload = miTurnoSchema.parse({
    operaciones,
    unidadesOtorgadas,
    unidad,
    ultimaOperacion,
  });

  return NextResponse.json(responsePayload);
}
