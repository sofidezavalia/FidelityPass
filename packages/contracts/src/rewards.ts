import { z } from "zod";

export {
  type ModoAcumulacion,
  type ModoAcumulacionInput,
  modoAcumulacionEnum,
  modoAcumulacionSchema,
  type ReglasInput,
  reglasSchema,
} from "./reglas";

export const rewardSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  descripcion: z.string().max(280).optional().or(z.literal("")),
  costo: z.number().int().min(1, "El costo debe ser de al menos 1"),
  activa: z.boolean().default(true),
});

export const rewardUpdateSchema = rewardSchema.partial();

export const canjearSchema = z.object({
  serialNumber: z.string().min(1, "El número de serie es obligatorio"),
  rewardId: z.string().uuid("ID de recompensa inválido"),
});

export type RewardInput = z.infer<typeof rewardSchema>;
export type RewardUpdateInput = z.infer<typeof rewardUpdateSchema>;
export type CanjearInput = z.infer<typeof canjearSchema>;
