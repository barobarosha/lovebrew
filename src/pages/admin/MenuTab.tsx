import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { BRAND } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileUp, Pencil, Plus, Trash2 } from "lucide-react";

type MenuForm = {
  id?: number;
  category: string;
  name: string;
  description: string;
  volume: string;
  price: string;
  sortOrder: number;
  isActive: boolean;
};

const EMPTY: MenuForm = {
  category: "Кофе",
  name: "",
  description: "",
  volume: "",
  price: "",
  sortOrder: 0,
  isActive: true,
};

export function MenuTab({ token }: { token: string }) {
  const list = trpc.admin.menu.useQuery({ token });
  const utils = trpc.useUtils();
  const [form, setForm] = useState<MenuForm | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);

  const save = trpc.admin.saveMenuItem.useMutation({
    onSuccess: () => {
      utils.admin.menu.invalidate();
      utils.site.content.invalidate();
      setForm(null);
    },
  });
  const remove = trpc.admin.deleteMenuItem.useMutation({
    onSuccess: () => {
      utils.admin.menu.invalidate();
      utils.site.content.invalidate();
    },
  });
  const importMenu = trpc.admin.importMenu.useMutation({
    onSuccess: (r) => {
      utils.admin.menu.invalidate();
      utils.site.content.invalidate();
      setImportMsg(`Импортировано позиций: ${r.count}`);
    },
    onError: (e) => setImportMsg(`Ошибка: ${e.message}`),
  });

  const handleFile = async (file: File) => {
    setImportMsg(null);
    try {
      const text = await file.text();
      let items: { category: string; name: string; description?: string; volume?: string; price: number }[];
      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error("JSON должен быть массивом");
        items = parsed.map((r) => ({
          category: String(r.category ?? "Прочее"),
          name: String(r.name ?? ""),
          description: r.description ? String(r.description) : undefined,
          volume: r.volume ? String(r.volume) : undefined,
          price: Number(r.price) || 0,
        }));
      } else {
        // CSV: category;name;volume;price;description  (разделитель ; или ,)
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const startIdx = /категория|category|название|name/i.test(lines[0] ?? "") ? 1 : 0;
        items = lines.slice(startIdx).map((line) => {
          const sep = line.includes(";") ? ";" : ",";
          const p = line.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
          return {
            category: p[0] || "Прочее",
            name: p[1] || "",
            volume: p[2] || undefined,
            price: parseInt(p[3] || "0", 10) || 0,
            description: p[4] || undefined,
          };
        });
      }
      items = items.filter((i) => i.name);
      if (!items.length) throw new Error("Не найдено ни одной позиции");
      importMenu.mutate({ token, mode: replaceMode ? "replace" : "append", items });
    } catch (e) {
      setImportMsg(`Не удалось прочитать файл: ${(e as Error).message}`);
    }
  };

  const categories = [...new Set((list.data ?? []).map((m) => m.category))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm opacity-70">
          Добавляйте позиции по одной или загрузите всё меню файлом (CSV:
          категория;название;объём;цена;описание — или JSON).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-full"
            style={{ background: BRAND.sageDeep, color: BRAND.white }}
            onClick={() => setForm(EMPTY)}
          >
            <Plus className="mr-1 h-4 w-4" /> Добавить позицию
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="mr-1 h-4 w-4" /> Загрузить файлом
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <label className="flex w-max items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold" style={{ background: BRAND.white }}>
        <Switch checked={replaceMode} onCheckedChange={setReplaceMode} />
        При импорте заменить всё текущее меню
      </label>

      {importMsg && (
        <p className="rounded-xl px-4 py-2 text-sm" style={{ background: BRAND.sage, color: BRAND.ink }}>
          {importMsg}
        </p>
      )}

      {categories.map((cat) => (
        <div key={cat} className="overflow-hidden rounded-3xl" style={{ background: BRAND.white }}>
          <p className="font-display px-5 pt-4 text-sm font-bold uppercase tracking-wider" style={{ color: BRAND.sageDeep }}>
            {cat}
          </p>
          <div className="divide-y p-2" style={{ borderColor: BRAND.creamDeep }}>
            {(list.data ?? [])
              .filter((m) => m.category === cat)
              .map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {m.name}
                      {m.volume && <span className="ml-2 text-xs opacity-50">{m.volume}</span>}
                      {!m.isActive && (
                        <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px]">скрыта</span>
                      )}
                    </p>
                    {m.description && (
                      <p className="truncate text-xs opacity-60">{m.description}</p>
                    )}
                  </div>
                  <span className="font-display text-sm font-bold">{m.price} ₽</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full"
                    onClick={() =>
                      setForm({
                        id: m.id,
                        category: m.category,
                        name: m.name,
                        description: m.description ?? "",
                        volume: m.volume ?? "",
                        price: String(m.price),
                        sortOrder: m.sortOrder,
                        isActive: m.isActive,
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full text-red-600"
                    onClick={() => {
                      if (confirm(`Удалить «${m.name}»?`)) remove.mutate({ token, id: m.id });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
          </div>
        </div>
      ))}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md" style={{ background: BRAND.white }}>
          <DialogHeader>
            <DialogTitle className="font-display">
              {form?.id ? "Редактировать позицию" : "Новая позиция"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label>Категория</Label>
                  <Input className="rounded-xl" list="menu-cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  <datalist id="menu-cats">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="grid gap-1">
                  <Label>Цена, ₽</Label>
                  <Input type="number" min={0} className="rounded-xl" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1">
                <Label>Название</Label>
                <Input className="rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label>Объём/вес</Label>
                  <Input className="rounded-xl" placeholder="350 мл" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label>Порядок</Label>
                  <Input type="number" className="rounded-xl" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: +e.target.value || 0 })} />
                </div>
              </div>
              <div className="grid gap-1">
                <Label>Описание</Label>
                <Input className="rounded-xl" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <label className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: BRAND.cream }}>
                <span className="text-sm font-semibold">Показывать на сайте</span>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </label>
              {save.error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{save.error.message}</p>
              )}
              <Button
                className="rounded-full"
                style={{ background: BRAND.ink, color: BRAND.cream }}
                disabled={save.isPending || !form.name || !form.category}
                onClick={() =>
                  save.mutate({
                    token,
                    id: form.id,
                    category: form.category,
                    name: form.name,
                    description: form.description || undefined,
                    volume: form.volume || undefined,
                    price: parseInt(form.price, 10) || 0,
                    sortOrder: form.sortOrder,
                    isActive: form.isActive,
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
