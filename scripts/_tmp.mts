import "dotenv/config";
import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
await conn.execute("INSERT INTO events (title, date, time, price, is_published, registration_open) VALUES ('ТЕСТ киновечер', '2026-09-25', '19:00', '500 ₽', 1, 1)");
const [r] = await conn.execute("SELECT LAST_INSERT_ID() AS id") as any;
console.log("EVENT_ID=" + r[0].id);
await conn.end();
