import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { BRAND } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plug, Send } from "lucide-react";

const GROUPS: { title: string; keys: { key: string; label: string; hint?: string; multiline?: boolean; secret?: boolean }[] }[] = [
  {
    title: "Контакты и адрес",
    keys: [
      { key: "phone", label: "Телефон" },
      { key: "email", label: "E-mail" },
      { key: "address", label: "Адрес" },
      { key: "telegram_link", label: "Ссылка на Telegram" },
      { key: "hours_weekday", label: "Часы работы (будни)" },
      { key: "hours_weekend", label: "Часы работы (выходные)" },
    ],
  },
  {
    title: "Цены",
    keys: [
      { key: "price_loft_weekday", label: "Лофт, будни (₽/час)" },
      { key: "price_loft_weekend", label: "Лофт, выходные (₽/час)" },
      { key: "price_cleaning", label: "Финальная уборка (₽)" },
      { key: "price_kids_hour", label: "Детская, 1 час (₽)" },
      { key: "price_kids_unlimited", label: "Детская, безлимит до 15:00 (₽)" },
      { key: "price_coworking_hour", label: "Коворкинг (₽/час)" },
      { key: "coworking_capacity", label: "Мест в коворкинге", hint: "Сколько мест можно забронировать одновременно" },
    ],
  },
  {
    title: "Тексты и акции",
    keys: [
      { key: "promo_text", label: "Промо-текст (скидка 20%)", multiline: true },
      { key: "offer_3plus1", label: "Акция «3+1»", multiline: true },
    ],
  },
  {
    title: "Telegram-уведомления",
    keys: [
      { key: "telegram_bot_token", label: "Токен бота", hint: "Создайте бота через @BotFather и вставьте токен", secret: true },
      { key: "telegram_chat_id", label: "Chat ID", hint: "Узнать можно через @userinfobot — напишите боту и получите id" },
    ],
  },
  {
    title: "Интеграция Quick Resto",
    keys: [
      { key: "qr_enabled", label: "Интеграция включена (1/0)", hint: "1 — приложение берёт меню и бонусы из Quick Resto; 0 — работает на данных сайта" },
      { key: "qr_layer", label: "Имя облака", hint: "Например «lavbrew» → lavbrew.quickresto.ru" },
      { key: "qr_login", label: "Логин Back Office API" },
      { key: "qr_password", label: "Пароль Back Office API", secret: true },
      { key: "qr_account_guid", label: "GUID типа бонусного счёта", hint: "Можно оставить пустым — возьмём первый из списка автоматически" },
    ],
  },
  {
    title: "Безопасность",
    keys: [
      { key: "otp_debug_mode", label: "Пилотный вход (1/0)", hint: "1 — код входа показывается в приложении (SMS-шлюз не подключён). После подключения SMS обязательно поставьте 0!" },
    ],
  },
];

export function SettingsTab({ token }: { token: string }) {
  const settingsQuery = trpc.admin.settings.useQuery({ token });
  const utils = trpc.useUtils();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data) setValues(settingsQuery.data as Record<string, string>);
  }, [settingsQuery.data]);

  const update = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      utils.admin.settings.invalidate();
      utils.site.content.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const changePw = trpc.admin.changePassword.useMutation({
    onSuccess: () => {
      setPwMsg("Пароль обновлён");
      setNewPassword("");
    },
    onError: (e) => setPwMsg(e.message),
  });

  const testTg = trpc.admin.testTelegram.useMutation({
    onSuccess: () => alert("Тестовое уведомление отправлено в Telegram!"),
    onError: (e) => alert(e.message),
  });

  const testQr = trpc.admin.testQuickResto.useMutation({
    onSuccess: (r) => alert(`Quick Resto: ${r.detail} (режим: ${r.mode})`),
    onError: (e) => alert(e.message),
  });

  return (
    <div className="max-w-2xl space-y-8">
      {GROUPS.map((g) => (
        <section key={g.title} className="rounded-3xl p-6" style={{ background: BRAND.white }}>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider" style={{ color: BRAND.sageDeep }}>
            {g.title}
          </h3>
          <div className="mt-4 grid gap-4">
            {g.keys.map((k) => (
              <div key={k.key} className="grid gap-1.5">
                <Label>{k.label}</Label>
                {k.multiline ? (
                  <Textarea
                    className="rounded-xl"
                    value={values[k.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [k.key]: e.target.value })}
                  />
                ) : (
                  <Input
                    type={k.secret ? "password" : "text"}
                    autoComplete="off"
                    className="rounded-xl"
                    value={values[k.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [k.key]: e.target.value })}
                  />
                )}
                {k.hint && <p className="text-xs opacity-50">{k.hint}</p>}
              </div>
            ))}
            {g.title === "Telegram-уведомления" && (
              <Button
                variant="outline"
                className="w-max rounded-full"
                disabled={testTg.isPending}
                onClick={() => {
                  update.mutate(
                    { token, values },
                    { onSuccess: () => testTg.mutate({ token }) },
                  );
                }}
              >
                <Send className="mr-2 h-4 w-4" /> Сохранить и отправить тест
              </Button>
            )}
            {g.title === "Интеграция Quick Resto" && (
              <Button
                variant="outline"
                className="w-max rounded-full"
                disabled={testQr.isPending}
                onClick={() => {
                  update.mutate(
                    { token, values },
                    { onSuccess: () => testQr.mutate({ token }) },
                  );
                }}
              >
                <Plug className="mr-2 h-4 w-4" />
                {testQr.isPending ? "Проверяем связь…" : "Сохранить и проверить связь"}
              </Button>
            )}
          </div>
        </section>
      ))}

      <Button
        size="lg"
        className="rounded-full"
        style={{ background: BRAND.ink, color: BRAND.cream }}
        disabled={update.isPending}
        onClick={() => update.mutate({ token, values })}
      >
        {saved ? "Сохранено ✓" : "Сохранить настройки"}
      </Button>

      <section className="rounded-3xl p-6" style={{ background: BRAND.white }}>
        <h3 className="font-display text-sm font-bold uppercase tracking-wider" style={{ color: BRAND.sageDeep }}>
          Смена пароля админки
        </h3>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid flex-1 gap-1.5">
            <Label>Новый пароль (минимум 6 символов)</Label>
            <Input
              type="password"
              className="rounded-xl"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <Button
            className="rounded-full"
            style={{ background: BRAND.sageDeep, color: BRAND.white }}
            disabled={changePw.isPending || newPassword.length < 6}
            onClick={() => changePw.mutate({ token, newPassword })}
          >
            Сменить пароль
          </Button>
        </div>
        {pwMsg && <p className="mt-2 text-sm opacity-70">{pwMsg}</p>}
      </section>
    </div>
  );
}
