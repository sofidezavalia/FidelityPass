import { emitirPaseSchema, paseEmitidoSchema } from "@fidelitypass/contracts";
import {
  customers,
  db,
  merchants,
  passes,
  pointsLedger,
  stamps,
} from "@fidelitypass/db";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { generateUniqueCodigoCorto } from "../../../../lib/passes";
import {
  isGoogleWalletConfigured,
  issuePass,
} from "../../../../lib/wallet/google";

/**
 * POST /api/pases/emitir (público)
 * Emite una tarjeta de fidelidad digital para Google Wallet con teléfono,
 * consentimiento de marketing, código corto de 6 caracteres y bono de bienvenida.
 */
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

  // 1. Validación de entrada con Zod
  const validation = emitirPaseSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const {
    merchantId,
    nombreCliente,
    email,
    telefono,
    consentimientoMarketing,
  } = validation.data;

  // 2. Patrón "integración dormida": si las credenciales no están presentes, falla con 503 sin tocar la DB
  if (!isGoogleWalletConfigured()) {
    return NextResponse.json(
      { error: "Google Wallet no está configurado todavía" },
      { status: 503 },
    );
  }

  // 3. Buscar comercio en la base de datos
  const [merchant] = await db
    .select({
      id: merchants.id,
      nombre: merchants.nombre,
      logoUrl: merchants.logoUrl,
      colorPrimario: merchants.colorPrimario,
      colorSecundario: merchants.colorSecundario,
      bonoBienvenida: merchants.bonoBienvenida,
      modoAcumulacion: merchants.modoAcumulacion,
    })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);

  if (!merchant) {
    return NextResponse.json({ error: "Comercio inválido" }, { status: 400 });
  }

  const cleanEmail = email?.trim() ? email.toLowerCase().trim() : null;
  const cleanPhone = telefono?.trim() || null;
  const isMarketing = Boolean(consentimientoMarketing);

  // 4. Flujo de deduplicación por email: si el cliente ya tiene un pase para este comercio,
  // no se vuelve a acreditar el bono de bienvenida
  if (cleanEmail) {
    const [existingCustomer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, cleanEmail))
      .limit(1);

    if (existingCustomer) {
      const [existingPass] = await db
        .select()
        .from(passes)
        .where(
          and(
            eq(passes.merchantId, merchant.id),
            eq(passes.customerId, existingCustomer.id),
          ),
        )
        .limit(1);

      if (existingPass) {
        // Actualizamos teléfono o consentimiento si se enviaron
        await db
          .update(customers)
          .set({
            telefono: cleanPhone || existingCustomer.telefono,
            consentimientoMarketing:
              isMarketing || existingCustomer.consentimientoMarketing,
            marketingConsentAt: isMarketing
              ? new Date()
              : existingCustomer.marketingConsentAt,
          })
          .where(eq(customers.id, existingCustomer.id));

        const { saveUrl } = issuePass(
          {
            id: merchant.id,
            nombre: merchant.nombre,
            logoUrl: merchant.logoUrl,
            colorPrimario: merchant.colorPrimario,
            colorSecundario: merchant.colorSecundario,
          },
          { id: existingCustomer.id, nombre: existingCustomer.nombre },
        );

        const responsePayload = paseEmitidoSchema.parse({ saveUrl });
        return NextResponse.json(responsePayload, { status: 200 });
      }
    }
  }

  // 5. Crear cliente nuevo
  const [customer] = await db
    .insert(customers)
    .values({
      nombre: nombreCliente.trim(),
      email: cleanEmail,
      telefono: cleanPhone,
      consentimientoMarketing: isMarketing,
      marketingConsentAt: isMarketing ? new Date() : null,
    })
    .returning();

  if (!customer) {
    return NextResponse.json(
      { error: "Error al registrar cliente" },
      { status: 500 },
    );
  }

  // 6. Generar código corto único de 6 caracteres alfanuméricos sin ambiguos
  const codigoCorto = await generateUniqueCodigoCorto();

  const bono = merchant.bonoBienvenida ?? 0;

  // 7. Generar pase y firmado en Google Wallet
  const { saveUrl, googleWalletObjectId, serialNumber } = issuePass(
    {
      id: merchant.id,
      nombre: merchant.nombre,
      logoUrl: merchant.logoUrl,
      colorPrimario: merchant.colorPrimario,
      colorSecundario: merchant.colorSecundario,
    },
    { id: customer.id, nombre: customer.nombre },
    bono,
  );

  // 8. Guardar pase en la DB
  const [newPass] = await db
    .insert(passes)
    .values({
      merchantId: merchant.id,
      customerId: customer.id,
      serialNumber,
      codigoCorto,
      googleWalletObjectId,
      estado: "activa",
    })
    .returning();

  // 9. Acreditar bono de bienvenida si está configurado (> 0)
  if (bono > 0 && newPass) {
    if (merchant.modoAcumulacion === "puntos_por_monto") {
      await db.insert(pointsLedger).values({
        passId: newPass.id,
        merchantId: merchant.id,
        staffId: null,
        puntos: bono,
        montoCompra: null,
      });
    } else {
      const stampEntries = Array.from({ length: bono }, () => ({
        passId: newPass.id,
        merchantId: merchant.id,
        staffId: null,
      }));
      await db.insert(stamps).values(stampEntries);
    }
  }

  const responsePayload = paseEmitidoSchema.parse({ saveUrl });
  return NextResponse.json(responsePayload, { status: 201 });
}
