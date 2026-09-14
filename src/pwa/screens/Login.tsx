import { useState } from "react";
import { X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePwa } from "../store";
import { BRAND } from "@/lib/site";

export default function LoginScreen({
  inline,
  onClose,
}: {
  inline?: boolean;
  onClose?: () => void;
}) {
  const { setCustomerToken } = usePwa();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"phone" | "code" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [error, setError] = useState("");

  const requestOtp = trpc.pwa.requestOtp.useMutation({
    onSuccess: (r) => {
      setDebugCode(r.debugCode ?? "");
      setStep("code");
      setError("");
    },
    onError: (e) => setError(e.message),
  });

  const verifyOtp = trpc.pwa.verifyOtp.useMutation({
    onSuccess: (r) => {
      setCustomerToken(r.token);
      setToken(r.token);
      utils.pwa.me.invalidate();
      utils.pwa.home.invalidate();
      // Первый вход: имени ещё нет — предлагаем представиться.
      // Это имя показывается в приложении и уходит в Quick Resto,
      // имя из базы Quick Resto не подтягивается.
      if (r.needName) {
        setStep("name");
        setError("");
      } else {
        onClose?.();
      }
    },
    onError: (e) => setError(e.message),
  });

  const updateName = trpc.pwa.updateName.useMutation({
    onSuccess: () => {
      utils.pwa.me.invalidate();
      utils.pwa.home.invalidate();
      onClose?.();
    },
    onError: (e) => setError(e.message),
  });

  const titles: Record<typeof step, { title: string; hint: string }> = {
    phone: {
      title: "Вход",
      hint: "По номеру телефона — чтобы копить бонусы и бронировать",
    },
    code: {
      title: "Код из SMS",
      hint: "Отправили 4 цифры на ваш номер",
    },
    name: {
      title: "Как к вам обращаться?",
      hint: "Это имя будет показано в приложении и на кассе",
    },
  };

  const content = (
    <div
      className="rounded-t-3xl p-6 sm:rounded-3xl"
      style={{ background: BRAND.white }}
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p
            className="font-display text-2xl font-bold uppercase"
            style={{ color: BRAND.ink }}
          >
            {titles[step].title}
          </p>
          <p className="mt-1 text-sm" style={{ color: BRAND.sageDeep }}>
            {titles[step].hint}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full p-2"
            style={{ background: BRAND.cream }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {step === "phone" && (
        <div className="space-y-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 (___) ___-__-__"
            inputMode="tel"
            className="w-full rounded-2xl border px-4 py-3.5 text-lg outline-none"
            style={{ borderColor: BRAND.creamDeep, background: BRAND.cream }}
          />
          <button
            disabled={requestOtp.isPending}
            onClick={() => requestOtp.mutate({ phone })}
            className="w-full rounded-full py-3.5 font-semibold text-white disabled:opacity-60"
            style={{ background: BRAND.ink }}
          >
            {requestOtp.isPending ? "Отправляем…" : "Получить код"}
          </button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Код из SMS"
            inputMode="numeric"
            className="w-full rounded-2xl border px-4 py-3.5 text-center text-2xl font-bold tracking-[0.4em] outline-none"
            style={{ borderColor: BRAND.creamDeep, background: BRAND.cream }}
          />
          {debugCode && (
            <p
              className="rounded-xl px-3 py-2 text-center text-xs"
              style={{ background: BRAND.creamDeep, color: BRAND.ink }}
            >
              Режим пилота: SMS-шлюз ещё не подключён, ваш код —{" "}
              <b className="text-sm">{debugCode}</b>
            </p>
          )}
          <button
            disabled={verifyOtp.isPending || code.length !== 4}
            onClick={() => verifyOtp.mutate({ phone, code })}
            className="w-full rounded-full py-3.5 font-semibold text-white disabled:opacity-60"
            style={{ background: BRAND.ink }}
          >
            {verifyOtp.isPending ? "Входим…" : "Войти"}
          </button>
          <button
            onClick={() => {
              setStep("phone");
              setCode("");
              setDebugCode("");
            }}
            className="w-full py-2 text-sm font-medium"
            style={{ color: BRAND.sageDeep }}
          >
            Изменить номер
          </button>
        </div>
      )}

      {step === "name" && (
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            autoFocus
            className="w-full rounded-2xl border px-4 py-3.5 text-lg outline-none"
            style={{ borderColor: BRAND.creamDeep, background: BRAND.cream }}
          />
          <button
            disabled={updateName.isPending || !name.trim()}
            onClick={() => updateName.mutate({ token, name: name.trim() })}
            className="w-full rounded-full py-3.5 font-semibold text-white disabled:opacity-60"
            style={{ background: BRAND.ink }}
          >
            {updateName.isPending ? "Сохраняем…" : "Продолжить"}
          </button>
          <button
            onClick={() => onClose?.()}
            className="w-full py-2 text-sm font-medium"
            style={{ color: BRAND.sageDeep }}
          >
            Пропустить
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-center text-sm font-medium text-red-700">{error}</p>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className="flex min-h-[70vh] items-center p-4">{content}</div>
    );
  }
  return content;
}
