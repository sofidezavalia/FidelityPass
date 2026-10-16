import {
  customers,
  db,
  merchants,
  passes,
  saludosCumple,
} from "@fidelitypass/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "../../../../lib/env";
import { sendBirthdayGreeting } from "../../../../lib/wallet/notifications";

// Job diario de felicitación de cumpleaños por notificación push
// Programado en vercel.json: { "crons": [{ "path": "/api/cron/cumpleanios", "schedule": "0 15 * * *" }] }
// Decisión de horario: 15:00 UTC = 12:00 del mediodía en Argentina (UTC-3).
// Las 12:00 del mediodía es un horario óptimo, cordial y no invasivo para recibir una notificación push
// en el smartphone felicitando al cliente e invitándolo a pasar por el comercio.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Verificación de autorización con CRON_SECRET (nunca exponer este endpoint sin auth)
  const authHeader = request.headers.get("authorization");
  const expectedSecret = env.CRON_SECRET || process.env.CRON_SECRET;

  if (
    !expectedSecret ||
    !authHeader ||
    authHeader !== `Bearer ${expectedSecret}`
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Determinación de la fecha actual en la zona horaria de Argentina (UTC-3)
  const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const now = new Date();
  const parts = formatter.formatToParts(now);
  const mesActual = Number(parts.find((p) => p.type === "month")?.value);
  const diaActual = Number(parts.find((p) => p.type === "day")?.value);
  const anioActual = Number(parts.find((p) => p.type === "year")?.value);

  // 3. Buscar clientes cuya fecha de nacimiento coincida en mes y día con hoy en Argentina
  const cumpleanieros = await db
    .select({
      id: customers.id,
      nombre: customers.nombre,
      fechaNacimiento: customers.fechaNacimiento,
    })
    .from(customers)
    .where(
      and(
        isNotNull(customers.fechaNacimiento),
        sql`EXTRACT(MONTH FROM ${customers.fechaNacimiento}::date) = ${mesActual}`,
        sql`EXTRACT(DAY FROM ${customers.fechaNacimiento}::date) = ${diaActual}`,
      ),
    );

  let saludosEnviados = 0;

  // 4. Procesar cada cliente cumpleañero
  for (const customer of cumpleanieros) {
    // Idempotencia: si ya existe fila en saludos_cumple para (customerId, año actual), saltear
    const yaSaludado = await db
      .select({ id: saludosCumple.id })
      .from(saludosCumple)
      .where(
        and(
          eq(saludosCumple.customerId, customer.id),
          eq(saludosCumple.anio, anioActual),
        ),
      )
      .limit(1);

    if (yaSaludado.length > 0) {
      continue;
    }

    // Buscar pases activos del cliente junto con el nombre del comercio
    const activePasses = await db
      .select({
        passId: passes.id,
        serialNumber: passes.serialNumber,
        googleWalletObjectId: passes.googleWalletObjectId,
        merchantNombre: merchants.nombre,
      })
      .from(passes)
      .innerJoin(merchants, eq(passes.merchantId, merchants.id))
      .where(
        and(eq(passes.customerId, customer.id), eq(passes.estado, "activa")),
      );

    if (activePasses.length === 0) {
      // Sin pases activos no se emite push
      continue;
    }

    // Enviar push a cada pase activo
    for (const pass of activePasses) {
      try {
        await sendBirthdayGreeting({
          customerNombre: customer.nombre,
          merchantNombre: pass.merchantNombre,
          googleWalletObjectId: pass.googleWalletObjectId,
          serialNumber: pass.serialNumber,
        });
      } catch (err) {
        console.error(
          `[Cron Cumpleaños] Error al enviar saludo a cliente ${customer.id}:`,
          err,
        );
      }
    }

    // Registrar en saludos_cumple (idempotencia anual garantizada)
    try {
      await db.insert(saludosCumple).values({
        customerId: customer.id,
        anio: anioActual,
      });
      saludosEnviados++;
    } catch (insertErr) {
      console.error(
        `[Cron Cumpleaños] Error al registrar saludo para cliente ${customer.id}:`,
        insertErr,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    fecha: `${anioActual}-${String(mesActual).padStart(2, "0")}-${String(diaActual).padStart(2, "0")}`,
    cumpleanierosEncontrados: cumpleanieros.length,
    saludosEnviados,
  });
}
