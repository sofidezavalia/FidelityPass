import { sellarSchema, selloResultadoSchema } from "@fidelitypass/contracts";
import { customers, db, merchants, passes, stamps } from "@fidelitypass/db";
import { and, count, eq, gte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedStaff } from "../../../lib/staff-auth";
import { notifyStampAdded } from "../../../lib/wallet/notifications";

/**
 * GET /api/sellos?serialNumber=...
 * Permite al empleado previsualizar el cliente y estado del pase antes de confirmar el sello.
 */
export async function GET(request: NextRequest) {
  const staffSession = await getAuthenticatedStaff();
  if (!staffSession) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const serialNumber = searchParams.get("serialNumber");

  if (!serialNumber) {
    return NextResponse.json({ error: "Falta serialNumber" }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: passes.id,
      merchantId: passes.merchantId,
      estado: passes.estado,
      clienteNombre: customers.nombre,
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .where(eq(passes.serialNumber, serialNumber))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "Tarjeta no encontrada" },
      { status: 404 },
    );
  }

  if (row.merchantId !== staffSession.merchantId) {
    return NextResponse.json(
      { error: "La tarjeta pertenece a otro comercio" },
      { status: 403 },
    );
  }

  if (row.estado !== "activa") {
    return NextResponse.json(
      { error: "La tarjeta está inactiva" },
      { status: 403 },
    );
  }

  // Verificamos si ya tiene sello hoy
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [selloHoy] = await db
    .select({ id: stamps.id })
    .from(stamps)
    .where(and(eq(stamps.passId, row.id), gte(stamps.createdAt, startOfDay)))
    .limit(1);

  const [totalSellos] = await db
    .select({ total: count() })
    .from(stamps)
    .where(eq(stamps.passId, row.id));

  return NextResponse.json({
    ok: true,
    passId: row.id,
    clienteNombre: row.clienteNombre,
    estado: row.estado,
    sellosAcumulados: Number(totalSellos?.total ?? 0),
    yaSelladoHoy: Boolean(selloHoy),
  });
}

/**
 * POST /api/sellos
 * Suma un sello a la tarjeta con validación anti-fraude (máx. 1 sello diario).
 */
export async function POST(request: NextRequest) {
  const staffSession = await getAuthenticatedStaff();
  if (!staffSession) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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

  const validation = sellarSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "QR inválido" },
      { status: 400 },
    );
  }

  const { serialNumber } = validation.data;

  // 1. Buscamos el pase por serialNumber con los datos del cliente y comercio
  const [row] = await db
    .select({
      id: passes.id,
      merchantId: passes.merchantId,
      estado: passes.estado,
      serialNumber: passes.serialNumber,
      googleWalletObjectId: passes.googleWalletObjectId,
      clienteNombre: customers.nombre,
      comercioNombre: merchants.nombre,
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .innerJoin(merchants, eq(passes.merchantId, merchants.id))
    .where(eq(passes.serialNumber, serialNumber))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "Tarjeta no encontrada" },
      { status: 404 },
    );
  }

  if (row.merchantId !== staffSession.merchantId) {
    return NextResponse.json(
      { error: "La tarjeta pertenece a otro comercio" },
      { status: 403 },
    );
  }

  if (row.estado !== "activa") {
    return NextResponse.json(
      { error: "La tarjeta está inactiva" },
      { status: 403 },
    );
  }

  // 2. Regla anti-fraude: máximo 1 sello por tarjeta por día
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [selloHoy] = await db
    .select({ id: stamps.id })
    .from(stamps)
    .where(and(eq(stamps.passId, row.id), gte(stamps.createdAt, startOfDay)))
    .limit(1);

  if (selloHoy) {
    return NextResponse.json(
      { error: "Ya se sumó el sello de hoy para esta tarjeta" },
      { status: 409 },
    );
  }

  // 3. Crear el sello inmutable
  await db.insert(stamps).values({
    passId: row.id,
    staffId: staffSession.staffId,
    merchantId: staffSession.merchantId,
  });

  // 4. Calcular total actualizado
  const [totalResult] = await db
    .select({ total: count() })
    .from(stamps)
    .where(eq(stamps.passId, row.id));

  const sellosAcumulados = Number(totalResult?.total ?? 1);

  // Hook post-sello: Notificación push transaccional (Google Messages API + Apple Wallet vía protocolo webService)
  notifyStampAdded({
    merchantNombre: row.comercioNombre,
    sellosAcumulados,
    googleWalletObjectId: row.googleWalletObjectId,
    serialNumber: row.serialNumber,
  }).catch((err) => {
    console.error("[Push] Error al enviar notificación:", err);
  });

  const resultado = {
    ok: true as const,
    clienteNombre: row.clienteNombre,
    sellosAcumulados,
  };

  const validated = selloResultadoSchema.parse(resultado);
  return NextResponse.json(validated, { status: 201 });
}
