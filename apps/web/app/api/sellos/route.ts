import { sellarSchema, selloResultadoSchema } from "@fidelitypass/contracts";
import {
  customers,
  db,
  merchants,
  passes,
  pointsLedger,
  rewards,
  stamps,
  tickets,
} from "@fidelitypass/db";
import { and, count, eq, gte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getSaldo } from "../../../lib/saldo";
import { getAuthenticatedStaff } from "../../../lib/staff-auth";
import { notifyStampAdded } from "../../../lib/wallet/notifications";

/**
 * GET /api/sellos?serialNumber=...
 * Permite al empleado previsualizar el cliente, estado del pase, saldo disponible,
 * modo de acumulación y catálogo de recompensas canjeables antes de confirmar el sello o canje.
 */
export async function GET(request: NextRequest) {
  const staffSession = await getAuthenticatedStaff();
  if (!staffSession) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const serialNumber = searchParams.get("serialNumber")?.trim();
  const codigoCorto = searchParams.get("codigoCorto")?.trim();

  if (!serialNumber && !codigoCorto) {
    return NextResponse.json(
      { error: "Falta serialNumber o codigoCorto" },
      { status: 400 },
    );
  }

  const queryCondition = codigoCorto
    ? eq(passes.codigoCorto, codigoCorto.toUpperCase())
    : eq(passes.serialNumber, serialNumber ?? "");

  const [row] = await db
    .select({
      id: passes.id,
      merchantId: passes.merchantId,
      estado: passes.estado,
      serialNumber: passes.serialNumber,
      codigoCorto: passes.codigoCorto,
      clienteNombre: customers.nombre,
      modoAcumulacion: merchants.modoAcumulacion,
      montoMinimoSello: merchants.montoMinimoSello,
      montoPorSello: merchants.montoPorSello,
      puntosPorUnidad: merchants.puntosPorUnidad,
      maxSellosPorDia: merchants.maxSellosPorDia,
      pedirTicket: merchants.pedirTicket,
      maxUnidadesPorTicket: merchants.maxUnidadesPorTicket,
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .innerJoin(merchants, eq(passes.merchantId, merchants.id))
    .where(queryCondition)
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

  // 1. Verificamos los sellos otorgados hoy según la regla configurable (solo modos 1 y 2)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [sellosHoyResult] = await db
    .select({ total: count() })
    .from(stamps)
    .where(and(eq(stamps.passId, row.id), gte(stamps.createdAt, startOfDay)));

  const sellosHoy = Number(sellosHoyResult?.total ?? 0);
  const maxSellos = row.maxSellosPorDia ?? 1;

  // 2. Saldo disponible y total acumulado según el modo de acumulación
  const saldo = await getSaldo(row.id, row);

  // 3. Recompensas activas del comercio
  const activeRewards = await db
    .select({
      id: rewards.id,
      nombre: rewards.nombre,
      descripcion: rewards.descripcion,
      costo: rewards.costo,
    })
    .from(rewards)
    .where(
      and(
        eq(rewards.merchantId, staffSession.merchantId),
        eq(rewards.activa, true),
      ),
    )
    .orderBy(rewards.costo);

  const yaSelladoHoy =
    row.modoAcumulacion !== "puntos_por_monto" && sellosHoy >= maxSellos;

  return NextResponse.json({
    ok: true,
    passId: row.id,
    serialNumber: row.serialNumber,
    codigoCorto: row.codigoCorto,
    clienteNombre: row.clienteNombre,
    estado: row.estado,
    modoAcumulacion: row.modoAcumulacion,
    montoMinimoSello: row.montoMinimoSello
      ? Number(row.montoMinimoSello)
      : null,
    montoPorSello: row.montoPorSello ? Number(row.montoPorSello) : null,
    puntosPorUnidad: row.puntosPorUnidad ? Number(row.puntosPorUnidad) : null,
    unidad: saldo.unidad,
    totalAcumulado: saldo.totalAcumulado,
    sellosAcumulados: saldo.totalAcumulado,
    saldoDisponible: saldo.disponible,
    sellosHoy,
    maxSellosPorDia: maxSellos,
    yaSelladoHoy,
    pedirTicket: row.pedirTicket ?? false,
    maxUnidadesPorTicket: row.maxUnidadesPorTicket ?? null,
    recompensas: activeRewards.map((r) => ({
      ...r,
      costo: r.costo,
      sellosRequeridos: r.costo,
      canjeable: r.costo <= saldo.disponible,
    })),
  });
}

/**
 * POST /api/sellos
 * Suma sellos o puntos según el modelo de acumulación del comercio (PR-13).
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

  const { serialNumber, codigoCorto, monto, nroTicket } = validation.data;
  const ticketLimpio = nroTicket?.trim() || null;

  // 1. Buscamos el pase por codigoCorto o serialNumber con los datos del cliente y comercio
  const queryCondition = codigoCorto
    ? eq(passes.codigoCorto, codigoCorto.toUpperCase())
    : eq(passes.serialNumber, serialNumber ?? "");

  const [row] = await db
    .select({
      id: passes.id,
      merchantId: passes.merchantId,
      estado: passes.estado,
      serialNumber: passes.serialNumber,
      codigoCorto: passes.codigoCorto,
      googleWalletObjectId: passes.googleWalletObjectId,
      clienteNombre: customers.nombre,
      comercioNombre: merchants.nombre,
      modoAcumulacion: merchants.modoAcumulacion,
      montoMinimoSello: merchants.montoMinimoSello,
      montoPorSello: merchants.montoPorSello,
      puntosPorUnidad: merchants.puntosPorUnidad,
      maxSellosPorDia: merchants.maxSellosPorDia,
      pedirTicket: merchants.pedirTicket,
      maxUnidadesPorTicket: merchants.maxUnidadesPorTicket,
    })
    .from(passes)
    .innerJoin(customers, eq(passes.customerId, customers.id))
    .innerJoin(merchants, eq(passes.merchantId, merchants.id))
    .where(queryCondition)
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

  // Validación de ticket único y requerido (PR-17)
  if (row.pedirTicket && !ticketLimpio) {
    return NextResponse.json(
      { error: "El número de ticket es obligatorio" },
      { status: 422 },
    );
  }

  if (ticketLimpio) {
    const [existingTicket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        and(
          eq(tickets.merchantId, staffSession.merchantId),
          eq(tickets.nroTicket, ticketLimpio),
        ),
      )
      .limit(1);

    if (existingTicket) {
      return NextResponse.json(
        { error: "Este ticket ya fue cargado" },
        { status: 409 },
      );
    }
  }

  let unidadesOtorgadas = 0;
  let mensajeTope: string | undefined;
  let topeTicketAplicado = false;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // 2. Lógica según el modo de acumulación
  if (row.modoAcumulacion === "sello_por_visita") {
    const minMonto = row.montoMinimoSello ? Number(row.montoMinimoSello) : null;
    if (minMonto !== null && minMonto > 0) {
      if (
        monto === undefined ||
        monto === null ||
        Number.isNaN(monto) ||
        monto < minMonto
      ) {
        return NextResponse.json(
          { error: "La compra no alcanza el mínimo para ganar el sello" },
          { status: 422 },
        );
      }
    }

    const [sellosHoyResult] = await db
      .select({ total: count() })
      .from(stamps)
      .where(and(eq(stamps.passId, row.id), gte(stamps.createdAt, startOfDay)));
    const sellosHoy = Number(sellosHoyResult?.total ?? 0);
    const maxSellos = row.maxSellosPorDia ?? 1;

    if (sellosHoy >= maxSellos) {
      return NextResponse.json(
        {
          error:
            maxSellos === 1
              ? "Ya se sumó el sello de hoy para esta tarjeta"
              : `Ya se alcanzó el límite diario de ${maxSellos} sellos para esta tarjeta`,
        },
        { status: 409 },
      );
    }

    await db.insert(stamps).values({
      passId: row.id,
      staffId: staffSession.staffId,
      merchantId: staffSession.merchantId,
    });
    unidadesOtorgadas = 1;
  } else if (row.modoAcumulacion === "sello_por_monto") {
    if (monto === undefined || monto === null || Number.isNaN(monto)) {
      return NextResponse.json(
        { error: "El monto es obligatorio para este modo" },
        { status: 422 },
      );
    }

    const montoPorSello = Number(row.montoPorSello ?? 0);
    if (montoPorSello <= 0) {
      return NextResponse.json(
        { error: "El comercio no tiene configurado el monto por sello" },
        { status: 500 },
      );
    }

    let n = Math.floor(monto / montoPorSello);
    if (n === 0) {
      return NextResponse.json(
        { error: "El monto no alcanza para ningún sello" },
        { status: 422 },
      );
    }

    // Tope por ticket (PR-17)
    if (row.maxUnidadesPorTicket && n > row.maxUnidadesPorTicket) {
      n = row.maxUnidadesPorTicket;
      topeTicketAplicado = true;
      mensajeTope = `Se acreditaron ${n} sellos (tope de ${row.maxUnidadesPorTicket} por ticket)`;
    }

    const [sellosHoyResult] = await db
      .select({ total: count() })
      .from(stamps)
      .where(and(eq(stamps.passId, row.id), gte(stamps.createdAt, startOfDay)));
    const sellosHoy = Number(sellosHoyResult?.total ?? 0);
    const maxSellos = row.maxSellosPorDia ?? 1;

    if (sellosHoy >= maxSellos) {
      return NextResponse.json(
        {
          error: `Ya se alcanzó el límite diario de ${maxSellos} sellos para esta tarjeta`,
        },
        { status: 409 },
      );
    }

    let aOtorgar = n;
    if (sellosHoy + n > maxSellos) {
      aOtorgar = maxSellos - sellosHoy;
      mensajeTope = `Se acreditaron ${aOtorgar} sello${aOtorgar > 1 ? "s" : ""} (límite diario de ${maxSellos} sellos alcanzado)`;
    }

    const rows = Array.from({ length: aOtorgar }, () => ({
      passId: row.id,
      staffId: staffSession.staffId,
      merchantId: staffSession.merchantId,
    }));
    await db.insert(stamps).values(rows);
    unidadesOtorgadas = aOtorgar;
  } else if (row.modoAcumulacion === "puntos_por_monto") {
    if (monto === undefined || monto === null || Number.isNaN(monto)) {
      return NextResponse.json(
        { error: "El monto es obligatorio para este modo" },
        { status: 422 },
      );
    }

    const puntosPorUnidad = Number(row.puntosPorUnidad ?? 0);
    if (puntosPorUnidad <= 0) {
      return NextResponse.json(
        {
          error:
            "El comercio no tiene configurada la tasa de puntos por unidad",
        },
        { status: 500 },
      );
    }

    let p = Math.floor(monto * puntosPorUnidad);
    if (p === 0) {
      return NextResponse.json(
        { error: "El monto no alcanza para ningún punto" },
        { status: 422 },
      );
    }

    // Tope por ticket (PR-17)
    if (row.maxUnidadesPorTicket && p > row.maxUnidadesPorTicket) {
      p = row.maxUnidadesPorTicket;
      topeTicketAplicado = true;
      mensajeTope = `Se acreditaron ${p} puntos (tope de ${row.maxUnidadesPorTicket} por ticket)`;
    }

    await db.insert(pointsLedger).values({
      passId: row.id,
      merchantId: staffSession.merchantId,
      staffId: staffSession.staffId,
      puntos: p,
      montoCompra: monto.toString(),
    });
    unidadesOtorgadas = p;
  }

  // Registrar ticket usado si corresponde
  if (ticketLimpio) {
    try {
      await db.insert(tickets).values({
        merchantId: staffSession.merchantId,
        nroTicket: ticketLimpio,
      });
    } catch {
      return NextResponse.json(
        { error: "Este ticket ya fue cargado" },
        { status: 409 },
      );
    }
  }

  // 3. Calcular saldo actualizado
  const saldo = await getSaldo(row.id, row);

  // Hook post-sello: Notificación push
  notifyStampAdded({
    merchantNombre: row.comercioNombre,
    sellosAcumulados: saldo.totalAcumulado,
    googleWalletObjectId: row.googleWalletObjectId,
    serialNumber: row.serialNumber,
  }).catch((err) => {
    console.error("[Push] Error al enviar notificación:", err);
  });

  const resultado = {
    ok: true as const,
    clienteNombre: row.clienteNombre,
    unidad: saldo.unidad,
    sellosAcumulados:
      saldo.unidad === "sellos" ? saldo.totalAcumulado : undefined,
    puntosAcumulados:
      saldo.unidad === "puntos" ? saldo.totalAcumulado : undefined,
    saldoDisponible: saldo.disponible,
    unidadesOtorgadas,
    mensajeTope,
    topeAplicado: Boolean(topeTicketAplicado || mensajeTope),
    nroTicket: ticketLimpio ?? undefined,
  };

  const validated = selloResultadoSchema.parse(resultado);
  return NextResponse.json(validated, { status: 201 });
}
