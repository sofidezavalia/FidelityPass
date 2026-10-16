import { z } from "zod";

export const crearStaffSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  pin: z.string().regex(/^\d{4,6}$/, "El PIN debe tener entre 4 y 6 dígitos"),
});

export const staffLoginSchema = z.object({
  merchantId: z.string().uuid("Comercio inválido"),
  pin: z.string().min(4, "PIN inválido"),
});

export const sellarSchema = z.object({
  serialNumber: z.string().min(1, "QR inválido"),
});

export const selloResultadoSchema = z.object({
  ok: z.literal(true),
  clienteNombre: z.string(),
  sellosAcumulados: z.number().int().nonnegative(),
  saldoDisponible: z.number().int().nonnegative().optional(),
});

export type CrearStaffInput = z.infer<typeof crearStaffSchema>;
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;
export type SellarInput = z.infer<typeof sellarSchema>;
export type SelloResultado = z.infer<typeof selloResultadoSchema>;
