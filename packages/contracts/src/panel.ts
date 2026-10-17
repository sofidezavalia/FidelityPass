import { z } from "zod";

export const dashboardResumenSchema = z.object({
  pasesEmitidos: z.number().int().nonnegative(),
  sellosHoy: z.number().int().nonnegative(),
  sellosTotal: z.number().int().nonnegative(),
});

export const paseListItemSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  serialNumber: z.string().optional(),
  codigoCorto: z.string().optional(),
  clienteNombre: z.string(),
  telefono: z.string().nullable().optional(),
  estado: z.enum(["activa", "inactiva"]),
  esPrueba: z.boolean().default(false),
  sellos: z.number().int().nonnegative(),
  createdAt: z.string(), // ISO
});

export const bajaDeDatosSchema = z.object({
  merchantId: z.string().uuid("Comercio inválido"),
  email: z.string().email("Email inválido"),
});

export const noQuieroPromosSchema = z.object({
  merchantId: z.string().uuid("Comercio inválido"),
  email: z.string().email("Email inválido"),
});

export type BajaDeDatosInput = z.infer<typeof bajaDeDatosSchema>;
export type NoQuieroPromosInput = z.infer<typeof noQuieroPromosSchema>;

export const selloListItemSchema = z.object({
  id: z.string().uuid(),
  clienteNombre: z.string(),
  otorgadoPor: z.string(), // nombre del staff o "Titular"
  createdAt: z.string(), // ISO
});

export const pasesListSchema = z.array(paseListItemSchema);
export const sellosListSchema = z.array(selloListItemSchema);

export type DashboardResumen = z.infer<typeof dashboardResumenSchema>;
export type PaseListItem = z.infer<typeof paseListItemSchema>;
export type SelloListItem = z.infer<typeof selloListItemSchema>;
