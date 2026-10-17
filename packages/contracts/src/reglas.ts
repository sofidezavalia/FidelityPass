import { z } from "zod";

export const modoAcumulacionEnum = z.enum([
  "sello_por_visita",
  "sello_por_monto",
  "puntos_por_monto",
]);

export const modoAcumulacionSchema = z
  .object({
    modoAcumulacion: modoAcumulacionEnum,
    montoMinimoSello: z
      .number()
      .positive("El monto mínimo debe ser mayor a 0")
      .optional()
      .nullable(),
    montoPorSello: z
      .number()
      .positive("El monto por sello debe ser mayor a 0")
      .optional()
      .nullable(),
    puntosPorUnidad: z
      .number()
      .positive("Los puntos por unidad deben ser mayor a 0")
      .optional()
      .nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.modoAcumulacion === "sello_por_monto" && !v.montoPorSello) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Definí cada cuántos $ se gana un sello",
      });
    }
    if (v.modoAcumulacion === "puntos_por_monto" && !v.puntosPorUnidad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Definí cuántos puntos se ganan por cada $1",
      });
    }
  });

export const reglasSchema = z
  .object({
    maxSellosPorDia: z
      .number()
      .int()
      .min(1, "Mínimo 1 sello")
      .max(10, "Máximo 10 sellos")
      .optional(),
    modoAcumulacion: modoAcumulacionEnum,
    montoMinimoSello: z
      .number()
      .positive("El monto mínimo debe ser mayor a 0")
      .optional()
      .nullable(),
    montoPorSello: z
      .number()
      .positive("El monto por sello debe ser mayor a 0")
      .optional()
      .nullable(),
    puntosPorUnidad: z
      .number()
      .positive("Los puntos por unidad deben ser mayor a 0")
      .optional()
      .nullable(),
    bonoBienvenida: z
      .number()
      .int()
      .min(0, "Mínimo 0 unidades")
      .default(0)
      .optional(),
    bonoCumpleanios: z
      .number()
      .int()
      .min(0, "Mínimo 0 unidades")
      .default(0)
      .optional(),
    pedirTicket: z.boolean().default(false).optional(),
    maxUnidadesPorTicket: z
      .number()
      .int()
      .positive("El tope debe ser mayor a 0")
      .optional()
      .nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.modoAcumulacion === "sello_por_monto" && !v.montoPorSello) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Definí cada cuántos $ se gana un sello",
      });
    }
    if (v.modoAcumulacion === "puntos_por_monto" && !v.puntosPorUnidad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Definí cuántos puntos se ganan por cada $1",
      });
    }
  });

export type ModoAcumulacion = z.infer<typeof modoAcumulacionEnum>;
export type ModoAcumulacionInput = z.infer<typeof modoAcumulacionSchema>;
export type ReglasInput = z.infer<typeof reglasSchema>;
