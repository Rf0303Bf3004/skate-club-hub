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
import { CATEGORIE_BLOCCO, label_blocco } from "./categorie";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  on_close: () => void;
  club_id: string;
  stagione_id: string;
  blocco: any | null;
  default_ordine: number;
}

export default function BloccoForm({ open, on_close, club_id, stagione_id, blocco, default_ordine }: Props) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const [categoria, set_categoria] = useState<string>("staff");
  const [titolo, set_titolo] = useState("");
  const [contenuto, set_contenuto] = useState("");
  const [ordine, set_ordine] = useState<number>(default_ordine);
  const [permanente, set_permanente] = useState(false);

  useEffect(() => {
    if (open) {
      set_categoria(blocco?.categoria ?? "staff");
      set_titolo(blocco?.titolo ?? "");
      set_contenuto(blocco?.contenuto ?? "");
      set_ordine(blocco?.ordine ?? default_ordine);
      set_permanente(blocco ? blocco.stagione_id === null : false);
    }
  }, [open, blocco, default_ordine]);

  const m_save = useMutation({
    mutationFn: async () => {
      const payload = {
        club_id,
        stagione_id: permanente ? null : stagione_id,
        categoria,
        titolo: titolo.trim(),
        contenuto,
        ordine,
      };
      if (blocco?.id) {
        const { error } = await supabase.from("relazioni_blocchi_testo" as any).update(payload).eq("id", blocco.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("relazioni_blocchi_testo" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relazioni_blocchi", club_id, stagione_id] });
      toast.success(blocco ? t("relazione.blocco_form.toast_aggiornato") : t("relazione.blocco_form.toast_creato"));
      on_close();
    },
    onError: (e: any) => toast.error(e.message ?? t("relazione.blocco_form.toast_errore")),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && on_close()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{blocco ? t("relazione.blocco_form.title_edit") : t("relazione.blocco_form.title_new")}</SheetTitle>
          <SheetDescription>{t("relazione.blocco_form.description")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div>
            <Label>{t("relazione.blocco_form.categoria")}</Label>
            <Select value={categoria} onValueChange={set_categoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIE_BLOCCO.map((c) => <SelectItem key={c.value} value={c.value}>{label_blocco(c.value)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("relazione.blocco_form.titolo")}</Label>
            <Input
              value={titolo}
              onChange={(e) => set_titolo(e.target.value)}
              placeholder={t("relazione.blocco_form.titolo_placeholder")}
            />
          </div>
          <div>
            <Label>{t("relazione.blocco_form.contenuto")}</Label>
            <Textarea
              value={contenuto}
              onChange={(e) => set_contenuto(e.target.value)}
              rows={10}
              placeholder={t("relazione.blocco_form.contenuto_placeholder")}
            />
            <p className="text-xs text-muted-foreground mt-1">{t("relazione.blocco_form.markdown_hint")}</p>
          </div>
          <div>
            <Label>{t("relazione.blocco_form.ordine")}</Label>
            <Input type="number" value={ordine} onChange={(e) => set_ordine(parseInt(e.target.value) || 0)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">{t("relazione.blocco_form.permanente")}</Label>
              <p className="text-xs text-muted-foreground">{t("relazione.blocco_form.permanente_hint")}</p>
            </div>
            <Switch checked={permanente} onCheckedChange={set_permanente} />
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={on_close}>{t("relazione.blocco_form.annulla")}</Button>
          <Button onClick={() => m_save.mutate()} disabled={!titolo.trim() || m_save.isPending}>
            {t("relazione.blocco_form.salva")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
