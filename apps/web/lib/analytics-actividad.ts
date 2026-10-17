import {
  customers,
  db,
  passes,
  pointsLedger,
  redemptions,
  rewards,
  staff,
  stamps,
} from "@fidelitypass/db";
import { and, eq, gte, ilike, lte } from "drizzle-orm";

export interface EventoActividadItem {
  id: string;
  fecha: string;
  timestamp: number;
  tipo: "emision" | "otorgamiento" | "canje";
  cliente: string;
  empleado: string | null;
  detalle: string;
  unidades: number;
}

export interface GetActividadOptions {
  merchantId: string;
  modoAcumulacion: string;
  desdeDate?: Date;
  hastaDate?: Date;
  q?: string;
}

/**
 * Obtiene la lista unificada y cronológica descendente de eventos del comercio:
 * 1. Emisión de pases
 * 2. Sellos o puntos otorgados
 * 3. Canjes de recompensas
 */
export async function getActividadEventos({
  merchantId,
  modoAcumulacion,
  desdeDate,
  hastaDate,
  q,
}: GetActividadOptions): Promise<EventoActividadItem[]> {
  const isPuntos = modoAcumulacion === "puntos_por_monto";
  const trimmedQ = q?.trim();

  // 1. Emisión de pases
  const passConditions = [eq(passes.merchantId, merchantId)];
  if (desdeDate) passConditions.push(gte(passes.createdAt, desdeDate));
  if (hastaDate) passConditions.push(lte(passes.createdAt, hastaDate));
  if (trimmedQ) passConditions.push(ilike(customers.nombre, `%${trimmedQ}%`));

  const passRows = await db
    .select({
      id: passes.id,
      createdAt: passes.createdAt,
      clienteNombre: customers.nombre,
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .where(and(...passConditions));

  const emisiones: EventoActividadItem[] = passRows.map((p) => ({
    id: `emision-${p.id}`,
    fecha: p.createdAt.toISOString(),
    timestamp: p.createdAt.getTime(),
    tipo: "emision",
    cliente: p.clienteNombre,
    empleado: null,
    detalle: "Emisión de pase",
    unidades: 0,
  }));

  // 2. Otorgamiento de sellos o puntos
  let otorgamientos: EventoActividadItem[] = [];

  if (isPuntos) {
    const pointsConditions = [eq(pointsLedger.merchantId, merchantId)];
    if (desdeDate)
      pointsConditions.push(gte(pointsLedger.createdAt, desdeDate));
    if (hastaDate)
      pointsConditions.push(lte(pointsLedger.createdAt, hastaDate));
    if (trimmedQ)
      pointsConditions.push(ilike(customers.nombre, `%${trimmedQ}%`));

    const pointsRows = await db
      .select({
        id: pointsLedger.id,
        createdAt: pointsLedger.createdAt,
        puntos: pointsLedger.puntos,
        montoCompra: pointsLedger.montoCompra,
        clienteNombre: customers.nombre,
        staffNombre: staff.nombre,
      })
      .from(pointsLedger)
      .innerJoin(passes, eq(pointsLedger.passId, passes.id))
      .innerJoin(customers, eq(passes.customerId, customers.id))
      .leftJoin(staff, eq(pointsLedger.staffId, staff.id))
      .where(and(...pointsConditions));

    otorgamientos = pointsRows.map((pt) => ({
      id: `punto-${pt.id}`,
      fecha: pt.createdAt.toISOString(),
      timestamp: pt.createdAt.getTime(),
      tipo: "otorgamiento",
      cliente: pt.clienteNombre,
      empleado: pt.staffNombre || "Titular",
      detalle: pt.montoCompra
        ? `Compra $${pt.montoCompra} (+${pt.puntos} pts)`
        : `+${pt.puntos} puntos`,
      unidades: pt.puntos,
    }));
  } else {
    const stampConditions = [eq(stamps.merchantId, merchantId)];
    if (desdeDate) stampConditions.push(gte(stamps.createdAt, desdeDate));
    if (hastaDate) stampConditions.push(lte(stamps.createdAt, hastaDate));
    if (trimmedQ)
      stampConditions.push(ilike(customers.nombre, `%${trimmedQ}%`));

    const stampRows = await db
      .select({
        id: stamps.id,
        createdAt: stamps.createdAt,
        clienteNombre: customers.nombre,
        staffNombre: staff.nombre,
      })
      .from(stamps)
      .innerJoin(passes, eq(stamps.passId, passes.id))
      .innerJoin(customers, eq(passes.customerId, customers.id))
      .leftJoin(staff, eq(stamps.staffId, staff.id))
      .where(and(...stampConditions));

    otorgamientos = stampRows.map((s) => ({
      id: `sello-${s.id}`,
      fecha: s.createdAt.toISOString(),
      timestamp: s.createdAt.getTime(),
      tipo: "otorgamiento",
      cliente: s.clienteNombre,
      empleado: s.staffNombre || "Titular",
      detalle: "1 sello otorgado",
      unidades: 1,
    }));
  }

  // 3. Canjes de recompensas
  const canjesConditions = [eq(redemptions.merchantId, merchantId)];
  if (desdeDate) canjesConditions.push(gte(redemptions.createdAt, desdeDate));
  if (hastaDate) canjesConditions.push(lte(redemptions.createdAt, hastaDate));
  if (trimmedQ) canjesConditions.push(ilike(customers.nombre, `%${trimmedQ}%`));

  const canjesRows = await db
    .select({
      id: redemptions.id,
      createdAt: redemptions.createdAt,
      unidadesUsadas: redemptions.unidadesUsadas,
      clienteNombre: customers.nombre,
      staffNombre: staff.nombre,
      rewardNombre: rewards.nombre,
    })
    .from(redemptions)
    .innerJoin(passes, eq(redemptions.passId, passes.id))
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .innerJoin(rewards, eq(redemptions.rewardId, rewards.id))
    .leftJoin(staff, eq(redemptions.staffId, staff.id))
    .where(and(...canjesConditions));

  const canjes: EventoActividadItem[] = canjesRows.map((c) => ({
    id: `canje-${c.id}`,
    fecha: c.createdAt.toISOString(),
    timestamp: c.createdAt.getTime(),
    tipo: "canje",
    cliente: c.clienteNombre,
    empleado: c.staffNombre || "Titular",
    detalle: c.rewardNombre,
    unidades: c.unidadesUsadas,
  }));

  // Unificar y ordenar descendente por timestamp
  const todos = [...emisiones, ...otorgamientos, ...canjes];
  todos.sort((a, b) => b.timestamp - a.timestamp);

  return todos;
}
