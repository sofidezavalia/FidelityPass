import { z } from "zod";

export const campaniaEstadoEnum = z.enum(["borrador", "programada", "enviada"]);
export type CampaniaEstado = z.infer<typeof campaniaEstadoEnum>;

export const campaniaSchema = z
  .object({
    titulo: z
      .string()
      .min(2, "El título es obligatorio")
      .max(60, "El título no puede superar los 60 caracteres"),
    cuerpo: z
      .string()
      .min(2, "El mensaje es obligatorio")
      .max(280, "El mensaje no puede superar los 280 caracteres"),
    accion: z.enum(["borrador", "enviar", "programar"]).default("enviar"),
    programadaPara: z.string().datetime().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.accion === "programar") {
      if (!data.programadaPara) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha y hora son requeridas para programar",
          path: ["programadaPara"],
        });
      } else if (new Date(data.programadaPara).getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha programada debe ser futura",
          path: ["programadaPara"],
        });
      }
    }
  });

export type CampaniaInput = z.infer<typeof campaniaSchema>;

export const editarCampaniaSchema = z
  .object({
    titulo: z
      .string()
      .min(2, "El título es obligatorio")
      .max(60, "El título no puede superar los 60 caracteres")
      .optional(),
    cuerpo: z
      .string()
      .min(2, "El mensaje es obligatorio")
      .max(280, "El mensaje no puede superar los 280 caracteres")
      .optional(),
    programadaPara: z.string().datetime().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.programadaPara) {
      if (new Date(data.programadaPara).getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha programada debe ser futura",
          path: ["programadaPara"],
        });
      }
    }
  });

export type EditarCampaniaInput = z.infer<typeof editarCampaniaSchema>;

export const probarCampaniaSchema = z.object({
  serialNumber: z.string().min(1, "El serial o código es obligatorio"),
});

export type ProbarCampaniaInput = z.infer<typeof probarCampaniaSchema>;

export const campaniaListItemSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  cuerpo: z.string(),
  estado: campaniaEstadoEnum,
  programadaPara: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type CampaniaListItem = z.infer<typeof campaniaListItemSchema>;
