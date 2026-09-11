import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  BRAND,
  bookingTypeLabel,
  formatDateRu,
  formatPhoneInput,
  slotLabel,
} from "@/lib/site";
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
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

const STATUS_LABEL: Record<string, { label: string; bg: string }> = {
  new: { label: "Новая", bg: BRAND.pink },
  confirmed: { label: "Подтверждена", bg: BRAND.sage },
  rejected: { label: "Отклонена", bg: "#D8D4C6" },
};

type BookingRow = {
  id: number;
  type: "loft" | "coworking" | "kids";
  name: string;
  phone: string;
  date: string;
  slot: string | null;
  startTime: string | null;
  hours: number | null;
  guests: number | null;
  comment: string | null;
  status: "new" | "confirmed" | "rejected";
  adminNote: string | null;
  createdAt: string | Date;
};

export function BookingsTab({ token }: { token: string }) {
  const [filter, setFilter] = useState<"new" | "confirmed" | "rejected" | undefined>(undefined);
  const list = trpc.admin.bookings.useQuery({ token, status: filter });
  const utils = trpc.useUtils();
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState<BookingRow | null>(null);

  const invalidate = () => {
    utils.admin.bookings.invalidate();
    utils.admin.slotsCalendar.invalidate();
  };
  const setStatus = trpc.admin.setBookingStatus.useMutation({ onSuccess: invalidate });
  const remove = trpc.admin.deleteBooking.useMutation({ onSuccess: invalidate });

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
                {b.adminNote && (
                  <p className="mt-2 rounded-xl px-3 py-2 text-xs italic opacity-70" style={{ background: BRAND.creamDeep }}>
                    Заметка: {b.adminNote}
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
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setEditing(b as BookingRow)}
                >
                  <Pencil className="mr-1 h-4 w-4" /> Изменить
                </Button>
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

      <BookingFormDialog
        token={token}
        open={manualOpen}
        onClose={() => setManualOpen(false)}
      />
      <BookingFormDialog
        token={token}
        open={!!editing}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

type FormState = {
  type: "loft" | "coworking" | "kids";
  name: string;
  phone: string;
  date: string;
  slot: "day" | "evening";
  startTime: string;
  hours: number;
  guests: number;
  comment: string;
  adminNote: string;
  status: "new" | "confirmed" | "rejected";
};

const EMPTY_FORM: FormState = {
  type: "loft",
  name: "",
  phone: "",
  date: "",
  slot: "day",
  startTime: "",
  hours: 2,
  guests: 1,
  comment: "",
  adminNote: "",
  status: "confirmed",
};

function BookingFormDialog({
  token,
  open,
  onClose,
  initial,
}: {
  token: string;
  open: boolean;
  onClose: () => void;
  initial?: BookingRow;
}) {
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.admin.bookings.invalidate();
    utils.admin.slotsCalendar.invalidate();
    utils.site.calendar.invalidate();
    onClose();
  };
  const create = trpc.admin.createBooking.useMutation({ onSuccess: invalidate });
  const update = trpc.admin.updateBooking.useMutation({ onSuccess: invalidate });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loadedFor, setLoadedFor] = useState<number | "new" | null>(null);

  // Заполняем форму при открытии (создание — пустая, редактирование — данные заявки)
  const key = initial ? initial.id : "new";
  if (open && loadedFor !== key) {
    setLoadedFor(key);
    setForm(
      initial
        ? {
            type: initial.type,
            name: initial.name,
            phone: initial.phone,
            date: initial.date,
            slot: initial.slot === "evening" ? "evening" : "day",
            startTime: initial.startTime ?? "",
            hours: initial.hours ?? 2,
            guests: initial.guests ?? 1,
            comment: initial.comment ?? "",
            adminNote: initial.adminNote ?? "",
            status: initial.status,
          }
        : EMPTY_FORM,
    );
  }
  if (!open && loadedFor !== null) setLoadedFor(null);

  const saving = create.isPending || update.isPending;
  const error = create.error || update.error;

  const save = () => {
    const payload = {
      type: form.type,
      name: form.name,
      phone: form.phone,
      date: form.date,
      slot: form.type === "loft" ? form.slot : undefined,
      startTime: form.startTime || undefined,
      hours: form.type === "kids" ? undefined : form.hours,
      guests: form.guests,
      comment: form.comment || undefined,
    };
    if (initial) {
      update.mutate({
        token,
        id: initial.id,
        ...payload,
        adminNote: form.adminNote || undefined,
        status: form.status,
      });
    } else {
      create.mutate({ token, ...payload, status: "confirmed" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md"
        style={{ background: BRAND.white }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display">
            {initial ? `Заявка #${initial.id}` : "Ручная бронь"}
          </DialogTitle>
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
              <Input
                className="rounded-xl"
                inputMode="tel"
                placeholder="+7 (___) ___-__-__"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })}
              />
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
            {form.type !== "kids" && (
              <div className="grid gap-1">
                <Label>Часов</Label>
                <Input type="number" min={1} className="rounded-xl" value={form.hours} onChange={(e) => setForm({ ...form, hours: +e.target.value || 1 })} />
              </div>
            )}
            <div className="grid gap-1">
              <Label>{form.type === "kids" ? "Детей" : "Гостей/мест"}</Label>
              <Input type="number" min={1} className="rounded-xl" value={form.guests} onChange={(e) => setForm({ ...form, guests: +e.target.value || 1 })} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Комментарий</Label>
            <Textarea className="rounded-xl" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          </div>
          {initial && (
            <>
              <div className="grid gap-1">
                <Label>Заметка администратора (видна только вам)</Label>
                <Input className="rounded-xl" value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label>Статус</Label>
                <select
                  className="h-9 rounded-xl border px-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}
                >
                  <option value="new">Новая</option>
                  <option value="confirmed">Подтверждена</option>
                  <option value="rejected">Отклонена</option>
                </select>
              </div>
            </>
          )}
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>
          )}
          <Button
            className="rounded-full"
            style={{ background: BRAND.ink, color: BRAND.cream }}
            disabled={saving || !form.name || !form.date}
            onClick={save}
          >
            {saving ? "Сохраняем…" : initial ? "Сохранить изменения" : "Сохранить бронь"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
