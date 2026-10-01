// Мобильная авторизация SMS Aero (smsaero.ru, mobile-id):
// абоненту приходит SIM-PUSH «Подтвердить вход», если не сработал — SMS с кодом.
// API: https://smsaero.ru/integration/documentation/api/ (раздел «Мобильная авторизация»)
// Аутентификация: Basic (e-mail аккаунта : API-ключ).
// Тестовый режим: тестовый API-ключ + sign «SMS Aero» — SMS не отправляются,
// списаний нет, код подтверждения всегда 1234.
// Если e-mail/ключ не заданы в настройках — все функции возвращают null/"error",
// и авторизация работает в пилотном режиме (код на экране), как раньше.

import { getAllSettings } from "./settings";

const GATE = "https://gate.smsaero.ru/v2/mobile-id";

// Статусы data.status из документации SMS Aero
export const AERO_STATUS = {
  QUEUED: 0, // ожидает начала (очередь)
  IN_PROGRESS: 8, // в процессе
  NEED_OTP: 3, // нужен OTP-код из SMS
  SUCCESS: 1, // пройдено (успех)
  FAILED: 2, // не пройдено
  ERROR: 16, // ошибка
} as const;

interface AeroCreds {
  email: string;
  apiKey: string;
  sign: string;
}

async function creds(): Promise<AeroCreds | null> {
  const s = await getAllSettings();
  const email = s.sms_aero_email?.trim();
  const apiKey = s.sms_aero_api_key?.trim();
  if (!email || !apiKey) return null;
  // sign — имя отправителя, активное в личном кабинете.
  // Пусто → «SMS Aero» (подходит для тестового API-ключа).
  return { email, apiKey, sign: s.sms_aero_sign?.trim() || "SMS Aero" };
}

interface AeroData {
  id: number;
  number?: string;
  status?: number;
}

async function post(
  c: AeroCreds,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; httpStatus: number; data: AeroData | null }> {
  try {
    const res = await fetch(`${GATE}${path}`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${c.email}:${c.apiKey}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: AeroData;
    } | null;
    return {
      ok: res.ok && json?.success === true,
      httpStatus: res.status,
      data: json?.data ?? null,
    };
  } catch {
    return { ok: false, httpStatus: 0, data: null };
  }
}

/**
 * Запуск мобильной авторизации: SIM-PUSH, при недоступности — SMS OTP.
 * Возвращает id сессии (data.id) или null, если ключи не заданы либо API
 * недоступен — тогда вызывающий код уходит в пилотный режим.
 */
export async function aeroSend(
  phone: string,
  callbackUrl: string,
): Promise<number | null> {
  const c = await creds();
  if (!c) return null;
  const r = await post(c, "/send", {
    number: phone, // формат 79XXXXXXXXX
    sign: c.sign,
    callbackUrl,
  });
  return r.ok && r.data?.id ? r.data.id : null;
}

/** Текущий статус сессии (polling вместо webhook). null — ключи/сеть недоступны. */
export async function aeroStatus(id: number): Promise<number | null> {
  const c = await creds();
  if (!c) return null;
  const r = await post(c, "/status", { id });
  return r.data?.status ?? null;
}

/**
 * Проверка OTP-кода из SMS.
 * "ok" — код верный (status=1), "wrong" — неверный код (HTTP 400),
 * "error" — сбой API или сессия не найдена (HTTP 404 и пр.).
 */
export async function aeroVerify(
  id: number,
  code: string,
): Promise<"ok" | "wrong" | "error"> {
  const c = await creds();
  if (!c) return "error";
  const r = await post(c, "/verify", { id, sign: c.sign, code });
  if (r.ok && r.data?.status === AERO_STATUS.SUCCESS) return "ok";
  if (r.httpStatus === 400) return "wrong";
  return "error";
}
