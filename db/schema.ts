import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  int,
  boolean,
  timestamp,
} from "drizzle-orm/mysql-core";

// Key-value settings (prices, contacts, telegram, admin password hash, texts)
export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Manual overrides for loft availability per date & slot
export const loftSlots = mysqlTable("loft_slots", {
  id: serial("id").primaryKey(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  slot: mysqlEnum("slot", ["day", "evening", "fullday"]).notNull(),
  status: mysqlEnum("status", ["available", "blocked"]).notNull(),
  note: varchar("note", { length: 255 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Booking requests from clients
export const bookings = mysqlTable("bookings", {
  id: serial("id").primaryKey(),
  type: mysqlEnum("type", ["loft", "coworking", "kids"]).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  slot: varchar("slot", { length: 20 }), // day/evening/fullday (loft)
  startTime: varchar("start_time", { length: 5 }), // HH:MM
  hours: int("hours"),
  guests: int("guests"),
  comment: text("comment"),
  status: mysqlEnum("status", ["new", "confirmed", "rejected"])
    .notNull()
    .default("new"),
  adminNote: varchar("admin_note", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Event announcements for the loft
export const events = mysqlTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  date: varchar("date", { length: 10 }).notNull(),
  time: varchar("time", { length: 5 }),
  price: varchar("price", { length: 60 }),
  imageUrl: varchar("image_url", { length: 500 }),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Coffee shop menu items
export const menuItems = mysqlTable("menu_items", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 80 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: varchar("description", { length: 300 }),
  volume: varchar("volume", { length: 30 }), // e.g. "350 мл"
  price: int("price").notNull(), // rubles
  imageUrl: varchar("image_url", { length: 500 }),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// Admin sessions (token auth for /admin)
export const adminSessions = mysqlTable("admin_sessions", {
  token: varchar("token", { length: 64 }).primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});
