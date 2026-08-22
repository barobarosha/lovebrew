import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { BRAND, bookingTypeLabel, formatDateRu, slotLabel } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Plus, Trash2, X } from "lucide-react";

const STATUS_LABEL: Record<string, { label: string; bg: string }> = {
  new: { label: "Новая", bg: BRAND.pink },
  confirmed: { label: "Подтверждена", bg: BRAND.sage },
  rejected: { label: "Отклонена", bg: "#D8D4C6" },
};

export function BookingsTab({ token }: { token: string }) {
  const [filter, setFilter] = useState<"new" | "confirmed" | "rejected" | undefined>(undefined);
  const list = trpc.admin.bookings.useQuery({ token, status: filter });
  const utils = trpc.useUtils();
  const [manualOpen, setManualOpen] = useState(false);

  const setStatus = trpc.admin.setBookingStatus.useMutation({
    onSuccess: () => {
      utils.admin.bookings.invalidate();
      utils.admin.slotsCalendar.invalidate();
    },
  });
  const remove = trpc.admin.deleteBooking.useMutation({
    onSuccess: () => {
      utils.admin.bookings.invalidate();
      utils.admin.slotsCalendar.invalidate();
    },
  });

  const counts = trpc.admin.bookings.useQuery({ token });
  const newCount = (counts.data ?? []).filter((b) => b.status === "new").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              [undefined, `Все`],
              ["new", `Новые (${newCount})`],
              ["confirmed", "Подтверждённые"],
              ["rejected", "Отклонённые"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={String(v)}
              onClick={() => setFilter(v)}
              className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
              style={{
                background: filter === v ? BRAND.ink : BRAND.white,
                color: filter === v ? BRAND.cream : BRAND.ink,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <Button
          className="rounded-full"
          style={{ background: BRAND.sageDeep, color: BRAND.white }}
          onClick={() => setManualOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Добавить бронь вручную
        </Button>
      </div>

      {list.isLoading && <p className="opacity-60">Загрузка…</p>}
      {!list.isLoading && (list.data ?? []).length === 0 && (
        <p className="rounded-3xl p-8 text-center opacity-60" style={{ background: BRAND.white }}>
          Заявок пока нет
        </p>
      )}

      <div className="grid gap-3">
        {(list.data ?? []).map((b) => (
          <div
            key={b.id}
            className="rounded-3xl p-5"
            style={{ background: BRAND.white }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className="rounded-full text-xs font-bold"
                    style={{
                      background: STATUS_LABEL[b.status].bg,
                      color: BRAND.ink,
                    }}
                  >
                    {STATUS_LABEL[b.status].label}
                  </Badge>
                  <span className="font-display text-sm font-bold uppercase tracking-wide">
                    {bookingTypeLabel(b.type)}
                  </span>
                  <span className="text-xs opacity-50">
                    #{b.id} · {new Date(b.createdAt).toLocaleString("ru-RU")}
                  </span>
                </div>
                <p className="mt-2 font-display text-lg font-semibold">
                  {b.name} · {b.phone}
                </p>
                <p className="mt-1 text-sm opacity-75">
                  {formatDateRu(b.date)}
                  {b.slot && ` · ${slotLabel(b.slot)}`}
                  {b.startTime && ` · с ${b.startTime}`}
                  {b.hours ? ` · ${b.hours} ч.` : ""}
                  {b.guests ? ` · ${b.guests} гост./мест` : ""}
                </p>
                {b.comment && (
                  <p className="mt-2 rounded-xl px-3 py-2 text-sm" style={{ background: BRAND.cream }}>
                    {b.comment}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {b.status !== "confirmed" && (
                  <Button
                    size="sm"
                    className="rounded-full"
                    style={{ background: BRAND.sageDeep, color: BRAND.white }}
                    onClick={() =>
                      setStatus.mutate({ token, id: b.id, status: "confirmed" })
                    }
                  >
                    <Check className="mr-1 h-4 w-4" /> Подтвердить
                  </Button>
                )}
                {b.status !== "rejected" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      setStatus.mutate({ token, id: b.id, status: "rejected" })
                    }
                  >
                    <X className="mr-1 h-4 w-4" /> Отклонить
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-red-600"
                  onClick={() => {
                    if (confirm("Удалить заявку безвозвратно?"))
                      remove.mutate({ token, id: b.id });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ManualBookingDialog
        token={token}
        open={manualOpen}
        onClose={() => setManualOpen(false)}
      />
    </div>
  );
}

function ManualBookingDialog({
  token,
  open,
  onClose,
}: {
  token: string;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const create = trpc.admin.createBooking.useMutation({
    onSuccess: () => {
      utils.admin.bookings.invalidate();
      utils.admin.slotsCalendar.invalidate();
      onClose();
    },
  });
  const [form, setForm] = useState({
    type: "loft" as "loft" | "coworking" | "kids",
    name: "",
    phone: "",
    date: "",
    slot: "fullday" as "day" | "evening" | "fullday",
    startTime: "",
    hours: 2,
    guests: 1,
    comment: "",
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-md" style={{ background: BRAND.white }}>
        <DialogHeader>
          <DialogTitle className="font-display">Ручная бронь</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            {(["loft", "coworking", "kids"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className="rounded-xl px-2 py-2 text-xs font-bold uppercase"
                style={{
                  background: form.type === t ? BRAND.ink : BRAND.cream,
                  color: form.type === t ? BRAND.cream : BRAND.ink,
                }}
              >
                {bookingTypeLabel(t)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Имя</Label>
              <Input className="rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label>Телефон</Label>
              <Input className="rounded-xl" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Дата</Label>
              <Input type="date" className="rounded-xl" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            {form.type === "loft" && (
              <div className="grid gap-1">
                <Label>Слот</Label>
                <select
                  className="h-9 rounded-xl border px-2 text-sm"
                  value={form.slot}
                  onChange={(e) => setForm({ ...form, slot: e.target.value as typeof form.slot })}
                >
                  <option value="fullday">Будний день</option>
                  <option value="day">Дневной (до 15:00)</option>
                  <option value="evening">Вечерний (с 16:00)</option>
                </select>
              </div>
            )}
            {form.type !== "loft" && (
              <div className="grid gap-1">
                <Label>Время</Label>
                <Input type="time" className="rounded-xl" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Часов</Label>
              <Input type="number" min={1} className="rounded-xl" value={form.hours} onChange={(e) => setForm({ ...form, hours: +e.target.value || 1 })} />
            </div>
            <div className="grid gap-1">
              <Label>Гостей/мест</Label>
              <Input type="number" min={1} className="rounded-xl" value={form.guests} onChange={(e) => setForm({ ...form, guests: +e.target.value || 1 })} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Комментарий</Label>
            <Textarea className="rounded-xl" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          </div>
          {create.error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{create.error.message}</p>
          )}
          <Button
            className="rounded-full"
            style={{ background: BRAND.ink, color: BRAND.cream }}
            disabled={create.isPending || !form.name || !form.date}
            onClick={() =>
              create.mutate({
                token,
                type: form.type,
                name: form.name,
                phone: form.phone,
                date: form.date,
                slot: form.type === "loft" ? form.slot : undefined,
                startTime: form.startTime || undefined,
                hours: form.hours,
                guests: form.guests,
                comment: form.comment || undefined,
                status: "confirmed",
              })
            }
          >
            Сохранить бронь
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
