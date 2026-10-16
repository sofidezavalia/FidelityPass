import { z } from "zod";

export const emitirPaseSchema = z.object({
  merchantId: z.string().uuid("Comercio inválido"),
  nombreCliente: z.string().min(2, "Ingresá tu nombre").max(80),
});

export const paseEmitidoSchema = z.object({
  saveUrl: z.string().url(), // https://pay.google.com/gp/v/save/<jwt>
});

export type EmitirPaseInput = z.infer<typeof emitirPaseSchema>;
export type PaseEmitidoOutput = z.infer<typeof paseEmitidoSchema>;
