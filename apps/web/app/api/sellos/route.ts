import { sellarSchema, selloResultadoSchema } from "@fidelitypass/contracts";
import {
  customers,
  db,
  merchants,
  passes,
  redemptions,
  rewards,
  stamps,
} from "@fidelitypass/db";
import { and, count, eq, gte, sum } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedStaff } from "../../../lib/staff-auth";
import { notifyStampAdded } from "../../../lib/wallet/notifications";

/**
 * GET /api/sellos?serialNumber=...
 * Permite al empleado previsualizar el cliente, estado del pase, saldo disponible
 * y catálogo de recompensas canjeables antes de confirmar el sello o canje.
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
      maxSellosPorDia: merchants.maxSellosPorDia,
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

  // 1. Verificamos los sellos otorgados hoy según la regla configurable
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [sellosHoyResult] = await db
    .select({ total: count() })
    .from(stamps)
    .where(and(eq(stamps.passId, row.id), gte(stamps.createdAt, startOfDay)));

  const sellosHoy = Number(sellosHoyResult?.total ?? 0);
  const maxSellos = row.maxSellosPorDia ?? 1;

  // 2. Sellos totales acumulados (inmutables)
  const [totalSellosResult] = await db
    .select({ total: count() })
    .from(stamps)
    .where(eq(stamps.passId, row.id));
  const totalSellos = Number(totalSellosResult?.total ?? 0);

  // 3. Sellos utilizados en canjes
  const [redemptionsSum] = await db
    .select({ totalUsados: sum(redemptions.sellosUsados) })
    .from(redemptions)
    .where(eq(redemptions.passId, row.id));
  const totalUsados = Number(redemptionsSum?.totalUsados ?? 0);

  // 4. Saldo disponible = sellos totales − Σ(redemptions.sellosUsados)
  const saldoDisponible = Math.max(0, totalSellos - totalUsados);

  // 5. Recompensas activas del comercio
  const activeRewards = await db
    .select({
      id: rewards.id,
      nombre: rewards.nombre,
      descripcion: rewards.descripcion,
      sellosRequeridos: rewards.sellosRequeridos,
    })
    .from(rewards)
    .where(
      and(
        eq(rewards.merchantId, staffSession.merchantId),
        eq(rewards.activa, true),
      ),
    )
    .orderBy(rewards.sellosRequeridos);

  return NextResponse.json({
    ok: true,
    passId: row.id,
    clienteNombre: row.clienteNombre,
    estado: row.estado,
    sellosAcumulados: totalSellos,
    saldoDisponible,
    sellosHoy,
    maxSellosPorDia: maxSellos,
    yaSelladoHoy: sellosHoy >= maxSellos,
    recompensas: activeRewards.map((r) => ({
      ...r,
      canjeable: r.sellosRequeridos <= saldoDisponible,
    })),
  });
}

/**
 * POST /api/sellos
 * Suma un sello a la tarjeta con validación anti-fraude según maxSellosPorDia configurable.
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
      maxSellosPorDia: merchants.maxSellosPorDia,
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

  // 2. Regla anti-fraude: configurable por comercio (merchants.maxSellosPorDia, default 1)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

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

  // 3. Crear el sello inmutable
  await db.insert(stamps).values({
    passId: row.id,
    staffId: staffSession.staffId,
    merchantId: staffSession.merchantId,
  });

  // 4. Calcular total actualizado de sellos
  const [totalResult] = await db
    .select({ total: count() })
    .from(stamps)
    .where(eq(stamps.passId, row.id));

  const sellosAcumulados = Number(totalResult?.total ?? 1);

  // 5. Calcular saldo disponible restando redenciones
  const [redemptionsSum] = await db
    .select({ totalUsados: sum(redemptions.sellosUsados) })
    .from(redemptions)
    .where(eq(redemptions.passId, row.id));
  const totalUsados = Number(redemptionsSum?.totalUsados ?? 0);
  const saldoDisponible = Math.max(0, sellosAcumulados - totalUsados);

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
    saldoDisponible,
  };

  const validated = selloResultadoSchema.parse(resultado);
  return NextResponse.json(validated, { status: 201 });
}
