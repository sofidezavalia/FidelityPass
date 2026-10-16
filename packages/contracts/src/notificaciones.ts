import { z } from "zod";

export const mensajeSelloSchema = z.object({
  titulo: z.string().min(1),
  cuerpo: z.string().min(1),
});

export type MensajeSello = z.infer<typeof mensajeSelloSchema>;
