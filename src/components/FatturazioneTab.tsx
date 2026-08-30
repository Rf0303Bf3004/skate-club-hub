import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { use_setup_club } from "@/hooks/use-supabase-data";
import AnteprimaFatturePeriodoDialog from "@/components/fatture/AnteprimaFatturePeriodoDialog";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Calendar, Mail, FileText, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const FatturazioneTab: React.FC = () => {
  const { t } = useTranslation("fatture");
  const qc = useQueryClient();
  const { data: setup } = use_setup_club();

  const [giorno, set_giorno] = useState<number>(
    Number((setup as any)?.fatturazione_giorno_mese ?? 1),
  );
  const [email_auto, set_email_auto] = useState<boolean>(
    Boolean((setup as any)?.fatturazione_invio_email_auto ?? false),
  );
  const [costo_test, set_costo_test] = useState<string>(
    String((setup as any)?.fatturazione_costo_test ?? 0),
  );
  const [saving, set_saving] = useState(false);
  const [anteprima_open, set_anteprima_open] = useState(false);

  // Sync quando arriva il setup
  React.useEffect(() => {
    if (setup) {
      set_giorno(Number((setup as any).fatturazione_giorno_mese ?? 1));
      set_email_auto(Boolean((setup as any).fatturazione_invio_email_auto ?? false));
      set_costo_test(String((setup as any).fatturazione_costo_test ?? 0));
    }
  }, [setup]);

  const handle_save = async () => {
    set_saving(true);
    try {
      const club_id = get_current_club_id();
      const giorno_clamped = Math.max(1, Math.min(28, Number(giorno) || 1));
      const payload: any = {
        fatturazione_giorno_mese: giorno_clamped,
        fatturazione_invio_email_auto: email_auto,
        fatturazione_costo_test: Number(costo_test) || 0,
      };
      if ((setup as any)?.id) {
        const { error } = await supabase.from("setup_club").update(payload).eq("id", (setup as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("setup_club").insert({ club_id, ...payload });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["setup_club", club_id] });
      toast({ title: t("billing_tab.toast_saved") });
    } catch (err: any) {
      toast({ title: t("billing_tab.toast_save_error"), description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-8 max-w-3xl">
      {/* Generazione automatica */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">{t("billing_tab.auto_title")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t("billing_tab.auto_desc")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="giorno">{t("billing_tab.day_label")}</Label>
            <Input
              id="giorno"
              type="number"
              min={1}
              max={28}
              value={giorno}
              onChange={(e) => set_giorno(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="costo_test">{t("billing_tab.test_cost_label")}</Label>
            <Input
              id="costo_test"
              type="number"
              min={0}
              step="0.01"
              value={costo_test}
              onChange={(e) => set_costo_test(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <Label htmlFor="email_auto" className="text-sm font-medium">
                {t("billing_tab.email_auto_label")}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">{t("billing_tab.email_auto_desc")}</p>
          </div>
          <Switch id="email_auto" checked={email_auto} onCheckedChange={set_email_auto} />
        </div>

        <Button onClick={handle_save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {t("billing_tab.save")}
        </Button>
      </section>

      <Separator />

      {/* Generazione manuale con anteprima (calcolo nel database) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">{t("billing_tab.manual_title")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t("billing_tab.manual_desc")}</p>

        <Button variant="outline" onClick={() => set_anteprima_open(true)}>
          <FileText className="w-4 h-4 mr-2" />
          {t("billing_tab.preview")}
        </Button>

        <p className="text-xs text-muted-foreground">{t("billing_tab.no_duplicates_note")}</p>
      </section>

      <AnteprimaFatturePeriodoDialog open={anteprima_open} onOpenChange={set_anteprima_open} />
    </div>
  );
};

export default FatturazioneTab;
