import {
  customers,
  db,
  passes,
  pointsLedger,
  redemptions,
  saludosCumple,
  stamps,
} from "@fidelitypass/db";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Borrado en cascada de los datos del cliente para un comercio dado.
 *
 * Tablas afectadas:
 * - stamps
 * - points_ledger
 * - redemptions
 * - saludos_cumple
 * - passes
 * - customers (si no le quedan pases en otros comercios)
 *
 * NOTA LEGAL / EXCEPCIÓN FISCAL:
 * Excepción: lo exigible por facturación y obligaciones impositivas/legales de conservación.
 * En la actualidad, la facturación del comercio es manual y externa a esta plataforma,
 * por lo que no retenemos comprobantes fiscales ni facturas emitidas.
 */
export async function cascadeDeleteCustomerData(
  customerId: string,
  merchantId: string,
): Promise<void> {
  // 1. Obtener los pases del cliente para este comercio
  const customerPasses = await db
    .select({ id: passes.id })
    .from(passes)
    .where(
      and(eq(passes.customerId, customerId), eq(passes.merchantId, merchantId)),
    );

  const passIds = customerPasses.map((p) => p.id);

  if (passIds.length > 0) {
    // 2. Borrar sellos de estos pases
    await db.delete(stamps).where(inArray(stamps.passId, passIds));

    // 3. Borrar movimientos de puntos de estos pases
    await db.delete(pointsLedger).where(inArray(pointsLedger.passId, passIds));

    // 4. Borrar canjes de estos pases
    await db.delete(redemptions).where(inArray(redemptions.passId, passIds));

    // 5. Borrar pases del comercio
    await db
      .delete(passes)
      .where(
        and(
          eq(passes.customerId, customerId),
          eq(passes.merchantId, merchantId),
        ),
      );
  }

  // 6. Borrar registros de saludos de cumpleaños
  await db
    .delete(saludosCumple)
    .where(eq(saludosCumple.customerId, customerId));

  // 7. Verificar si el cliente tiene pases asociados a otros comercios
  const remainingPasses = await db
    .select({ id: passes.id })
    .from(passes)
    .where(eq(passes.customerId, customerId))
    .limit(1);

  // Si no tiene más pases en ningún comercio, eliminamos el registro del cliente
  if (remainingPasses.length === 0) {
    await db.delete(customers).where(eq(customers.id, customerId));
  }
}
