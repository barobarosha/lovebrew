import { getDb } from "../api/queries/connection";
import { events, menuItems } from "./schema";

async function seed() {
  const db = getDb();

  const existingMenu = await db.select().from(menuItems).limit(1);
  if (!existingMenu.length) {
    await db.insert(menuItems).values([
      // Кофе
      { category: "Кофе", name: "Эспрессо", volume: "30 мл", price: 150, sortOrder: 1 },
      { category: "Кофе", name: "Американо", volume: "250 мл", price: 200, sortOrder: 2 },
      { category: "Кофе", name: "Капучино", volume: "350 мл", price: 300, sortOrder: 3, description: "Классика на зерне тёмной обжарки" },
      { category: "Кофе", name: "Латте классический", volume: "350 мл", price: 300, sortOrder: 4 },
      { category: "Кофе", name: "Флэт уайт", volume: "250 мл", price: 320, sortOrder: 5 },
      { category: "Кофе", name: "Раф сиреневый", volume: "350 мл", price: 350, sortOrder: 6, description: "Авторский, с нотками лаванды" },
      { category: "Кофе", name: "Матча латте", volume: "350 мл", price: 350, sortOrder: 7 },
      { category: "Кофе", name: "Какао детский", volume: "250 мл", price: 250, sortOrder: 8 },
      // Десерты и еда
      { category: "Десерты", name: "Круассан", volume: "150 гр", price: 200, sortOrder: 10 },
      { category: "Десерты", name: "Чизкейк", volume: "150 гр", price: 250, sortOrder: 11 },
      { category: "Десерты", name: "Сырник с творожным кремом", volume: "120 гр", price: 220, sortOrder: 12 },
      { category: "Десерты", name: "Шоколадный фондан", volume: "140 гр", price: 290, sortOrder: 13 },
      { category: "Завтраки", name: "Каша на кокосовом молоке", volume: "300 гр", price: 280, sortOrder: 20 },
      { category: "Завтраки", name: "Тост с авокадо и яйцом", volume: "250 гр", price: 340, sortOrder: 21 },
      // Не кофе
      { category: "Напитки", name: "Чай облепиховый", volume: "400 мл", price: 280, sortOrder: 30 },
      { category: "Напитки", name: "Лимонад домашний", volume: "400 мл", price: 250, sortOrder: 31 },
      { category: "Напитки", name: "Милкшейк", volume: "350 мл", price: 300, sortOrder: 32 },
    ]);
    console.log("Menu seeded");
  }

  const existingEvents = await db.select().from(events).limit(1);
  if (!existingEvents.length) {
    const inDays = (n: number) => {
      const d = new Date(Date.now() + n * 86400000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    await db.insert(events).values([
      {
        title: "Детский праздник «День рождения под ключ»",
        description:
          "Организуем праздник для малышей: аниматор, игровая комната, угощения. Вы только приходите — остальное мы берём на себя.",
        date: inDays(6),
        time: "12:00",
        price: "от 15 000 ₽",
      },
      {
        title: "Киновечер на проекторе",
        description:
          "Уютный показ фильма на большом экране, пледы, попкорн и напитки из кофейни со скидкой 20%.",
        date: inDays(10),
        time: "19:00",
        price: "500 ₽",
      },
      {
        title: "Мастер-класс по каптестингу",
        description:
          "Учимся разбираться в кофе: обжарка, помол, вкусовые профили. Дегустация трёх сортов включена.",
        date: inDays(14),
        time: "11:00",
        price: "1 500 ₽",
      },
    ]);
    console.log("Events seeded");
  }

  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
