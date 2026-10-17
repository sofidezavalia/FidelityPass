import { campanias, db } from "@fidelitypass/db";
import { and, eq, lte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "../../../../lib/env";
import { sendCampaign } from "../../../../lib/wallet/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Verificación de autorización con CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const expectedSecret = env.CRON_SECRET || process.env.CRON_SECRET;

  if (
    !expectedSecret ||
    !authHeader ||
    authHeader !== `Bearer ${expectedSecret}`
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();

  // 2. Buscar campañas programadas con programadaPara <= now
  const pendingCampaigns = await db
    .select({
      id: campanias.id,
      merchantId: campanias.merchantId,
      titulo: campanias.titulo,
      cuerpo: campanias.cuerpo,
    })
    .from(campanias)
    .where(
      and(
        eq(campanias.estado, "programada"),
        lte(campanias.programadaPara, now),
      ),
    );

  let procesadas = 0;

  // 3. Procesar cada campaña con idempotencia atómica
  for (const c of pendingCampaigns) {
    // Reclamar atómicamente la campaña actualizando su estado a 'enviada'
    // Si otra corrida concurrente ya la actualizó, update retornará 0 filas.
    const [claimed] = await db
      .update(campanias)
      .set({ estado: "enviada" })
      .where(and(eq(campanias.id, c.id), eq(campanias.estado, "programada")))
      .returning();

    if (!claimed) {
      // Ya fue tomada por otra corrida concurrente
      continue;
    }

    try {
      await sendCampaign({
        merchantId: claimed.merchantId,
        titulo: claimed.titulo,
        cuerpo: claimed.cuerpo,
      });
      procesadas++;
    } catch (err) {
      console.error(
        `[Cron Campañas] Error al enviar campaña programada ${c.id}:`,
        err,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    encontradas: pendingCampaigns.length,
    procesadas,
  });
}
