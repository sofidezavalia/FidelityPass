import {
  db,
  merchants,
  passes,
  pointsLedger,
  redemptions,
  stamps,
} from "@fidelitypass/db";
import { count, eq, sum } from "drizzle-orm";

export interface SaldoResult {
  unidad: "sellos" | "puntos";
  disponible: number;
  totalAcumulado: number;
  totalUsado: number;
}

/**
 * Helper getSaldo(passId, merchant)
 * Calcula el saldo disponible y total acumulado según el modo de acumulación del comercio.
 * Modo 1 (sello_por_visita) y Modo 2 (sello_por_monto):
 *   unidad = "sellos", disponible = count(stamps) − Σ(redemptions.unidadesUsadas)
 * Modo 3 (puntos_por_monto):
 *   unidad = "puntos", disponible = Σ(points_ledger.puntos) − Σ(redemptions.unidadesUsadas)
 */
export async function getSaldo(
  passId: string,
  merchant?: { id?: string; modoAcumulacion?: string | null } | string,
): Promise<SaldoResult> {
  let modoAcumulacion =
    typeof merchant === "object" && merchant !== null
      ? merchant.modoAcumulacion
      : null;

  if (!modoAcumulacion) {
    let merchantId: string | undefined;
    if (typeof merchant === "string") {
      merchantId = merchant;
    } else if (merchant?.id) {
      merchantId = merchant.id;
    } else {
      const [p] = await db
        .select({ merchantId: passes.merchantId })
        .from(passes)
        .where(eq(passes.id, passId))
        .limit(1);
      merchantId = p?.merchantId;
    }

    if (merchantId) {
      const [m] = await db
        .select({ modoAcumulacion: merchants.modoAcumulacion })
        .from(merchants)
        .where(eq(merchants.id, merchantId))
        .limit(1);
      modoAcumulacion = m?.modoAcumulacion;
    }
  }

  const isPuntos = modoAcumulacion === "puntos_por_monto";
  const unidad: "sellos" | "puntos" = isPuntos ? "puntos" : "sellos";

  let totalAcumulado = 0;
  if (isPuntos) {
    const [pts] = await db
      .select({ total: sum(pointsLedger.puntos) })
      .from(pointsLedger)
      .where(eq(pointsLedger.passId, passId));
    totalAcumulado = Number(pts?.total ?? 0);
  } else {
    const [st] = await db
      .select({ total: count() })
      .from(stamps)
      .where(eq(stamps.passId, passId));
    totalAcumulado = Number(st?.total ?? 0);
  }

  const [red] = await db
    .select({ total: sum(redemptions.unidadesUsadas) })
    .from(redemptions)
    .where(eq(redemptions.passId, passId));
  const totalUsado = Number(red?.total ?? 0);

  const disponible = Math.max(0, totalAcumulado - totalUsado);

  return {
    unidad,
    disponible,
    totalAcumulado,
    totalUsado,
  };
}
