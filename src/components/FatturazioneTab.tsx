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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Calendar, Mail, FileText, Loader2, BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import ContabilitaSection from "@/components/setup/ContabilitaSection";

/** "7, 21" -> [7, 21]. Torna null se il testo non è utilizzabile. */
function leggi_giorni(testo: string): number[] | null {
  const pezzi = testo
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (pezzi.length < 1 || pezzi.length > 5) return null;
  const numeri: number[] = [];
  for (const p of pezzi) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > 365) return null;
    if (!numeri.includes(n)) numeri.push(n);
  }
  return numeri.sort((a, b) => a - b);
}

const FatturazioneTab: React.FC = () => {
  const { t } = useTranslation("fatture");
  const { puo_gestire_fatture } = usePermessiAzione();
  const qc = useQueryClient();
  const { data: setup } = use_setup_club();

  const [automatica, set_automatica] = useState<boolean>(
    Boolean((setup as any)?.fatturazione_automatica ?? false),
  );
  const [giorno, set_giorno] = useState<number>(
    Number((setup as any)?.fatturazione_giorno_mese ?? 1),
  );
  const [mese_riferimento, set_mese_riferimento] = useState<string>(
    String((setup as any)?.fatturazione_mese_riferimento ?? "precedente"),
  );
  const [email_auto, set_email_auto] = useState<boolean>(
    Boolean((setup as any)?.fatturazione_invio_email_auto ?? false),
  );
  const [costo_test, set_costo_test] = useState<string>(
    String((setup as any)?.fatturazione_costo_test ?? 0),
  );
  const [sollecito_attivo, set_sollecito_attivo] = useState<boolean>(
    Boolean((setup as any)?.sollecito_attivo ?? false),
  );
  const [sollecito_giorni, set_sollecito_giorni] = useState<string>(
    Array.isArray((setup as any)?.sollecito_giorni)
      ? (setup as any).sollecito_giorni.join(", ")
      : "7, 21",
  );
  const [saving, set_saving] = useState(false);
  const [anteprima_open, set_anteprima_open] = useState(false);

  // Sync quando arriva il setup
  React.useEffect(() => {
    if (setup) {
      set_automatica(Boolean((setup as any).fatturazione_automatica ?? false));
      set_giorno(Number((setup as any).fatturazione_giorno_mese ?? 1));
      set_mese_riferimento(String((setup as any).fatturazione_mese_riferimento ?? "precedente"));
      set_email_auto(Boolean((setup as any).fatturazione_invio_email_auto ?? false));
      set_costo_test(String((setup as any).fatturazione_costo_test ?? 0));
      set_sollecito_attivo(Boolean((setup as any).sollecito_attivo ?? false));
      set_sollecito_giorni(
        Array.isArray((setup as any).sollecito_giorni)
          ? (setup as any).sollecito_giorni.join(", ")
          : "7, 21",
      );
    }
  }, [setup]);

  const handle_save = async () => {
    const giorni = leggi_giorni(sollecito_giorni);
    if (!giorni) {
      toast({
        title: t("billing_tab.reminder_days_invalid"),
        variant: "destructive",
      });
      return;
    }
    set_saving(true);
    try {
      const club_id = get_current_club_id();
      const giorno_clamped = Math.max(1, Math.min(28, Number(giorno) || 1));
      const payload: any = {
        fatturazione_automatica: automatica,
        fatturazione_giorno_mese: giorno_clamped,
        fatturazione_mese_riferimento:
          mese_riferimento === "corrente" ? "corrente" : "precedente",
        fatturazione_invio_email_auto: email_auto,
        fatturazione_costo_test: Number(costo_test) || 0,
        sollecito_attivo: sollecito_attivo,
        sollecito_giorni: giorni,
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
      {/* 1. Le fatture del mese */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">{t("billing_tab.auto_title")}</h2>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="space-y-0.5 pr-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <Label htmlFor="fatturazione_automatica" className="text-sm font-medium">
                {t("billing_tab.auto_switch_label")}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">{t("billing_tab.auto_switch_desc")}</p>
          </div>
          <Switch
            id="fatturazione_automatica"
            checked={automatica}
            onCheckedChange={set_automatica}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="giorno">{t("billing_tab.day_label")}</Label>
            <Input
              id="giorno"
              type="number"
              min={1}
              max={28}
              disabled={!automatica}
              value={giorno}
              onChange={(e) => set_giorno(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mese_riferimento">{t("billing_tab.reference_month_label")}</Label>
            <Select
              value={mese_riferimento}
              onValueChange={set_mese_riferimento}
              disabled={!automatica}
            >
              <SelectTrigger id="mese_riferimento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="precedente">{t("billing_tab.reference_month_previous")}</SelectItem>
                <SelectItem value="corrente">{t("billing_tab.reference_month_current")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!automatica && (
          <p className="text-xs text-muted-foreground">{t("billing_tab.auto_off_note")}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </section>

      <Separator />

      {/* 2. L'invio alle famiglie */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">{t("billing_tab.sending_title")}</h2>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="space-y-0.5 pr-4">
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

        {email_auto && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            {t("billing_tab.email_auto_warning")}
          </div>
        )}
      </section>

      <Separator />

      {/* 3. Solleciti */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">{t("billing_tab.reminder_title")}</h2>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="space-y-0.5 pr-4">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-primary" />
              <Label htmlFor="sollecito_attivo" className="text-sm font-medium">
                {t("billing_tab.reminder_switch_label")}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">{t("billing_tab.reminder_switch_desc")}</p>
          </div>
          <Switch
            id="sollecito_attivo"
            checked={sollecito_attivo}
            onCheckedChange={set_sollecito_attivo}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sollecito_giorni">{t("billing_tab.reminder_days_label")}</Label>
          <Input
            id="sollecito_giorni"
            type="text"
            inputMode="numeric"
            disabled={!sollecito_attivo}
            value={sollecito_giorni}
            onChange={(e) => set_sollecito_giorni(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("billing_tab.reminder_days_help")}</p>
        </div>

        {puo_gestire_fatture ? (
          <Button onClick={handle_save} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {t("billing_tab.save")}
          </Button>
        ) : (
          <NotaPermesso testo="Solo la segreteria e il presidente possono emettere fatture." />
        )}
      </section>

      <Separator />

      {/* 4. Generazione manuale con anteprima (calcolo nel database) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">{t("billing_tab.manual_title")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t("billing_tab.manual_desc")}</p>

        {puo_gestire_fatture ? (
          <Button variant="outline" onClick={() => set_anteprima_open(true)}>
            <FileText className="w-4 h-4 mr-2" />
            {t("billing_tab.preview")}
          </Button>
        ) : (
          <NotaPermesso testo="Solo la segreteria e il presidente possono emettere fatture." />
        )}

        <p className="text-xs text-muted-foreground">{t("billing_tab.no_duplicates_note")}</p>
      </section>

      <Separator />

      {/* 5. Conti e codici per l'esportazione verso i programmi di contabilità */}
      <section className="space-y-4">
        <ContabilitaSection />
      </section>

      {puo_gestire_fatture && (
        <AnteprimaFatturePeriodoDialog open={anteprima_open} onOpenChange={set_anteprima_open} />
      )}
    </div>
  );
};

export default FatturazioneTab;
