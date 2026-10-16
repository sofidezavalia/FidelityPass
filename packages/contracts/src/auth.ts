import { z } from "zod";

export const registerMerchantSchema = z.object({
  nombreComercio: z.string().min(2, "El nombre del comercio es obligatorio"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type RegisterMerchantInput = z.infer<typeof registerMerchantSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
