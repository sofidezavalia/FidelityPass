import { z } from "zod";

export const dashboardResumenSchema = z.object({
  pasesEmitidos: z.number().int().nonnegative(),
  sellosHoy: z.number().int().nonnegative(),
  sellosTotal: z.number().int().nonnegative(),
});

export const paseListItemSchema = z.object({
  id: z.string().uuid(),
  codigoCorto: z.string().optional(),
  clienteNombre: z.string(),
  estado: z.enum(["activa", "inactiva"]),
  sellos: z.number().int().nonnegative(),
  createdAt: z.string(), // ISO
});

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
