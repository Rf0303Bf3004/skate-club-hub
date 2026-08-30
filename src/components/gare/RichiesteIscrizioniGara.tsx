import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Send, Check, X, AlertTriangle, Loader2 } from "lucide-react";
import { format_data_breve } from "@/lib/format-data";
import { get_livello_atleta, rank_livello, normalizza_livello } from "@/lib/gare-iscrivibilita";
import { segnala_errore } from "@/lib/errori";

type Stato = "richiesta" | "inviata" | "confermata" | "non_accettata" | "ritirata";

const ETICHETTE: Record<Stato, string> = {
  richiesta: "Richieste",
  inviata: "Inviate",
  confermata: "Confermate",
  non_accettata: "Non accettate",
  ritirata: "Ritirate",
};

interface Props {
  gara: any;
  atleti: any[];
}

const RichiesteIscrizioniGara: React.FC<Props> = ({ gara, atleti }) => {
  const queryClient = useQueryClient();
  const [selezione, set_selezione] = useState<Record<string, boolean>>({});
  const [motivo, set_motivo] = useState("");
  const [mostra_motivo, set_mostra_motivo] = useState(false);
  const [in_corso, set_in_corso] = useState(false);

  const { data: righe = [], isLoading, refetch } = useQuery({
    queryKey: ["iscrizioni_gara_stati", gara.id],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("iscrizioni_gare")
        .select("id,atleta_id,carriera,stato,stato_motivo,stato_il,created_at")
        .eq("gara_id", gara.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const atleti_map = useMemo(() => new Map(atleti.map((a: any) => [a.id, a])), [atleti]);
  const rank_minimo = rank_livello(gara?.livello_minimo);

  const per_stato = (s: Stato) => righe.filter((r) => (r.stato ?? "richiesta") === s);

  const conteggi = (["richiesta", "inviata", "confermata", "non_accettata", "ritirata"] as Stato[])
    .map((s) => ({ s, n: per_stato(s).length }))
    .filter((x) => x.n > 0);

  const selezionati = (lista: any[]) => lista.filter((r) => selezione[r.id]).map((r) => r.id);

  const toggle_tutti = (lista: any[], on: boolean) => {
    set_selezione((p) => {
      const n = { ...p };
      lista.forEach((r) => (n[r.id] = on));
      return n;
    });
  };

  const dopo_azione = async () => {
    set_selezione({});
    set_motivo("");
    set_mostra_motivo(false);
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ["gare"] });
  };

  const invia = async (ids: string[]) => {
    if (ids.length === 0) return;
    set_in_corso(true);
    const { error } = await (supabase as any).rpc("invia_iscrizioni_gara", { p_iscrizioni: ids });
    set_in_corso(false);
    if (error) { await segnala_errore("RichiesteIscrizioniGara", "Invio iscrizioni gara", error); return; }
    toast({ title: `${ids.length} richieste inviate al club organizzatore` });
    await dopo_azione();
  };

  const esito = async (ids: string[], p_esito: "confermata" | "non_accettata", p_motivo?: string) => {
    if (ids.length === 0) return;
    if (p_esito === "non_accettata" && !p_motivo?.trim()) {
      toast({ title: "Motivo obbligatorio", variant: "destructive" });
      return;
    }
    set_in_corso(true);
    const { error } = await (supabase as any).rpc("esito_iscrizioni_gara", {
      p_iscrizioni: ids,
      p_esito,
      p_motivo: p_motivo?.trim() || null,
    });
    set_in_corso(false);
    if (error) { await segnala_errore("RichiesteIscrizioniGara", "Aggiornamento esito iscrizioni", error); return; }
    toast({ title: p_esito === "confermata" ? `${ids.length} iscrizioni confermate` : `${ids.length} iscrizioni non accettate` });
    await dopo_azione();
  };

  const NomeRiga: React.FC<{ r: any; children?: React.ReactNode }> = ({ r, children }) => {
    const a = atleti_map.get(r.atleta_id);
    const livello = get_livello_atleta(a);
    const sotto = rank_minimo >= 0 && rank_livello(livello) >= 0 && rank_livello(livello) < rank_minimo;
    return (
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {children}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {a ? `${a.cognome ?? ""} ${a.nome ?? ""}`.trim() : r.atleta_id.slice(0, 8)}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span>{livello || "—"}</span>
            {sotto && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                <AlertTriangle className="w-3 h-3" /> sotto il minimo ({normalizza_livello(gara.livello_minimo)})
              </span>
            )}
            <span>· {format_data_breve(r.created_at)}</span>
          </p>
        </div>
      </div>
    );
  };

  const richieste = per_stato("richiesta");
  const inviate = per_stato("inviata");
  const confermate = per_stato("confermata");
  const non_accettate = per_stato("non_accettata");
  const ritirate = per_stato("ritirata");

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {conteggi.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna richiesta di iscrizione</p>
        ) : (
          conteggi.map(({ s, n }) => (
            <Badge key={s} variant="secondary" className="text-xs">
              {n} {ETICHETTE[s].toLowerCase()}
            </Badge>
          ))
        )}
      </div>

      {/* RICHIESTE */}
      {richieste.length > 0 && (
        <section className="bg-card rounded-xl shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-foreground">Richieste ({richieste.length})</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={richieste.every((r) => selezione[r.id])}
                  onCheckedChange={(v) => toggle_tutti(richieste, !!v)}
                />
                Seleziona tutti
              </label>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={in_corso || selezionati(richieste).length === 0}
                onClick={() => invia(selezionati(richieste))}
              >
                <Send className="w-3.5 h-3.5" /> Invia al club organizzatore
              </Button>
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {richieste.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2">
                <NomeRiga r={r}>
                  <Checkbox
                    checked={!!selezione[r.id]}
                    onCheckedChange={(v) => set_selezione((p) => ({ ...p, [r.id]: !!v }))}
                  />
                </NomeRiga>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* INVIATE */}
      {inviate.length > 0 && (
        <section className="bg-card rounded-xl shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-foreground">Inviate — in attesa di risposta ({inviate.length})</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={inviate.every((r) => selezione[r.id])}
                  onCheckedChange={(v) => toggle_tutti(inviate, !!v)}
                />
                Seleziona tutti
              </label>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={in_corso || selezionati(inviate).length === 0}
                onClick={() => esito(selezionati(inviate), "confermata")}
              >
                <Check className="w-3.5 h-3.5" /> Conferma selezionate
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={in_corso || selezionati(inviate).length === 0}
                onClick={() => set_mostra_motivo(true)}
              >
                <X className="w-3.5 h-3.5" /> Non accettate
              </Button>
            </div>
          </div>

          {mostra_motivo && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-destructive">Motivo del rifiuto (obbligatorio)</p>
              <Textarea
                value={motivo}
                onChange={(e) => set_motivo(e.target.value)}
                rows={2}
                placeholder="es. posti esauriti"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { set_mostra_motivo(false); set_motivo(""); }}>
                  Annulla
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={in_corso || !motivo.trim()}
                  onClick={() => esito(selezionati(inviate), "non_accettata", motivo)}
                >
                  Registra rifiuto
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border/50">
            {inviate.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2">
                <NomeRiga r={r}>
                  <Checkbox
                    checked={!!selezione[r.id]}
                    onCheckedChange={(v) => set_selezione((p) => ({ ...p, [r.id]: !!v }))}
                  />
                </NomeRiga>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CONFERMATE */}
      {confermate.length > 0 && (
        <section className="bg-card rounded-xl shadow-card p-4 space-y-2">
          <h3 className="text-sm font-bold text-emerald-600">Confermate ({confermate.length})</h3>
          <div className="divide-y divide-border/50">
            {confermate.map((r) => (
              <div key={r.id} className="py-2"><NomeRiga r={r} /></div>
            ))}
          </div>
        </section>
      )}

      {/* NON ACCETTATE */}
      {non_accettate.length > 0 && (
        <section className="bg-card rounded-xl shadow-card p-4 space-y-2">
          <h3 className="text-sm font-bold text-destructive">Non accettate ({non_accettate.length})</h3>
          <div className="divide-y divide-border/50">
            {non_accettate.map((r) => (
              <div key={r.id} className="py-2 flex items-center gap-3">
                <NomeRiga r={r} />
                <span className="text-xs text-destructive shrink-0">{r.stato_motivo || "—"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RITIRATE */}
      {ritirate.length > 0 && (
        <section className="bg-card rounded-xl shadow-card p-4 space-y-2 opacity-60">
          <h3 className="text-sm font-bold text-muted-foreground">Ritirate ({ritirate.length})</h3>
          <div className="divide-y divide-border/50">
            {ritirate.map((r) => (
              <div key={r.id} className="py-2"><NomeRiga r={r} /></div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default RichiesteIscrizioniGara;
