import { useEffect, useState } from "react";
import { Check, LogOut, Pencil, Ticket } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useMe, usePwa } from "../store";
import { BRAND, bookingTypeLabel, formatDateRu, slotLabel } from "@/lib/site";

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  new: { text: "на подтверждении", color: "#B0892F" },
  confirmed: { text: "подтверждена", color: BRAND.sageDeep },
  rejected: { text: "отклонена", color: "#B0492F" },
};

export default function ProfileScreen() {
  const { customerToken, setCustomerToken, track } = usePwa();
  const utils = trpc.useUtils();
  const me = useMe();
  const myBookings = trpc.pwa.myBookings.useQuery(
    { token: customerToken },
    { enabled: customerToken.length >= 10 },
  );
  const myRegistrations = trpc.pwa.myEventRegistrations.useQuery(
    { token: customerToken },
    { enabled: customerToken.length >= 10 },
  );

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    track("pwa_profile_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateName = trpc.pwa.updateName.useMutation({
    onSuccess: () => {
      setEditingName(false);
      utils.pwa.me.invalidate();
      utils.pwa.home.invalidate();
    },
  });

  const logout = trpc.pwa.logout.useMutation({
    onSettled: () => {
      setCustomerToken("");
      utils.pwa.invalidate();
    },
  });

  return (
    <div className="px-4 pt-6">
      <p className="font-display text-3xl font-extrabold uppercase">Профиль</p>

      {/* Карточка клиента */}
      <div className="mt-4 rounded-3xl p-5" style={{ background: BRAND.white }}>
        <div className="flex items-center justify-between">
          {editingName ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                className="min-w-0 flex-1 rounded-xl px-3 py-2 outline-none"
                style={{ background: BRAND.cream }}
              />
              <button
                onClick={() =>
                  updateName.mutate({ token: customerToken, name })
                }
                className="rounded-full p-2"
                style={{ background: BRAND.sage }}
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <>
              <div>
                <p className="font-display text-xl font-bold">
                  {me.data?.name || "Гость Лавбрю"}
                </p>
                <p className="mt-0.5 text-sm" style={{ color: BRAND.sageDeep }}>
                  {me.data?.phoneFormatted}
                </p>
              </div>
              <button
                onClick={() => {
                  setName(me.data?.name ?? "");
                  setEditingName(true);
                }}
                className="rounded-full p-2.5"
                style={{ background: BRAND.cream }}
              >
                <Pencil size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Мои брони */}
      <div className="mt-6">
        <p className="font-display mb-3 text-lg font-bold uppercase">
          Мои брони
        </p>
        <div className="space-y-2">
          {myBookings.data?.map((b) => {
            const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.new;
            return (
              <div
                key={b.id}
                className="rounded-2xl p-4"
                style={{ background: BRAND.white }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold">{bookingTypeLabel(b.type)}</p>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase"
                    style={{ background: BRAND.cream, color: st.color }}
                  >
                    {st.text}
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: BRAND.sageDeep }}>
                  {formatDateRu(b.date)}
                  {b.slot ? ` · ${slotLabel(b.slot)}` : ""}
                  {b.startTime ? ` · с ${b.startTime}` : ""}
                  {b.hours ? ` · ${b.hours} ч` : ""}
                </p>
              </div>
            );
          })}
          {!myBookings.isLoading && !myBookings.data?.length && (
            <p className="py-4 text-sm" style={{ color: BRAND.sageDeep }}>
              Пока нет бронирований
            </p>
          )}
        </div>
      </div>

      {/* Мои записи на мероприятия */}
      {!!myRegistrations.data?.length && (
        <div className="mt-6">
          <p className="font-display mb-3 text-lg font-bold uppercase">
            Записи на мероприятия
          </p>
          <div className="space-y-2">
            {myRegistrations.data.map((r) => {
              const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.new;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl p-4"
                  style={{ background: BRAND.white }}
                >
                  <Ticket size={18} style={{ color: BRAND.sageDeep }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight">{r.eventTitle}</p>
                    <p className="mt-0.5 text-sm" style={{ color: BRAND.sageDeep }}>
                      {formatDateRu(r.eventDate)}
                      {r.eventTime ? ` · ${r.eventTime}` : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase"
                    style={{ background: BRAND.cream, color: st.color }}
                  >
                    {st.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Выход */}
      <button
        onClick={() => logout.mutate({ token: customerToken })}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold"
        style={{ background: BRAND.creamDeep, color: BRAND.ink }}
      >
        <LogOut size={16} /> Выйти
      </button>
    </div>
  );
}
