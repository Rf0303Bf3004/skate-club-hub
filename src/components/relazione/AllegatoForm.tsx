import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { CATEGORIE_ALLEGATO } from "./categorie";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

interface Props {
  open: boolean;
  on_close: () => void;
  club_id: string;
  stagione_id: string;
  allegato: any | null;
  default_ordine: number;
}

const MAX_BYTES = 20 * 1024 * 1024;

const tk = (key: string) => i18n.t(key, { ns: "dashboard" }) as string;

export default function AllegatoForm({ open, on_close, club_id, stagione_id, allegato, default_ordine }: Props) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const [categoria, set_categoria] = useState("bilancio");
  const [titolo, set_titolo] = useState("");
  const [descrizione, set_descrizione] = useState("");
  const [ordine, set_ordine] = useState<number>(default_ordine);
  const [permanente, set_permanente] = useState(false);
  const [file, set_file] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      set_categoria(allegato?.categoria ?? "bilancio");
      set_titolo(allegato?.titolo ?? "");
      set_descrizione(allegato?.descrizione ?? "");
      set_ordine(allegato?.ordine ?? default_ordine);
      set_permanente(allegato ? allegato.stagione_id === null : false);
      set_file(null);
    }
  }, [open, allegato, default_ordine]);

  const m_save = useMutation({
    mutationFn: async () => {
      let file_url = allegato?.file_url ?? "placeholder://new-file.pdf";
      let file_size_bytes = allegato?.file_size_bytes ?? null;
      let upload_failed = false;

      if (file) {
        if (file.size > MAX_BYTES) throw new Error(tk("relazione.allegato_form.errore_dimensione"));
        const path = `${club_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: up_err } = await supabase.storage.from("relazioni-allegati").upload(path, file, {
          contentType: file.type || "application/pdf",
          upsert: false,
        });
        if (up_err) {
          upload_failed = true;
          file_url = `placeholder://${file.name}`;
          file_size_bytes = file.size;
        } else {
          file_url = path;
          file_size_bytes = file.size;
        }
      }

      const payload = {
        club_id,
        stagione_id: permanente ? null : stagione_id,
        categoria,
        titolo: titolo.trim(),
        descrizione: descrizione.trim() || null,
        ordine,
        file_url,
        file_size_bytes,
        mime_type: file?.type || allegato?.mime_type || "application/pdf",
      };

      if (allegato?.id) {
        const { error } = await supabase.from("relazioni_allegati" as any).update(payload).eq("id", allegato.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("relazioni_allegati" as any).insert(payload);
        if (error) throw error;
      }

      return { upload_failed };
    },
    onSuccess: ({ upload_failed }) => {
      qc.invalidateQueries({ queryKey: ["relazioni_allegati", club_id, stagione_id] });
      if (upload_failed) {
        toast.warning(t("relazione.allegato_form.toast_storage_ko"));
      } else {
        toast.success(allegato ? t("relazione.allegato_form.toast_aggiornato") : t("relazione.allegato_form.toast_creato"));
      }
      on_close();
    },
    onError: (e: any) => toast.error(e.message ?? t("relazione.allegato_form.toast_errore")),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && on_close()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{allegato ? t("relazione.allegato_form.title_edit") : t("relazione.allegato_form.title_new")}</SheetTitle>
          <SheetDescription>{t("relazione.allegato_form.description")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div>
            <Label>{t("relazione.allegato_form.categoria")}</Label>
            <Select value={categoria} onValueChange={set_categoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIE_ALLEGATO.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("relazione.allegato_form.titolo")}</Label>
            <Input
              value={titolo}
              onChange={(e) => set_titolo(e.target.value)}
              placeholder={t("relazione.allegato_form.titolo_placeholder")}
            />
          </div>
          <div>
            <Label>{t("relazione.allegato_form.descrizione")}</Label>
            <Textarea value={descrizione} onChange={(e) => set_descrizione(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>{t("relazione.allegato_form.ordine")}</Label>
            <Input type="number" value={ordine} onChange={(e) => set_ordine(parseInt(e.target.value) || 0)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">{t("relazione.allegato_form.permanente")}</Label>
              <p className="text-xs text-muted-foreground">{t("relazione.allegato_form.permanente_hint")}</p>
            </div>
            <Switch checked={permanente} onCheckedChange={set_permanente} />
          </div>
          <div>
            <Label>{t("relazione.allegato_form.file_pdf")}</Label>
            <Input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => set_file(e.target.files?.[0] ?? null)}
            />
            {allegato && !file && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("relazione.allegato_form.file_corrente", { file: allegato.file_url })}
              </p>
            )}
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={on_close}>{t("relazione.allegato_form.annulla")}</Button>
          <Button onClick={() => m_save.mutate()} disabled={!titolo.trim() || m_save.isPending}>
            {t("relazione.allegato_form.salva")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
