import { canjearSchema } from "@fidelitypass/contracts";
import { db, passes, redemptions, rewards, stamps } from "@fidelitypass/db";
import { and, count, eq, sum } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedStaff } from "../../../lib/staff-auth";

/**
 * POST /api/canjes
 * Confirma el canje de una recompensa por parte del empleado.
 * Descuenta los sellos requeridos del saldo disponible registrando la redención.
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

  const validation = canjearSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        error:
          validation.error.issues[0]?.message || "Datos de canje inválidos",
      },
      { status: 400 },
    );
  }

  const { serialNumber, rewardId } = validation.data;

  // 1. Busca el pase por serialNumber (activo, del mismo comercio)
  const [pass] = await db
    .select({
      id: passes.id,
      merchantId: passes.merchantId,
      estado: passes.estado,
    })
    .from(passes)
    .where(eq(passes.serialNumber, serialNumber))
    .limit(1);

  if (!pass) {
    return NextResponse.json(
      { error: "Tarjeta no encontrada" },
      { status: 404 },
    );
  }

  if (pass.merchantId !== staffSession.merchantId) {
    return NextResponse.json(
      { error: "La tarjeta pertenece a otro comercio" },
      { status: 403 },
    );
  }

  if (pass.estado !== "activa") {
    return NextResponse.json(
      { error: "La tarjeta está inactiva" },
      { status: 403 },
    );
  }

  // 2. Busca la recompensa (activa, del mismo comercio)
  const [reward] = await db
    .select()
    .from(rewards)
    .where(
      and(
        eq(rewards.id, rewardId),
        eq(rewards.merchantId, staffSession.merchantId),
      ),
    )
    .limit(1);

  if (!reward?.activa) {
    return NextResponse.json(
      { error: "Recompensa no disponible" },
      { status: 404 },
    );
  }

  // 3. Calcula saldo disponible = sellos totales - sellos usados
  const [stampsCount] = await db
    .select({ total: count() })
    .from(stamps)
    .where(eq(stamps.passId, pass.id));
  const totalSellos = Number(stampsCount?.total ?? 0);

  const [redemptionsSum] = await db
    .select({ totalUsados: sum(redemptions.sellosUsados) })
    .from(redemptions)
    .where(eq(redemptions.passId, pass.id));
  const sellosUsados = Number(redemptionsSum?.totalUsados ?? 0);

  const saldoDisponible = Math.max(0, totalSellos - sellosUsados);

  if (saldoDisponible < reward.sellosRequeridos) {
    return NextResponse.json(
      { error: "No tiene sellos suficientes" },
      { status: 409 },
    );
  }

  // 4. Crea la fila en redemptions (inmutable)
  await db.insert(redemptions).values({
    passId: pass.id,
    rewardId: reward.id,
    staffId: staffSession.staffId,
    merchantId: staffSession.merchantId,
    sellosUsados: reward.sellosRequeridos,
  });

  const saldoRestante = saldoDisponible - reward.sellosRequeridos;

  return NextResponse.json(
    {
      ok: true,
      recompensa: reward.nombre,
      saldoRestante,
    },
    { status: 200 },
  );
}
