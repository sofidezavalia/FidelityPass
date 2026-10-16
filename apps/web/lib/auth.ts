import { db, merchants, schema } from "@fidelitypass/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "./env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          const body = context?.body as Record<string, unknown> | undefined;
          const nombreComercio =
            (typeof body?.nombreComercio === "string" &&
              body.nombreComercio.trim()) ||
            user.name ||
            "Comercio";

          await db.insert(merchants).values({
            userId: user.id,
            nombre: nombreComercio,
            tier: "basico",
            emailContacto: user.email,
          });
        },
      },
    },
  },
});

export type Auth = typeof auth;
