// Отправка SMS через Prostor SMS (prostor-sms.ru)
// HTTP API: https://api.prostor-sms.ru/messages/v2/send.json
// Если логин/пароль не заданы в настройках — возвращаем false (фолбэк на пилотный режим)

import { getAllSettings } from "./settings";

export async function sendSms(phone: string, text: string): Promise<boolean> {
  const s = await getAllSettings();
  const login = s.sms_login;
  const password = s.sms_password;
  if (!login || !password) return false;

  const url = new URL("https://api.prostor-sms.ru/messages/v2/send.json");
  url.searchParams.set("login", login);
  url.searchParams.set("password", password);
  url.searchParams.set("phone", phone); // формат 79XXXXXXXXX
  url.searchParams.set("text", text);

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    return false;
  }
}
