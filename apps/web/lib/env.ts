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

  // Google Wallet — Patrón "integración dormida" (opcionales)
  GOOGLE_WALLET_ISSUER_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),

  // Apple Wallet (proveedor tercerizado en piloto) — Patrón "integración dormida"
  PASSES_PROVIDER_API_KEY: z.string().optional(),
  PASSES_PROVIDER_BASE_URL: z.string().url().optional(),

  // Object Storage (Neon / S3) — Patrón "integración dormida" (opcionales)
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
