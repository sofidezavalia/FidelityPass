import { z } from "zod";

export const rewardSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  descripcion: z.string().max(280).optional().or(z.literal("")),
  sellosRequeridos: z.number().int().min(1, "Mínimo 1 sello"),
  activa: z.boolean().default(true),
});

export const rewardUpdateSchema = rewardSchema.partial();

export const canjearSchema = z.object({
  serialNumber: z.string().min(1, "El número de serie es obligatorio"),
  rewardId: z.string().uuid("ID de recompensa inválido"),
});

export const reglasSchema = z.object({
  maxSellosPorDia: z
    .number()
    .int()
    .min(1, "Mínimo 1 sello")
    .max(10, "Máximo 10 sellos"),
});

export type RewardInput = z.infer<typeof rewardSchema>;
export type RewardUpdateInput = z.infer<typeof rewardUpdateSchema>;
export type CanjearInput = z.infer<typeof canjearSchema>;
export type ReglasInput = z.infer<typeof reglasSchema>;
