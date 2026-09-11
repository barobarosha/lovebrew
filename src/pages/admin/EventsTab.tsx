import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { BRAND, formatDateRu } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Ticket, Trash2, X } from "lucide-react";

type EventForm = {
  id?: number;
  title: string;
  description: string;
  date: string;
  time: string;
  price: string;
  imageUrl: string;
  isPublished: boolean;
  registrationOpen: boolean;
};

const EMPTY: EventForm = {
  title: "",
  description: "",
  date: "",
  time: "",
  price: "",
  imageUrl: "",
  isPublished: true,
  registrationOpen: false,
};

const REG_STATUS: Record<string, { label: string; bg: string }> = {
  new: { label: "Новая", bg: BRAND.pink },
  confirmed: { label: "Подтверждена", bg: BRAND.sage },
  rejected: { label: "Отклонена", bg: "#D8D4C6" },
};

export function EventsTab({ token }: { token: string }) {
  const list = trpc.admin.events.useQuery({ token });
  const utils = trpc.useUtils();
  const [form, setForm] = useState<EventForm | null>(null);
  const [regsFor, setRegsFor] = useState<number | null>(null);

  const save = trpc.admin.saveEvent.useMutation({
    onSuccess: () => {
      utils.admin.events.invalidate();
      utils.site.events.invalidate();
      utils.site.calendar.invalidate();
      setForm(null);
    },
  });
  const remove = trpc.admin.deleteEvent.useMutation({
    onSuccess: () => {
      utils.admin.events.invalidate();
      utils.site.events.invalidate();
      utils.site.calendar.invalidate();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-xl text-sm opacity-70">
          Анонсы мероприятий в лофте: отображаются в разделе «Афиша» и в
          календаре (★ на дате). Включите «Открыть запись» — и гости смогут
          записаться прямо с сайта и из приложения.
        </p>
        <Button
          className="rounded-full"
          style={{ background: BRAND.sageDeep, color: BRAND.white }}
          onClick={() => setForm(EMPTY)}
        >
          <Plus className="mr-1 h-4 w-4" /> Добавить анонс
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(list.data ?? []).map((e) => (
          <div key={e.id} className="rounded-3xl p-5" style={{ background: BRAND.white }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-60">
                  {formatDateRu(e.date)} {e.time && `· ${e.time}`}
                  {!e.isPublished && (
                    <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5">скрыт</span>
                  )}
                  {e.registrationOpen && (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5"
                      style={{ background: BRAND.pink }}
                    >
                      запись открыта
                    </span>
                  )}
                </p>
                <p className="font-display mt-1 text-lg font-semibold leading-snug">{e.title}</p>
                {e.price && (
                  <p className="font-display mt-1 text-sm font-bold" style={{ color: BRAND.sageDeep }}>
                    {e.price}
                  </p>
                )}
                {e.description && (
                  <p className="mt-2 line-clamp-2 text-sm opacity-70">{e.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() =>
                    setForm({
                      id: e.id,
                      title: e.title,
                      description: e.description ?? "",
                      date: e.date,
                      time: e.time ?? "",
                      price: e.price ?? "",
                      imageUrl: e.imageUrl ?? "",
                      isPublished: e.isPublished,
                      registrationOpen: e.registrationOpen,
                    })
                  }
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-red-600"
                  onClick={() => {
                    if (confirm("Удалить анонс вместе со всеми записями?")) remove.mutate({ token, id: e.id });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {e.registrationOpen && (
              <>
                <button
                  onClick={() => setRegsFor(regsFor === e.id ? null : e.id)}
                  className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                  style={{ background: BRAND.cream, color: BRAND.ink }}
                >
                  <Ticket className="h-3.5 w-3.5" /> Записи
                  {regsFor === e.id ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
                {regsFor === e.id && <RegistrationList token={token} eventId={e.id} />}
              </>
            )}
          </div>
        ))}
      </div>

      {(list.data ?? []).length === 0 && !list.isLoading && (
        <p className="rounded-3xl p-8 text-center opacity-60" style={{ background: BRAND.white }}>
          Анонсов пока нет
        </p>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md" style={{ background: BRAND.white }}>
          <DialogHeader>
            <DialogTitle className="font-display">
              {form?.id ? "Редактировать анонс" : "Новый анонс"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Название</Label>
                <Input className="rounded-xl" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label>Описание</Label>
                <Textarea className="rounded-xl" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1">
                  <Label>Дата</Label>
                  <Input type="date" className="rounded-xl" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label>Время</Label>
                  <Input type="time" className="rounded-xl" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label>Цена</Label>
                  <Input className="rounded-xl" placeholder="500 ₽" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1">
                <Label>Ссылка на изображение (необязательно)</Label>
                <Input className="rounded-xl" placeholder="https://…" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
              </div>
              <label className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: BRAND.cream }}>
                <span className="text-sm font-semibold">Опубликован</span>
                <Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} />
              </label>
              <label className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: BRAND.cream }}>
                <span className="text-sm font-semibold">
                  Открыть запись
                  <span className="block text-xs font-normal opacity-60">
                    На сайте и в приложении появится кнопка «Записаться»
                  </span>
                </span>
                <Switch checked={form.registrationOpen} onCheckedChange={(v) => setForm({ ...form, registrationOpen: v })} />
              </label>
              {save.error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{save.error.message}</p>
              )}
              <Button
                className="rounded-full"
                style={{ background: BRAND.ink, color: BRAND.cream }}
                disabled={save.isPending || !form.title || !form.date}
                onClick={() =>
                  save.mutate({
                    token,
                    id: form.id,
                    title: form.title,
                    description: form.description || undefined,
                    date: form.date,
                    time: form.time || undefined,
                    price: form.price || undefined,
                    imageUrl: form.imageUrl || undefined,
                    isPublished: form.isPublished,
                    registrationOpen: form.registrationOpen,
                  })
                }
              >
                Сохранить
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegistrationList({ token, eventId }: { token: string; eventId: number }) {
  const regs = trpc.admin.eventRegistrations.useQuery({ token, eventId });
  const utils = trpc.useUtils();
  const setStatus = trpc.admin.setEventRegistrationStatus.useMutation({
    onSuccess: () => utils.admin.eventRegistrations.invalidate(),
  });
  const remove = trpc.admin.deleteEventRegistration.useMutation({
    onSuccess: () => utils.admin.eventRegistrations.invalidate(),
  });

  if (regs.isLoading) return <p className="mt-2 text-sm opacity-60">Загрузка…</p>;
  if (!regs.data?.length)
    return <p className="mt-2 text-sm opacity-60">Записей пока нет</p>;

  return (
    <div className="mt-3 space-y-2">
      {regs.data.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm"
          style={{ background: BRAND.cream }}
        >
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ background: REG_STATUS[r.status].bg }}
          >
            {REG_STATUS[r.status].label}
          </span>
          <span className="font-semibold">{r.name}</span>
          <span className="opacity-70">{r.phone}</span>
          <span className="ml-auto flex gap-1">
            {r.status !== "confirmed" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full"
                title="Подтвердить"
                onClick={() => setStatus.mutate({ token, id: r.id, status: "confirmed" })}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            {r.status !== "rejected" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full"
                title="Отклонить"
                onClick={() => setStatus.mutate({ token, id: r.id, status: "rejected" })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full text-red-600"
              title="Удалить"
              onClick={() => {
                if (confirm("Удалить запись?")) remove.mutate({ token, id: r.id });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </span>
        </div>
      ))}
    </div>
  );
}
