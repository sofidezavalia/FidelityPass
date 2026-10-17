import { z } from "zod";

export const emitirPaseSchema = z.object({
  merchantId: z.string().uuid("Comercio inválido"),
  nombreCliente: z.string().min(2, "Ingresá tu nombre").max(80),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z
    .string()
    .max(20)
    .regex(/^[+0-9 ()-]*$/, "Teléfono inválido")
    .optional()
    .or(z.literal("")),
  consentimientoMarketing: z.boolean().default(false),
});

export const paseEmitidoSchema = z.object({
  saveUrl: z.string().url(), // https://pay.google.com/gp/v/save/<jwt>
});

export const applePassResultSchema = z.object({
  downloadUrl: z.string().url(), // URL del .pkpass para descargar en el iPhone
});

export type EmitirPaseInput = z.infer<typeof emitirPaseSchema>;
export type PaseEmitidoOutput = z.infer<typeof paseEmitidoSchema>;
export type ApplePassResultOutput = z.infer<typeof applePassResultSchema>;
