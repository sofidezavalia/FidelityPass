import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Tablas requeridas por Better Auth (PostgreSQL adapter)
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tiers de negocio: $19.900 / $39.900 / $79.900 ARS
export const tierEnum = pgEnum("tier", ["basico", "medio", "premium"]);

// Perfil del comercio, vinculado 1 a 1 con el user de auth
export const merchants = pgTable("merchants", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  tier: tierEnum("tier").notNull().default("basico"),
  emailContacto: text("email_contacto").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// customers: clientes finales. El nombre es visible en el pase (anti-fraude).
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// staff: empleados/cajeros del comercio.
export const staff = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id")
    .notNull()
    .references(() => merchants.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  pin: text("pin").notNull(), // hash se implementa en PR-06
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// passEstadoEnum: estado de la tarjeta de fidelidad
export const passEstadoEnum = pgEnum("pass_estado", ["activa", "inactiva"]);

// passes: tarjetas de fidelidad emitidas.
export const passes = pgTable(
  "passes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    serialNumber: text("serial_number").notNull().unique(), // lo genera PR de emisión
    googleWalletObjectId: text("google_wallet_object_id"), // lo completa PR-04
    estado: passEstadoEnum("estado").notNull().default("activa"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("passes_merchant_id_idx").on(table.merchantId)],
);

// stamps: sellos otorgados. INMUTABLE: sin updates ni deletes.
export const stamps = pgTable(
  "stamps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "set null",
    }), // nullable en el piloto: el dueño sella directo
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("stamps_merchant_id_idx").on(table.merchantId),
    index("stamps_pass_id_idx").on(table.passId),
    index("stamps_created_at_idx").on(table.createdAt),
  ],
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Pass = typeof passes.$inferSelect;
export type Stamp = typeof stamps.$inferSelect;
