import { db, merchants } from "@fidelitypass/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "./auth";

/**
 * Obtiene el comercio autenticado desde la sesión activa de Better Auth.
 * REGLA DE SEGURIDAD CRÍTICA:
 * El merchantId se obtiene SIEMPRE de la sesión del usuario verificado.
 * Nunca de query parameters ni de cuerpos de petición.
 */
export async function getAuthenticatedMerchant() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    return {
      errorResponse: NextResponse.json(
        { error: "No autorizado" },
        { status: 401 },
      ),
      merchant: null,
    };
  }

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.userId, session.user.id))
    .limit(1);

  if (!merchant) {
    return {
      errorResponse: NextResponse.json(
        { error: "Comercio no encontrado para el usuario" },
        { status: 404 },
      ),
      merchant: null,
    };
  }

  return { errorResponse: null, merchant };
}
