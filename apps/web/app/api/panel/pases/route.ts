import { pasesListSchema } from "@fidelitypass/contracts";
import { customers, db, passes, pointsLedger, stamps } from "@fidelitypass/db";
import { count, desc, eq, sum } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";

export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  if (merchant.modoAcumulacion === "puntos_por_monto") {
    const rows = await db
      .select({
        id: passes.id,
        serialNumber: passes.serialNumber,
        codigoCorto: passes.codigoCorto,
        clienteNombre: customers.nombre,
        estado: passes.estado,
        esPrueba: passes.esPrueba,
        createdAt: passes.createdAt,
        puntosTotal: sum(pointsLedger.puntos),
      })
      .from(passes)
      .innerJoin(customers, eq(passes.customerId, customers.id))
      .leftJoin(pointsLedger, eq(pointsLedger.passId, passes.id))
      .where(eq(passes.merchantId, merchant.id))
      .groupBy(
        passes.id,
        passes.serialNumber,
        passes.codigoCorto,
        customers.nombre,
        passes.estado,
        passes.esPrueba,
        passes.createdAt,
      )
      .orderBy(desc(passes.createdAt));

    const payload = rows.map((r) => ({
      id: r.id,
      serialNumber: r.serialNumber,
      codigoCorto: r.codigoCorto,
      clienteNombre: r.clienteNombre,
      estado: r.estado,
      esPrueba: r.esPrueba,
      sellos: Number(r.puntosTotal ?? 0),
      createdAt: r.createdAt.toISOString(),
    }));

    const validated = pasesListSchema.parse(payload);
    return NextResponse.json(validated);
  }

  // Obtenemos los pases del comercio autenticado con su cliente y cantidad de sellos
  const rows = await db
    .select({
      id: passes.id,
      serialNumber: passes.serialNumber,
      codigoCorto: passes.codigoCorto,
      clienteNombre: customers.nombre,
      estado: passes.estado,
      esPrueba: passes.esPrueba,
      createdAt: passes.createdAt,
      sellosCount: count(stamps.id),
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .leftJoin(stamps, eq(stamps.passId, passes.id))
    .where(eq(passes.merchantId, merchant.id))
    .groupBy(
      passes.id,
      passes.serialNumber,
      passes.codigoCorto,
      customers.nombre,
      passes.estado,
      passes.esPrueba,
      passes.createdAt,
    )
    .orderBy(desc(passes.createdAt));

  const payload = rows.map((r) => ({
    id: r.id,
    serialNumber: r.serialNumber,
    codigoCorto: r.codigoCorto,
    clienteNombre: r.clienteNombre,
    estado: r.estado,
    esPrueba: r.esPrueba,
    sellos: Number(r.sellosCount),
    createdAt: r.createdAt.toISOString(),
  }));

  // Validación con contrato Zod antes de responder
  const validated = pasesListSchema.parse(payload);
  return NextResponse.json(validated);
}
