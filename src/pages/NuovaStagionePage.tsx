import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const STEPS = ["Riepilogo", "Ghiaccio", "Istruttori", "Catalogo e Costi", "Reset Iscrizioni"];

export default function NuovaStagionePage() {
  const navigate = useNavigate();
  const club_id = get_current_club_id();
  const [step, set_step] = useState(0);
  const [nome, set_nome] = useState("");
  const [data_inizio, set_data_inizio] = useState("");
  const [data_fine, set_data_fine] = useState("");
  const [conferma, set_conferma] = useState(false);
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
    return true;
  };

  const handle_complete = async () => {
    if (submitting) return;
    set_submitting(true);
    try {
      const stag_id = stagione_attiva?.id;

      // (1) DELETE iscrizioni_corsi della stagione corrente
      if (stag_id) {
        const { data: corsi_prev } = await supabase
          .from("corsi").select("id").eq("club_id", club_id).eq("stagione_id", stag_id);
        if (corsi_prev?.length) {
          const ids = corsi_prev.map((c) => c.id);
          await supabase.from("iscrizioni_corsi").delete().in("corso_id", ids);
          // (4) DELETE corsi_monitori della stagione corrente
          await supabase.from("corsi_monitori").delete().in("corso_id", ids);
        }
      }

      // (2) DELETE lezioni_private_atlete del club
      const { data: lez_club } = await supabase
        .from("lezioni_private").select("id").eq("club_id", club_id);
      if (lez_club?.length) {
        await supabase.from("lezioni_private_atlete").delete().in("lezione_id", lez_club.map((l) => l.id));
      }

      // (3) DELETE lezioni_private del club
      await supabase.from("lezioni_private").delete().eq("club_id", club_id);

      // (5-7) DELETE planning della stagione corrente
      if (stag_id) {
        const { data: settimane } = await supabase
          .from("planning_settimane").select("id").eq("club_id", club_id).eq("stagione_id", stag_id);
        if (settimane?.length) {
          const sett_ids = settimane.map((s) => s.id);
          await supabase.from("planning_private_settimana").delete().in("settimana_id", sett_ids);
          await supabase.from("planning_corsi_settimana").delete().in("settimana_id", sett_ids);
        }
        await supabase.from("planning_settimane").delete().eq("club_id", club_id).eq("stagione_id", stag_id);
      }

      // (8) DELETE richieste_iscrizione in_attesa
      await supabase.from("richieste_iscrizione").delete().eq("club_id", club_id).eq("stato", "in_attesa");

      // (9) UPDATE adesioni_atleta → terminata
      await supabase.from("adesioni_atleta").update({ stato: "terminata" }).eq("club_id", club_id).eq("stato", "attiva");

      // (10) UPDATE stagione precedente → attiva=false
      if (stag_id) {
        await supabase.from("stagioni").update({ attiva: false }).eq("id", stag_id);
      }

      // (11) INSERT nuova stagione
      const { error: err_insert } = await supabase.from("stagioni").insert({
        club_id,
        nome: nome.trim(),
        data_inizio,
        data_fine,
        attiva: true,
        tipo: "Regolare",
      });
      if (err_insert) throw err_insert;

      // Aggiorna setup_club con le nuove date
      const { data: existing } = await supabase
        .from("setup_club").select("id").eq("club_id", club_id).maybeSingle();
      if (existing) {
        await supabase.from("setup_club").update({ data_inizio_stagione: data_inizio, data_fine_stagione: data_fine }).eq("id", existing.id);
      } else {
        await supabase.from("setup_club").insert({ club_id, data_inizio_stagione: data_inizio, data_fine_stagione: data_fine });
      }

      // (12) Toast e naviga
      toast.success(`Nuova stagione "${nome.trim()}" creata. Gli atleti possono re-iscriversi dall'app.`);
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error("Errore: " + (e?.message || "operazione fallita"));
    } finally {
      set_submitting(false);
    }
  };

  const format_date = (d?: string | null) => {
    if (!d) return "—";
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
        <h1 className="text-2xl font-bold text-foreground">Nuova Stagione</h1>
        <p className="text-muted-foreground mt-1">
          Passo {step + 1} di {STEPS.length} — {STEPS[step]}
        </p>
        {/* Progress */}
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
          {step === 0 && (
            <>
              {stagione_attiva ? (
                <div className="rounded-md border p-4 bg-muted/50 space-y-1">
                  <p className="text-sm font-medium text-foreground">Stagione corrente attiva</p>
                  <p className="text-sm text-muted-foreground">
                    <strong>{stagione_attiva.nome}</strong> — dal{" "}
                    {format_date(stagione_attiva.data_inizio)} al{" "}
                    {format_date(stagione_attiva.data_fine)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nessuna stagione attiva trovata.</p>
              )}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Nome nuova stagione</label>
                  <Input
                    placeholder="es. Stagione 2026-2027"
                    value={nome}
                    onChange={(e) => set_nome(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Data inizio</label>
                    <Input
                      type="date"
                      value={data_inizio}
                      onChange={(e) => set_data_inizio(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Data fine</label>
                    <Input
                      type="date"
                      value={data_fine}
                      onChange={(e) => set_data_fine(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                Dopo aver creato la stagione potrai configurare la disponibilità ghiaccio in{" "}
                <strong>Planning Ghiaccio</strong>.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/planning")}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Vai a Planning Ghiaccio
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                Gli istruttori esistenti saranno disponibili per la nuova stagione. Puoi modificare
                disponibilità e costi in <strong>Istruttori</strong>.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/istruttori")}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Vai a Istruttori
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                I corsi esistenti verranno copiati nella nuova stagione. Potrai modificarli in{" "}
                <strong>Corsi</strong>.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/corsi")}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Vai a Corsi
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-destructive space-y-1">
                    <p className="font-semibold">ATTENZIONE</p>
                    <p>
                      Questa operazione rimuoverà tutte le iscrizioni a corsi, pacchetti e lezioni
                      private della stagione corrente. I dati degli atleti e lo storico vengono
                      mantenuti. <strong>Questa azione è irreversibile.</strong>
                    </p>
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
                  Ho letto e confermo di voler procedere
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => set_step((s) => s - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Indietro
        </Button>

        {step < 4 ? (
          <Button disabled={!can_advance()} onClick={() => set_step((s) => s + 1)}>
            Avanti <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            disabled={!conferma || submitting}
            onClick={handle_complete}
          >
            {submitting ? "Creazione..." : "Completa e Crea Nuova Stagione"}
          </Button>
        )}
      </div>
    </div>
  );
}
