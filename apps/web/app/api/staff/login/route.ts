import { staffLoginSchema } from "@fidelitypass/contracts";
import { db, staff } from "@fidelitypass/db";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  createStaffToken,
  STAFF_COOKIE_NAME,
  verifyPin,
} from "../../../../lib/staff-auth";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de solicitud inválido" },
      { status: 400 },
    );
  }

  const validation = staffLoginSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const { merchantId, pin } = validation.data;

  // Obtenemos los empleados del comercio especificado
  const staffMembers = await db
    .select()
    .from(staff)
    .where(eq(staff.merchantId, merchantId));

  let authenticatedStaff: typeof staff.$inferSelect | null = null;

  for (const member of staffMembers) {
    const isMatch = await verifyPin(pin, member.pin);
    if (isMatch) {
      authenticatedStaff = member;
      break;
    }
  }

  // Error genérico sin filtrar si el empleado o el comercio existen
  if (!authenticatedStaff) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  // Creamos el JWT firmado para la sesión de empleado
  const token = await createStaffToken({
    staffId: authenticatedStaff.id,
    merchantId: authenticatedStaff.merchantId,
    nombre: authenticatedStaff.nombre,
    rol: "staff",
  });

  const response = NextResponse.json({
    ok: true,
    staff: {
      id: authenticatedStaff.id,
      nombre: authenticatedStaff.nombre,
    },
  });

  // Cookie de sesión de 12 horas
  response.cookies.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });

  return response;
}
