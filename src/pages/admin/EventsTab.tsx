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
import { Pencil, Plus, Trash2 } from "lucide-react";

type EventForm = {
  id?: number;
  title: string;
  description: string;
  date: string;
  time: string;
  price: string;
  imageUrl: string;
  isPublished: boolean;
};

const EMPTY: EventForm = {
  title: "",
  description: "",
  date: "",
  time: "",
  price: "",
  imageUrl: "",
  isPublished: true,
};

export function EventsTab({ token }: { token: string }) {
  const list = trpc.admin.events.useQuery({ token });
  const utils = trpc.useUtils();
  const [form, setForm] = useState<EventForm | null>(null);

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
          календаре (★ на дате).
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
                    if (confirm("Удалить анонс?")) remove.mutate({ token, id: e.id });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
