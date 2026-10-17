import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido (formato #RRGGBB)");

export const personalizacionSchema = z.object({
  logoUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  heroUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  colorPrimario: hexColor.optional().or(z.literal("")),
  colorSecundario: hexColor.optional().or(z.literal("")),
});

export type PersonalizacionInput = z.infer<typeof personalizacionSchema>;
