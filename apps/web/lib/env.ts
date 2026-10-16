import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(
      1,
      "Falta DATABASE_URL: pedila en el dashboard de Neon (paso 1 de este spec)",
    ),
  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      "Falta BETTER_AUTH_SECRET: generala con `openssl rand -base64 32`",
    ),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  // En producción (Vercel) BETTER_AUTH_URL debe ser la URL real del deploy.
});

export const env = envSchema.parse(process.env);
