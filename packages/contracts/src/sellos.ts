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
  monto: z
    .number()
    .positive("El monto debe ser mayor a 0")
    .optional()
    .nullable(),
});

export const selloResultadoSchema = z.object({
  ok: z.literal(true),
  clienteNombre: z.string(),
  unidad: z.enum(["sellos", "puntos"]).optional(),
  sellosAcumulados: z.number().int().nonnegative().optional(),
  puntosAcumulados: z.number().int().nonnegative().optional(),
  saldoDisponible: z.number().int().nonnegative().optional(),
  unidadesOtorgadas: z.number().int().positive().optional(),
  mensajeTope: z.string().optional(),
});

export type CrearStaffInput = z.infer<typeof crearStaffSchema>;
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;
export type SellarInput = z.infer<typeof sellarSchema>;
export type SelloResultado = z.infer<typeof selloResultadoSchema>;
