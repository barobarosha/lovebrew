import { useEffect } from "react";
import QRCode from "react-qr-code";
import { Gift } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useMe, usePwa } from "../store";
import { BRAND } from "@/lib/site";

export default function BonusesScreen() {
  const { customerToken, track } = usePwa();
  const me = useMe();
  const bonuses = trpc.pwa.bonuses.useQuery(
    { token: customerToken },
    { enabled: customerToken.length >= 10, staleTime: 30_000 },
  );

  useEffect(() => {
    track("pwa_bonuses_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = bonuses.data?.connected ?? false;

  return (
    <div className="px-4 pt-6">
      <p className="font-display text-3xl font-extrabold uppercase">Бонусы</p>

      <div
        className="mt-4 rounded-3xl p-6 text-center"
        style={{ background: BRAND.ink }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: BRAND.sage }}
        >
          ваш баланс
        </p>
        <p className="font-display mt-2 text-6xl font-extrabold text-white">
          {bonuses.isLoading ? "…" : connected ? bonuses.data?.balance : "—"}
        </p>
        <p className="mt-1 text-sm" style={{ color: BRAND.creamDeep }}>
          бонусов · 1 бонус = 1 ₽
        </p>
        {!connected && !bonuses.isLoading && (
          <p className="mt-3 text-xs" style={{ color: BRAND.sage }}>
            Программа лояльности на кассе уже работает — баланс появится здесь
            после подключения Quick Resto
          </p>
        )}
      </div>

      {/* QR для кассы */}
      {me.data && (
        <div
          className="mt-4 flex items-center gap-4 rounded-3xl p-5"
          style={{ background: BRAND.white }}
        >
          <div className="rounded-2xl p-3" style={{ background: BRAND.cream }}>
            <QRCode
              value={`lavbrew:${me.data.phone}`}
              size={92}
              fgColor={BRAND.ink}
              bgColor={BRAND.cream}
            />
          </div>
          <div>
            <p className="font-bold">Покажите на кассе</p>
            <p className="mt-1 text-sm" style={{ color: BRAND.sageDeep }}>
              или назовите номер {me.data.phoneFormatted} — бонусы начислятся
              автоматически
            </p>
          </div>
        </div>
      )}

      {/* История операций */}
      <div className="mt-6">
        <p className="font-display mb-3 text-lg font-bold uppercase">
          История
        </p>
        {connected && !!bonuses.data?.history.length && (
          <div className="space-y-2">
            {bonuses.data.history.map((op, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl p-4"
                style={{ background: BRAND.white }}
              >
                <div>
                  <p className="text-sm font-semibold">
                    {op.comment || (op.type === "credit" ? "Начисление" : "Списание")}
                  </p>
                  <p className="text-xs" style={{ color: BRAND.sageDeep }}>
                    {op.date ? new Date(op.date).toLocaleDateString("ru-RU") : ""}
                  </p>
                </div>
                <p
                  className="text-lg font-extrabold"
                  style={{ color: op.amount >= 0 ? BRAND.sageDeep : "#B0492F" }}
                >
                  {op.amount >= 0 ? "+" : ""}
                  {op.amount}
                </p>
              </div>
            ))}
          </div>
        )}
        {(!connected || !bonuses.data?.history.length) && (
          <div
            className="flex items-center gap-3 rounded-2xl p-4"
            style={{ background: BRAND.creamDeep }}
          >
            <Gift size={18} className="shrink-0" />
            <p className="text-sm">
              Пока пусто. Совершите покупку в кофейне — и первые бонусы
              появятся здесь.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
