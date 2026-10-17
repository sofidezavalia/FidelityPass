import { z } from "zod";

export const analyticsResumenQuerySchema = z.object({
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),
});

export const serieDiariaItemSchema = z.object({
  fecha: z.string(), // YYYY-MM-DD
  otorgadas: z.number().int().nonnegative(),
});

export const analyticsResumenSchema = z.object({
  miembrosActivos: z.number().int().nonnegative(),
  nuevosMiembros: z.number().int().nonnegative(),
  unidadesOtorgadas: z.number().int().nonnegative(),
  canjesRealizados: z.number().int().nonnegative(),
  tasaCanje: z.number().nonnegative(),
  tasaRetencion: z.number().nonnegative().default(0),
  unidad: z.enum(["sellos", "puntos"]),
  serieDiaria: z.array(serieDiariaItemSchema),
});

export const actividadQuerySchema = z.object({
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
});

export const eventoActividadSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  tipo: z.enum(["emision", "otorgamiento", "canje"]),
  cliente: z.string(),
  empleado: z.string().nullable(),
  detalle: z.string(),
  unidades: z.number().int().nonnegative(),
});

export const actividadListSchema = z.object({
  eventos: z.array(eventoActividadSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type AnalyticsResumenQuery = z.infer<typeof analyticsResumenQuerySchema>;
export type SerieDiariaItem = z.infer<typeof serieDiariaItemSchema>;
export type AnalyticsResumen = z.infer<typeof analyticsResumenSchema>;
export type ActividadQuery = z.infer<typeof actividadQuerySchema>;
export type EventoActividad = z.infer<typeof eventoActividadSchema>;
export type ActividadList = z.infer<typeof actividadListSchema>;
