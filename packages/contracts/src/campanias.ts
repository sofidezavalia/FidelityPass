import { z } from "zod";

export const campaniaSchema = z.object({
  titulo: z
    .string()
    .min(2, "El título es obligatorio")
    .max(60, "El título no puede superar los 60 caracteres"),
  cuerpo: z
    .string()
    .min(2, "El mensaje es obligatorio")
    .max(280, "El mensaje no puede superar los 280 caracteres"),
});

export type CampaniaInput = z.infer<typeof campaniaSchema>;
