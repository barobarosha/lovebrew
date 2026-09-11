/**
 * Идемпотентная инициализация БД при первом запуске на новом хостинге.
 *
 * В отличие от `drizzle-kit push` (который падает на уже существующих
 * таблицах/ключах), этот скрипт использует CREATE TABLE IF NOT EXISTS и
 * ADD COLUMN только для отсутствующих колонок — безопасно запускать
 * при КАЖДОМ старте контейнера.
 *
 * Запуск: npm run db:bootstrap
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан — создай .env по образцу .env.example");
  process.exit(1);
}

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
    \`key\` VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS loft_slots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    date VARCHAR(10) NOT NULL,
    slot ENUM('day','evening','fullday') NOT NULL,
    status ENUM('available','blocked') NOT NULL,
    note VARCHAR(255),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type ENUM('loft','coworking','kids') NOT NULL,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    date VARCHAR(10) NOT NULL,
    slot VARCHAR(20),
    start_time VARCHAR(5),
    hours INT,
    guests INT,
    comment TEXT,
    status ENUM('new','confirmed','rejected') NOT NULL DEFAULT 'new',
    admin_note VARCHAR(255),
    customer_id INT,
    source VARCHAR(10) NOT NULL DEFAULT 'site',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    date VARCHAR(10) NOT NULL,
    time VARCHAR(5),
    price VARCHAR(60),
    image_url VARCHAR(500),
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS menu_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(80) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(300),
    volume VARCHAR(30),
    price INT NOT NULL,
    image_url VARCHAR(500),
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
  )`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    token VARCHAR(64) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    qr_customer_guid VARCHAR(80),
    role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY customers_phone_unique (phone)
  )`,
  `CREATE TABLE IF NOT EXISTS customer_sessions (
    token VARCHAR(64) PRIMARY KEY,
    customer_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS otp_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    session_key VARCHAR(64),
    event VARCHAR(60) NOT NULL,
    meta TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS event_registrations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    customer_id INT,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    status ENUM('new','confirmed','rejected') NOT NULL DEFAULT 'new',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

// Колонки, которые могли появиться позже у существующих таблиц
const LATE_COLUMNS: { table: string; column: string; ddl: string }[] = [
  {
    table: "bookings",
    column: "customer_id",
    ddl: "ALTER TABLE bookings ADD COLUMN customer_id INT",
  },
  {
    table: "bookings",
    column: "source",
    ddl: "ALTER TABLE bookings ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'site'",
  },
  {
    table: "events",
    column: "registration_open",
    ddl: "ALTER TABLE events ADD COLUMN registration_open BOOLEAN NOT NULL DEFAULT FALSE",
  },
];

// Колонки, тип которых мог измениться (VARCHAR → TEXT для data-URI картинок)
const LATE_MODIFIES: { table: string; column: string; ddl: string }[] = [
  {
    table: "menu_items",
    column: "image_url",
    ddl: "ALTER TABLE menu_items MODIFY COLUMN image_url TEXT",
  },
  {
    table: "events",
    column: "image_url",
    ddl: "ALTER TABLE events MODIFY COLUMN image_url TEXT",
  },
];

async function main() {
  const conn = await mysql.createConnection(url!);
  for (const q of DDL) {
    await conn.query(q);
  }
  for (const c of LATE_COLUMNS) {
    const [cols] = await conn.query(`SHOW COLUMNS FROM ${c.table}`);
    const names = (cols as { Field: string }[]).map((r) => r.Field);
    if (!names.includes(c.column)) {
      await conn.query(c.ddl);
      console.log(`+ колонка ${c.table}.${c.column}`);
    }
  }
  for (const m of LATE_MODIFIES) {
    const [cols] = await conn.query(`SHOW COLUMNS FROM ${m.table}`);
    const col = (cols as { Field: string; Type: string }[]).find(
      (r) => r.Field === m.column,
    );
    if (col && !col.Type.toLowerCase().startsWith("text")) {
      await conn.query(m.ddl);
      console.log(`~ тип ${m.table}.${m.column} → TEXT`);
    }
  }
  console.log("Схема БД готова");
  await conn.end();
}

main().catch((e) => {
  console.error("Ошибка инициализации БД:", e.message);
  process.exit(1);
});
