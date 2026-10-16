import { defineConfig } from "drizzle-kit";

// TODO (PR posterior): definir el schema en ./src/schema.ts y descomentar dbCredentials.
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // url: process.env.DATABASE_URL!, // integración dormida hasta tener su env
    url: "",
  },
});
