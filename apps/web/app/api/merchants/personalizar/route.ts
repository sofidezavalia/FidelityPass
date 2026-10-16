import { personalizacionSchema } from "@fidelitypass/contracts";
import { db, merchants } from "@fidelitypass/db";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../lib/get-authenticated-merchant";
import { isStorageConfigured } from "../../../../lib/storage";

/**
 * GET /api/merchants/personalizar
 * Retorna la personalización actual del comercio y si el storage está activo.
 */
export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  return NextResponse.json({
    logoUrl: merchant.logoUrl || "",
    colorPrimario: merchant.colorPrimario || "",
    colorSecundario: merchant.colorSecundario || "",
    isStorageConfigured: isStorageConfigured(),
  });
}

/**
 * PATCH /api/merchants/personalizar
 * Guarda logo y colores personalizados para la tarjeta del comercio.
 * Sesión de comercio requerida. El merchantId se obtiene siempre de la sesión.
 */
export async function PATCH(request: NextRequest) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
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

  // 1. Validación estricta con Zod (color hex #RRGGBB o vacío, URL válida o vacía)
  const validation = personalizacionSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const { logoUrl, colorPrimario, colorSecundario } = validation.data;

  // 2. Actualizamos la fila del comercio autenticado
  const [updated] = await db
    .update(merchants)
    .set({
      logoUrl: logoUrl ? logoUrl.trim() : null,
      colorPrimario: colorPrimario ? colorPrimario.trim() : null,
      colorSecundario: colorSecundario ? colorSecundario.trim() : null,
    })
    .where(eq(merchants.id, merchant.id))
    .returning({
      id: merchants.id,
      nombre: merchants.nombre,
      logoUrl: merchants.logoUrl,
      colorPrimario: merchants.colorPrimario,
      colorSecundario: merchants.colorSecundario,
    });

  return NextResponse.json(updated, { status: 200 });
}
