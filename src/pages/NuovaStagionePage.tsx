import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const STEPS = ["Nuova Stagione", "Disponibilità Ghiaccio", "Istruttori", "Catalogo Corsi", "Attiva Stagione"];

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
      // Azzera disponibilità ghiaccio del club
      await supabase.from("disponibilita_ghiaccio").delete().eq("club_id", club_id);

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

      toast.success(`Nuova stagione "${nome.trim()}" creata! Configura la disponibilità ghiaccio per iniziare.`);
      navigate("/setup-club", { replace: true });
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
                  <p className="text-sm font-medium text-foreground">Stagione corrente (verrà archiviata)</p>
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
                    <Input type="date" value={data_inizio} onChange={(e) => set_data_inizio(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Data fine</label>
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
                  <p className="font-semibold">Azzeramento fasce ghiaccio</p>
                  <p>
                    Le fasce orario ghiaccio verranno azzerate. Potrai configurarle da zero in{" "}
                    <strong>Configurazione Club</strong> dopo aver creato la stagione.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3 — Istruttori */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-md border p-4 bg-muted/50 flex items-start gap-2">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  Gli istruttori esistenti restano disponibili. Verifica e aggiorna disponibilità e costi in{" "}
                  <strong>Istruttori</strong>.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/istruttori")}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Vai a Istruttori
              </Button>
            </div>
          )}

          {/* PASSO 4 — Catalogo Corsi */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-md border p-4 bg-muted/50 flex items-start gap-2">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  Dovrai creare i nuovi corsi per la nuova stagione. I corsi della stagione precedente restano archiviati.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/corsi")}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Vai a Corsi
              </Button>
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
                    <p className="font-semibold">Riepilogo nuova stagione</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><strong>Nome:</strong> {nome}</li>
                      <li><strong>Inizio:</strong> {format_date(data_inizio)}</li>
                      <li><strong>Fine:</strong> {format_date(data_fine)}</li>
                    </ul>
                    <p className="pt-1">Le fasce ghiaccio verranno azzerate. Istruttori e storico corsi restano disponibili.</p>
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
                  Confermo di voler creare la nuova stagione
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => set_step((s) => s - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Indietro
        </Button>

        {step < 4 ? (
          <Button disabled={!can_advance()} onClick={() => set_step((s) => s + 1)}>
            Avanti <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!conferma || submitting} onClick={handle_complete}>
            {submitting ? "Creazione..." : "Crea e Attiva Nuova Stagione"}
          </Button>
        )}
      </div>
    </div>
  );
}
