import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Send, Check, X, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { segnala_errore } from "@/lib/errori";
import { use_stagione_attiva } from "@/lib/stagione-attiva";
import {
  use_stato_campagna,
  use_registro_stagione,
  use_apri_campagna,
  use_chiudi_campagna,
  use_conferma_rinnovo_segreteria,
  use_rifiuta_rinnovo_segreteria,
  use_invia_email_iscrizioni,
  use_anteprima_apertura,
  type RigaRegistro,
  type EsitoInvio,
} from "@/hooks/use-iscrizioni-stagione";
import { get_livello_display } from "@/lib/atleta-livello";

const data_breve = (v: string | null, lingua: string) =>
  v ? new Date(v).toLocaleDateString(lingua, { day: "numeric", month: "short", year: "numeric" }) : "";

const TabRinnovi: React.FC<{ puo_gestire: boolean; vai_a_domande: () => void }> = ({
  puo_gestire,
  vai_a_domande,
}) => {
  const { t, i18n } = useTranslation("atleti");
  const k = (s: string, o?: any) => t(`iscrizioni_stagione.${s}`, o as any) as string;

  const { data: stagione, isLoading: load_stagione, isError: err_stagione } = use_stagione_attiva();
  const stato = use_stato_campagna(stagione?.id);
  const registro = use_registro_stagione(stagione?.id);
  // Numeri veri prima di aprire: senza questa lettura non si esegue niente.
  const anteprima = use_anteprima_apertura(stagione?.id);

  const apri = use_apri_campagna();
  const chiudi = use_chiudi_campagna();
  const conferma = use_conferma_rinnovo_segreteria();
  const rifiuta = use_rifiuta_rinnovo_segreteria();
  const email = use_invia_email_iscrizioni();

  const [query, set_query] = useState("");
  const [dialog_apri, set_dialog_apri] = useState(false);
  const [dialog_chiudi, set_dialog_chiudi] = useState(false);
  const [scadenza, set_scadenza] = useState("");
  const [riga_rifiuto, set_riga_rifiuto] = useState<RigaRegistro | null>(null);
  const [motivo, set_motivo] = useState("");

  const lista = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (registro.data ?? [])
      .filter((r) => r.status === "invitato")
      .filter((r) => {
        if (!q) return true;
        const nome = `${r.atleta?.cognome ?? ""} ${r.atleta?.nome ?? ""}`.toLowerCase();
        return nome.includes(q);
      })
      .sort((a, b) =>
        `${a.atleta?.cognome ?? ""}${a.atleta?.nome ?? ""}`.localeCompare(
          `${b.atleta?.cognome ?? ""}${b.atleta?.nome ?? ""}`,
        ),
      );
  }, [registro.data, query]);

  const mostra_esito = (e: EsitoInvio) => {
    const parti = [k("rinnovi.esito_invio", { count: e.inviati })];
    if (e.senza_email > 0) parti.push(k("rinnovi.esito_senza_email", { count: e.senza_email }));
    if ((e.senza_codice ?? 0) > 0) parti.push(k("rinnovi.esito_senza_codice", { count: e.senza_codice }));
    if ((e.non_registrati ?? 0) > 0) parti.push(k("rinnovi.esito_non_registrati", { count: e.non_registrati }));
    if ((e.falliti?.length ?? 0) > 0) parti.push(k("rinnovi.esito_falliti", { count: e.falliti!.length }));
    toast({
      title: parti.join(" · "),
      variant: e.senza_email > 0 || (e.falliti?.length ?? 0) > 0 ? "destructive" : undefined,
    });
  };

  const invia_inviti = async (atleta_ids?: string[]) => {
    if (!stagione?.id) return;
    try {
      const esito = await email.mutateAsync({
        tipo: "invito_rinnovo",
        stagione_id: stagione.id,
        ...(atleta_ids ? { atleta_ids } : {}),
      });
      mostra_esito(esito);
    } catch (e) {
      segnala_errore("TabRinnovi", k("rinnovi.invia_inviti"), e);
    }
  };

  if (load_stagione || stato.isLoading || registro.isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (err_stagione || stato.isError || registro.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
        <p className="text-sm text-destructive">{k("rinnovi.errore_lettura")}</p>
        <Button
          variant="outline"
          onClick={() => {
            stato.refetch();
            registro.refetch();
          }}
        >
          {k("comune.riprova")}
        </Button>
      </div>
    );
  }

  if (!stagione) {
    return <p className="text-sm text-muted-foreground">{k("rinnovi.nessuna_stagione")}</p>;
  }

  const s = stato.data!;
  const invitati_ids = (registro.data ?? []).filter((r) => r.status === "invitato").map((r) => r.atleta_id);
  const totale_risposte = s.confermati + s.non_rinnovati;
  const totale_campagna = totale_risposte + s.invitati;
  const avanzamento = totale_campagna > 0 ? Math.round((totale_risposte / totale_campagna) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-lg font-semibold text-foreground">{k("rinnovi.tabellone_titolo")}</h2>
          <p className="text-sm text-muted-foreground">{k("rinnovi.tabellone_spiegazione")}</p>
        </div>
        {puo_gestire && s.aperta && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="h-11"
              disabled={email.isPending || invitati_ids.length === 0}
              onClick={() => invia_inviti(invitati_ids)}
            >
              <Send className="w-4 h-4 mr-2" />
              {k("rinnovi.sollecita")}
            </Button>
            <Button variant="destructive" className="h-11" onClick={() => set_dialog_chiudi(true)}>
              {k("rinnovi.chiudi_bottone")}
            </Button>
          </div>
        )}
      </div>

      {/* I numeri della campagna */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: k("rinnovi.confermati"), valore: String(s.confermati) },
          { label: k("rinnovi.in_attesa"), valore: String(s.invitati) },
          { label: k("rinnovi.non_rinnovati"), valore: String(s.non_rinnovati) },
          {
            label: k("rinnovi.scadenza"),
            valore: s.scadenza ? data_breve(`${s.scadenza}T00:00:00`, i18n.language) : k("rinnovi.senza_scadenza"),
          },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1 break-words">{c.valore}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2" aria-label={k("rinnovi.avanzamento_label", { percentuale: avanzamento })}>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{k("rinnovi.avanzamento")}</span>
          <span className="tabular-nums text-muted-foreground">{avanzamento}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${avanzamento}%` }} />
        </div>
        <button type="button" onClick={vai_a_domande} className="text-sm font-medium text-primary hover:underline">
          {k("rinnovi.domande_collegamento", { count: s.domande_in_attesa })}
        </button>
      </div>

      {/* Apertura della campagna */}
      {puo_gestire && !s.aperta && (
        <div className="flex flex-wrap items-center gap-3">
            <Button className="h-10" onClick={() => set_dialog_apri(true)}>
              <CalendarDays className="w-4 h-4 mr-2" />
              {k("rinnovi.apri_bottone", { stagione: stagione.nome })}
            </Button>
        </div>
      )}

      <div className="space-y-1 pt-2">
        <h3 className="text-base font-semibold text-foreground">{k("rinnovi.in_attesa_titolo")}</h3>
        <p className="text-sm text-muted-foreground">{k("rinnovi.azioni_eccezione")}</p>
      </div>

      {/* Ricerca fra chi non ha ancora risposto */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => set_query(e.target.value)}
            placeholder={k("rinnovi.cerca")}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {/* Elenco */}
      {lista.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed border-border">
          <p className="text-sm text-muted-foreground">{k("rinnovi.nessun_atleta")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-left font-medium">{k("rinnovi.col_atleta")}</th>
                <th className="p-3 text-left font-medium">{k("rinnovi.col_livello")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.atleta_id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="p-3 font-medium text-foreground">
                    {r.atleta ? `${r.atleta.cognome ?? ""} ${r.atleta.nome ?? ""}`.trim() : r.atleta_id.slice(0, 8)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {r.livello || (r.atleta ? get_livello_display(r.atleta as any) : "—")}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {puo_gestire && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 mr-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        disabled={conferma.isPending}
                        onClick={async () => {
                          try {
                            await conferma.mutateAsync({ atleta_id: r.atleta_id, stagione_id: stagione.id });
                            toast({ title: k("rinnovi.confermato_ok") });
                          } catch (e) {
                            segnala_errore("TabRinnovi", k("rinnovi.azione_conferma"), e);
                          }
                        }}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        {k("rinnovi.azione_conferma")}
                      </Button>
                    )}
                    {puo_gestire && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 mr-2 border-destructive/20 text-destructive hover:bg-destructive/5"
                        onClick={() => {
                          set_motivo("");
                          set_riga_rifiuto(r);
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        {k("rinnovi.azione_non_rinnovato")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Apertura campagna */}
      <Dialog open={dialog_apri} onOpenChange={(o) => !apri.isPending && set_dialog_apri(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{k("rinnovi.apri_conferma_titolo", { stagione: stagione.nome })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">{k("rinnovi.apri_scadenza_label")}</span>
              <Input type="date" value={scadenza} onChange={(e) => set_scadenza(e.target.value)} className="h-10" />
            </label>
            {anteprima.isLoading && (
              <p className="text-muted-foreground">{k("rinnovi.apri_conteggio_in_corso")}</p>
            )}
            {anteprima.isError && (
              <p className="text-destructive">{k("rinnovi.apri_conteggio_errore")}</p>
            )}
            {anteprima.isSuccess && (
              <p className="text-foreground font-medium">
                {k("rinnovi.apri_conteggio", { count: anteprima.data.da_invitare })}
                {anteprima.data.gia_presenti > 0
                  ? ` ${k("rinnovi.apri_gia_presenti", { count: anteprima.data.gia_presenti })}`
                  : ""}
              </p>
            )}
            <p className="text-muted-foreground">{k("rinnovi.apri_conferma_testo")}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => set_dialog_apri(false)} disabled={apri.isPending}>
                {k("comune.annulla")}
              </Button>
              <Button
                disabled={apri.isPending || !anteprima.isSuccess}
                onClick={async () => {
                  try {
                    const esito = await apri.mutateAsync({
                      stagione_id: stagione.id,
                      scadenza: scadenza || null,
                    });
                    toast({
                      title: k("rinnovi.apri_esito", {
                        invitati: esito.invitati,
                        gia_presenti: esito.gia_presenti,
                      }),
                    });
                    set_dialog_apri(false);
                  } catch (e) {
                    segnala_errore("TabRinnovi", k("rinnovi.apri_bottone", { stagione: stagione.nome }), e);
                  }
                }}
              >
                {k("comune.conferma")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chiusura campagna */}
      <Dialog open={dialog_chiudi} onOpenChange={(o) => !chiudi.isPending && set_dialog_chiudi(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{k("rinnovi.chiudi_conferma_titolo")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {k("rinnovi.chiudi_conferma_testo", { count: s.invitati })}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => set_dialog_chiudi(false)} disabled={chiudi.isPending}>
                {k("comune.annulla")}
              </Button>
              <Button
                variant="destructive"
                disabled={chiudi.isPending}
                onClick={async () => {
                  try {
                    const quanti = await chiudi.mutateAsync({ stagione_id: stagione.id });
                    toast({ title: k("rinnovi.chiudi_esito", { count: quanti }) });
                    set_dialog_chiudi(false);
                  } catch (e) {
                    segnala_errore("TabRinnovi", k("rinnovi.chiudi_bottone"), e);
                  }
                }}
              >
                {k("rinnovi.chiudi_bottone")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Non rinnovato: motivo */}
      <Dialog open={!!riga_rifiuto} onOpenChange={(o) => !rifiuta.isPending && !o && set_riga_rifiuto(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{k("rinnovi.azione_non_rinnovato")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Input
              value={motivo}
              onChange={(e) => set_motivo(e.target.value)}
              placeholder={k("rinnovi.motivo_label")}
              className="h-10"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => set_riga_rifiuto(null)} disabled={rifiuta.isPending}>
                {k("comune.annulla")}
              </Button>
              <Button
                variant="destructive"
                disabled={rifiuta.isPending}
                onClick={async () => {
                  if (!riga_rifiuto) return;
                  try {
                    await rifiuta.mutateAsync({
                      atleta_id: riga_rifiuto.atleta_id,
                      stagione_id: stagione.id,
                      motivo,
                    });
                    toast({ title: k("rinnovi.non_rinnovato_ok") });
                    set_riga_rifiuto(null);
                  } catch (e) {
                    segnala_errore("TabRinnovi", k("rinnovi.azione_non_rinnovato"), e);
                  }
                }}
              >
                {k("comune.conferma")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TabRinnovi;
