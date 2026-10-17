import { db, generateCodigoCorto, passes } from "@fidelitypass/db";
import { eq } from "drizzle-orm";

/**
 * Genera un código corto único de 6 caracteres alfanuméricos sin ambiguos para un pase,
 * reintentando automáticamente en caso de colisión.
 */
export async function generateUniqueCodigoCorto(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCodigoCorto();
    const [existing] = await db
      .select({ id: passes.id })
      .from(passes)
      .where(eq(passes.codigoCorto, code))
      .limit(1);
    if (!existing) {
      return code;
    }
  }
  throw new Error("No se pudo generar un código corto único tras reintentos");
}
