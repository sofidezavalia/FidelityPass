import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
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
  maxSellosPorDia: integer("max_sellos_por_dia").notNull().default(1),
  logoUrl: text("logo_url"), // nullable; URL pública del logo
  colorPrimario: text("color_primario"), // nullable; hex, ej. "#0A2540"
  colorSecundario: text("color_secundario"), // nullable; hex
  modoAcumulacion: text("modo_acumulacion")
    .notNull()
    .default("sello_por_visita"),
  // valores: 'sello_por_visita' | 'sello_por_monto' | 'puntos_por_monto'
  montoMinimoSello: numeric("monto_minimo_sello"), // modo 1: compra mínima para ganar el sello (null = sin mínimo)
  montoPorSello: numeric("monto_por_sello"), // modo 2: 1 sello cada X monto
  puntosPorUnidad: numeric("puntos_por_unidad"), // modo 3: N puntos por cada $1 (ej. 1)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// customers: clientes finales. El nombre es visible en el pase (anti-fraude).
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull(),
  email: text("email"),
  fechaNacimiento: date("fecha_nacimiento"),
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
    appleAuthToken: text("apple_auth_token"), // token de autenticación para webService de Apple Wallet
    estado: passEstadoEnum("estado").notNull().default("activa"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("passes_merchant_id_idx").on(table.merchantId)],
);

// appleDevices: dispositivos Apple Wallet registrados para recibir push vía webService
export const appleDevices = pgTable(
  "apple_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deviceLibraryIdentifier: text("device_library_identifier").notNull(),
    pushToken: text("push_token").notNull(),
    passTypeIdentifier: text("pass_type_identifier").notNull(),
    serialNumber: text("serial_number").notNull(),
    passId: uuid("pass_id").references(() => passes.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("apple_devices_device_idx").on(
      table.deviceLibraryIdentifier,
      table.passTypeIdentifier,
    ),
    index("apple_devices_serial_idx").on(table.serialNumber),
    unique("apple_device_registration_unique").on(
      table.deviceLibraryIdentifier,
      table.passTypeIdentifier,
      table.serialNumber,
    ),
  ],
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

// rewards: catálogo de recompensas del comercio
export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(), // ej. "Café gratis"
    descripcion: text("descripcion"),
    costo: integer("costo").notNull(), // ej. 10 sellos o puntos
    activa: boolean("activa").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("rewards_merchant_id_idx").on(table.merchantId)],
);

// redemptions: registro de canjes de recompensas.
export const redemptions = pgTable(
  "redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id, { onDelete: "cascade" }),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => rewards.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    unidadesUsadas: integer("unidades_usadas").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("redemptions_pass_id_idx").on(table.passId),
    index("redemptions_merchant_id_idx").on(table.merchantId),
  ],
);

// campanias: campañas de notificaciones push masivas enviadas por el comercio
export const campanias = pgTable(
  "campanias",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    cuerpo: text("cuerpo").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("campanias_merchant_id_idx").on(table.merchantId),
    index("campanias_created_at_idx").on(table.createdAt),
  ],
);

// saludos_cumple: registro de saludos automáticos de cumpleaños (idempotencia anual)
export const saludosCumple = pgTable(
  "saludos_cumple",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    anio: integer("anio").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("saludos_cumple_customer_anio").on(t.customerId, t.anio)],
);

// points_ledger: ledger inmutable de puntos acumulados por gasto (PR-13)
export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),
    staffId: uuid("staff_id").references(() => staff.id), // null = bono de bienvenida (PR-15)
    puntos: integer("puntos").notNull(),
    montoCompra: numeric("monto_compra"), // auditoría, nullable
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("points_ledger_pass_id_idx").on(table.passId),
    index("points_ledger_merchant_id_idx").on(table.merchantId),
  ],
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Pass = typeof passes.$inferSelect;
export type Stamp = typeof stamps.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;
export type Campania = typeof campanias.$inferSelect;
export type SaludoCumple = typeof saludosCumple.$inferSelect;
export type NewSaludoCumple = typeof saludosCumple.$inferInsert;
export type PointLedger = typeof pointsLedger.$inferSelect;
export type NewPointLedger = typeof pointsLedger.$inferInsert;
