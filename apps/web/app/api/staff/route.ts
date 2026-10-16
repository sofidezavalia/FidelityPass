import { crearStaffSchema } from "@fidelitypass/contracts";
import { db, staff } from "@fidelitypass/db";
import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../lib/get-authenticated-merchant";
import { hashPin } from "../../../lib/staff-auth";

export async function GET() {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  const staffList = await db
    .select({
      id: staff.id,
      nombre: staff.nombre,
      createdAt: staff.createdAt,
    })
    .from(staff)
    .where(eq(staff.merchantId, merchant.id))
    .orderBy(desc(staff.createdAt));

  return NextResponse.json({
    merchantId: merchant.id,
    staff: staffList,
  });
}

export async function POST(request: NextRequest) {
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

  const validation = crearStaffSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const { nombre, pin } = validation.data;
  // Hasheado con bcrypt (cost 10) según requerimiento de seguridad
  const hashedPin = await hashPin(pin);

  const [newStaff] = await db
    .insert(staff)
    .values({
      merchantId: merchant.id,
      nombre,
      pin: hashedPin,
    })
    .returning({
      id: staff.id,
      nombre: staff.nombre,
    });

  return NextResponse.json(newStaff, { status: 201 });
}
