import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useTranslation } from "react-i18next";

/** Conferma esplicita di presa visione: evita di attivare una stagione "saltando" i passaggi. */
const AckStep: React.FC<{
  step: number;
  ack: Record<number, boolean>;
  set_ack: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  label: string;
}> = ({ step, ack, set_ack, label }) => (
  <div className="flex items-center gap-2 pt-1">
    <Checkbox
      id={`ack_${step}`}
      checked={!!ack[step]}
      onCheckedChange={(v) => set_ack((p) => ({ ...p, [step]: !!v }))}
    />
    <label htmlFor={`ack_${step}`} className="text-sm text-foreground cursor-pointer">
      {label}
    </label>
  </div>
);

export default function NuovaStagionePage() {
  const { t } = useTranslation("settings");
  const STEPS = [
    t("nuova_stagione.steps.nuova_stagione"),
    t("nuova_stagione.steps.disponibilita_ghiaccio"),
    t("nuova_stagione.steps.istruttori"),
    t("nuova_stagione.steps.catalogo_corsi"),
    t("nuova_stagione.steps.attiva_stagione"),
  ];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const club_id = get_current_club_id();
  const [step, set_step] = useState(0);
  const [nome, set_nome] = useState("");
  const [data_inizio, set_data_inizio] = useState("");
  const [data_fine, set_data_fine] = useState("");
  const [conferma, set_conferma] = useState(false);
  const [ack, set_ack] = useState<Record<number, boolean>>({});
  const [submitting, set_submitting] = useState(false);

  const { data: stagione_attiva } = useQuery({
    queryKey: ["stagione_attiva", club_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stagioni")
        .select("*")
        .eq("club_id", club_id)
        .eq("attiva", true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!club_id,
  });

  const can_advance = () => {
    if (step === 0) return nome.trim() && data_inizio && data_fine;
    if (step === 4) return conferma;
    return !!ack[step];
  };

  const handle_complete = async () => {
    if (submitting) return;
    set_submitting(true);
    try {
      const { error: err_close_existing } = await supabase
        .from("stagioni")
        .update({ attiva: false })
        .eq("club_id", club_id)
        .eq("attiva", true);
      if (err_close_existing) throw err_close_existing;

      const { error: err_reset_ghiaccio } = await supabase
        .from("disponibilita_ghiaccio")
        .delete()
        .eq("club_id", club_id);
      if (err_reset_ghiaccio) throw err_reset_ghiaccio;

      // Inserisci nuova stagione
      const { error: err_insert } = await supabase.from("stagioni").insert({
        club_id,
        nome: nome.trim(),
        data_inizio,
        data_fine,
        attiva: true,
        tipo: "Regolare",
      } as any);
      if (err_insert) throw err_insert;

      // Aggiorna setup_club con le nuove date
      const { data: existing } = await supabase
        .from("setup_club").select("id").eq("club_id", club_id).maybeSingle();
      if (existing) {
        await supabase.from("setup_club").update({ data_inizio_stagione: data_inizio, data_fine_stagione: data_fine }).eq("id", existing.id);
      } else {
        await supabase.from("setup_club").insert({ club_id, data_inizio_stagione: data_inizio, data_fine_stagione: data_fine });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stagione_attiva", club_id] }),
        queryClient.invalidateQueries({ queryKey: ["stagioni", club_id] }),
        queryClient.invalidateQueries({ queryKey: ["setup_club", club_id] }),
        queryClient.invalidateQueries({ queryKey: ["disponibilita_ghiaccio", club_id] }),
      ]);

      toast.success(t("nuova_stagione.toast.success", { nome: nome.trim() }));
      navigate("/setup-club", { replace: true });
    } catch (e: any) {
      toast.error(t("nuova_stagione.toast.error", { message: e?.message || t("nuova_stagione.toast.error_generic") }));
    } finally {
      set_submitting(false);
    }
  };

  const format_date = (d?: string | null) => {
    if (!d) return t("nuova_stagione.date_placeholder");
    try {
      return format(new Date(d), "d MMMM yyyy", { locale: it });
    } catch {
      return d;
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("nuova_stagione.page_title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("nuova_stagione.step_indicator", { current: step + 1, total: STEPS.length, label: STEPS[step] })}
        </p>
        <div className="flex gap-1.5 mt-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* PASSO 1 — Nuova Stagione */}
          {step === 0 && (
            <>
              {stagione_attiva ? (
                <div className="rounded-md border p-4 bg-muted/50 space-y-1">
                  <p className="text-sm font-medium text-foreground">{t("nuova_stagione.step1.current_season_title")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("nuova_stagione.step1.current_season_desc", { nome: stagione_attiva.nome, inizio: format_date(stagione_attiva.data_inizio), fine: format_date(stagione_attiva.data_fine) })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("nuova_stagione.step1.no_active_season")}</p>
              )}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">{t("nuova_stagione.step1.name_label")}</label>
                  <Input
                    placeholder={t("nuova_stagione.step1.name_placeholder")}
                    value={nome}
                    onChange={(e) => set_nome(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">{t("nuova_stagione.step1.start_date_label")}</label>
                    <Input type="date" value={data_inizio} onChange={(e) => set_data_inizio(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">{t("nuova_stagione.step1.end_date_label")}</label>
                    <Input type="date" value={data_fine} onChange={(e) => set_data_fine(e.target.value)} className="mt-1" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* PASSO 2 — Disponibilità Ghiaccio */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 space-y-1">
                  <p className="font-semibold">{t("nuova_stagione.step2.warning_title")}</p>
                  <p>
                    {t("nuova_stagione.step2.warning_desc", { club_config: t("nuova_stagione.step2.club_config_label") })}
                  </p>
                </div>
              </div>
              <AckStep step={1} ack={ack} set_ack={set_ack} label={t("nuova_stagione.step2.ack_label")} />
            </div>
          )}

          {/* PASSO 3 — Istruttori */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-md border p-4 bg-muted/50 flex items-start gap-2">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  {t("nuova_stagione.step3.info", { istruttori: t("nuova_stagione.step3.istruttori_label") })}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/istruttori")}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> {t("nuova_stagione.step3.go_to_istruttori")}
              </Button>
              <AckStep step={2} ack={ack} set_ack={set_ack} label={t("nuova_stagione.step3.ack_label")} />
            </div>
          )}

          {/* PASSO 4 — Catalogo Corsi */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-md border p-4 bg-muted/50 flex items-start gap-2">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  {t("nuova_stagione.step4.info")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/corsi")}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> {t("nuova_stagione.step4.go_to_corsi")}
              </Button>
              <AckStep step={3} ack={ack} set_ack={set_ack} label={t("nuova_stagione.step4.ack_label")} />
            </div>
          )}

          {/* PASSO 5 — Attiva Stagione */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Riepilogo verde */}
              <div className="rounded-md border border-green-500/30 bg-green-500/10 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800 space-y-1">
                    <p className="font-semibold">{t("nuova_stagione.step5.summary_title")}</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><strong>{t("nuova_stagione.step5.summary_name")}</strong> {nome}</li>
                      <li><strong>{t("nuova_stagione.step5.summary_start")}</strong> {format_date(data_inizio)}</li>
                      <li><strong>{t("nuova_stagione.step5.summary_end")}</strong> {format_date(data_fine)}</li>
                    </ul>
                    <p className="pt-1">{t("nuova_stagione.step5.summary_note")}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="conferma"
                  checked={conferma}
                  onCheckedChange={(v) => set_conferma(!!v)}
                />
                <label htmlFor="conferma" className="text-sm text-foreground cursor-pointer">
                  {t("nuova_stagione.step5.confirm_label")}
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => set_step((s) => s - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> {t("nuova_stagione.nav.back")}
        </Button>

        {step < 4 ? (
          <Button disabled={!can_advance()} onClick={() => set_step((s) => s + 1)}>
            {t("nuova_stagione.nav.next")} <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!conferma || submitting} onClick={handle_complete}>
            {submitting ? t("nuova_stagione.nav.creating") : t("nuova_stagione.nav.create_activate")}
          </Button>
        )}
      </div>
    </div>
  );
}
