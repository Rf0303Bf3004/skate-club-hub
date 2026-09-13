import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, CalendarClock, User } from "lucide-react";
import { toast } from "sonner";

export interface RichiestaLezione {
  id: string;
  club_id: string;
  atleta_id: string;
  istruttore_id: string | null;
  data_preferita: string | null;
  fascia_preferita: string | null;
  note_richiesta: string | null;
  stato: string;
  lezione_id: string | null;
  note_risposta: string | null;
  gestita_il: string | null;
  created_at: string;
}

export const QUERY_KEY_RICHIESTE_PRIVATE = ["richieste_lezioni_private"] as const;

export function use_richieste_lezioni_private() {
  return useQuery({
    queryKey: [...QUERY_KEY_RICHIESTE_PRIVATE, get_current_club_id()],
    queryFn: async (): Promise<RichiestaLezione[]> => {
      const club_id = get_current_club_id();
      const { data, error } = await supabase
        .from("richieste_lezioni_private")
        .select(
          "id, club_id, atleta_id, istruttore_id, data_preferita, fascia_preferita, note_richiesta, stato, lezione_id, note_risposta, gestita_il, created_at",
        )
        .eq("club_id", club_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RichiestaLezione[];
    },
    enabled: !!get_current_club_id(),
  });
}

function giorni_attesa(created_at: string): number {
  const ms = Date.now() - new Date(created_at).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

interface Props {
  atleti: { id: string; nome: string; cognome: string }[];
  istruttori: { id: string; nome: string; cognome: string }[];
  puo_gestire: boolean;
  richiesta_pendente_id: string | null;
  on_accetta: (r: RichiestaLezione) => void;
}

const RichiesteLezioniPrivateTab: React.FC<Props> = ({
  atleti,
  istruttori,
  puo_gestire,
  richiesta_pendente_id,
  on_accetta,
}) => {
  const { t, i18n } = useTranslation("common");
  const qc = useQueryClient();
  const { data, isSuccess, isError, error, isFetching, refetch } = use_richieste_lezioni_private();

  React.useEffect(() => {
    if (isError) {
      segnala_errore("RichiesteLezioniPrivateTab", "lettura richieste_lezioni_private", error, {}, "avviso");
    }
  }, [isError, error]);

  const [mostra_storico, set_mostra_storico] = useState(false);
  const [rifiuta_id, set_rifiuta_id] = useState<string | null>(null);
  const [nota_rifiuto, set_nota_rifiuto] = useState("");
  const [salvando, set_salvando] = useState(false);

  const richieste = data ?? [];
  const in_attesa = useMemo(() => richieste.filter((r) => r.stato === "in_attesa"), [richieste]);
  const gestite = useMemo(() => richieste.filter((r) => r.stato !== "in_attesa"), [richieste]);

  const nome_atleta = (id: string) => {
    const a = atleti.find((x) => x.id === id);
    return a ? `${a.nome} ${a.cognome}` : id.slice(0, 8);
  };
  const nome_istruttore = (id: string | null) => {
    if (!id) return t("richieste_private.nessuna_preferenza");
    const i = istruttori.find((x) => x.id === id);
    return i ? `${i.nome} ${i.cognome}` : id.slice(0, 8);
  };
  const etichetta_fascia = (f: string | null) => {
    if (f === "mattina") return t("richieste_private.fascia_mattina");
    if (f === "pomeriggio") return t("richieste_private.fascia_pomeriggio");
    if (f === "sera") return t("richieste_private.fascia_sera");
    return t("richieste_private.nessuna_preferenza");
  };
  const etichetta_stato = (s: string) => {
    if (s === "accettata") return t("richieste_private.stato_accettata");
    if (s === "rifiutata") return t("richieste_private.stato_rifiutata");
    if (s === "annullata") return t("richieste_private.stato_annullata");
    return t("richieste_private.stato_in_attesa");
  };
  const data_label = (d: string | null) =>
    d ? new Date(`${d}T00:00:00`).toLocaleDateString(i18n.language) : t("richieste_private.nessuna_preferenza");

  const conferma_rifiuto = async () => {
    if (!rifiuta_id) return;
    if (!nota_rifiuto.trim()) {
      toast.error(t("richieste_private.motivo_obbligatorio"));
      return;
    }
    set_salvando(true);
    try {
      const { data: utente, error: err_utente } = await supabase.auth.getUser();
      if (err_utente) throw err_utente;
      const { error: err_update } = await supabase
        .from("richieste_lezioni_private")
        .update({
          stato: "rifiutata",
          note_risposta: nota_rifiuto.trim(),
          gestita_da: utente?.user?.id ?? null,
          gestita_il: new Date().toISOString(),
        })
        .eq("id", rifiuta_id)
        .eq("club_id", get_current_club_id());
      if (err_update) throw err_update;
      toast.success(t("richieste_private.rifiutata_ok"));
      set_rifiuta_id(null);
      set_nota_rifiuto("");
      await qc.invalidateQueries({ queryKey: QUERY_KEY_RICHIESTE_PRIVATE });
    } catch (e) {
      await segnala_errore("RichiesteLezioniPrivateTab", t("richieste_private.rifiuta"), e, { rifiuta_id });
    } finally {
      set_salvando(false);
    }
  };

  if (isError) {
    return (
      <div className="bg-card rounded-2xl shadow-card p-6 space-y-3">
        <div className="flex items-start gap-3 text-destructive">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{t("richieste_private.errore_lettura")}</p>
            <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t("richieste_private.riprova")}
        </Button>
      </div>
    );
  }

  if (!isSuccess) {
    return (
      <div className="bg-card rounded-2xl shadow-card p-8 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{t("richieste_private.caricamento")}</span>
      </div>
    );
  }

  const azioni_attive = puo_gestire && isSuccess && !isFetching && !salvando;

  const Riga: React.FC<{ r: RichiestaLezione; storico?: boolean }> = ({ r, storico }) => (
    <div
      className={`rounded-xl border p-4 space-y-2 ${
        richiesta_pendente_id === r.id ? "border-primary bg-primary/5" : "border-border bg-muted/20"
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{nome_atleta(r.atleta_id)}</span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {etichetta_stato(r.stato)}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
        <span>
          {t("richieste_private.istruttore_preferito")}: <b className="text-foreground">{nome_istruttore(r.istruttore_id)}</b>
        </span>
        <span>
          {t("richieste_private.data_preferita")}: <b className="text-foreground">{data_label(r.data_preferita)}</b>
        </span>
        <span>
          {t("richieste_private.fascia_preferita")}: <b className="text-foreground">{etichetta_fascia(r.fascia_preferita)}</b>
        </span>
      </div>
      {r.note_richiesta && (
        <p className="text-sm text-foreground bg-background rounded-lg px-3 py-2">{r.note_richiesta}</p>
      )}
      {r.note_risposta && (
        <p className="text-sm text-foreground bg-background rounded-lg px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground block">
            {t("richieste_private.risposta_club")}
          </span>
          {r.note_risposta}
        </p>
      )}
      {!storico && (
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="w-3.5 h-3.5" />
            {t("richieste_private.attesa_giorni", { count: giorni_attesa(r.created_at) })}
          </span>
          {puo_gestire && (
            <div className="flex gap-2">
              <Button size="sm" disabled={!azioni_attive} onClick={() => on_accetta(r)}>
                {t("richieste_private.accetta")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!azioni_attive}
                onClick={() => {
                  set_rifiuta_id(r.id);
                  set_nota_rifiuto("");
                }}
              >
                {t("richieste_private.rifiuta")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {rifiuta_id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground">{t("richieste_private.motivo_rifiuto")}</h2>
            <textarea
              rows={4}
              value={nota_rifiuto}
              onChange={(e) => set_nota_rifiuto(e.target.value)}
              placeholder={t("richieste_private.motivo_rifiuto_placeholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={salvando}
                onClick={() => {
                  set_rifiuta_id(null);
                  set_nota_rifiuto("");
                }}
              >
                {t("richieste_private.annulla")}
              </Button>
              <Button variant="destructive" disabled={salvando || !nota_rifiuto.trim()} onClick={conferma_rifiuto}>
                {t("richieste_private.conferma_rifiuto")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl shadow-card p-5 space-y-3">
        <h2 className="text-sm font-bold text-foreground">{t("richieste_private.in_attesa")}</h2>
        {in_attesa.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("richieste_private.nessuna_richiesta")}</p>
        ) : (
          in_attesa.map((r) => <Riga key={r.id} r={r} />)
        )}
      </div>

      <div className="bg-card rounded-2xl shadow-card p-5 space-y-3">
        <button
          onClick={() => set_mostra_storico((v) => !v)}
          className="text-sm font-bold text-foreground hover:text-primary transition-colors"
        >
          {mostra_storico ? t("richieste_private.nascondi_storico") : t("richieste_private.mostra_storico")} ({gestite.length})
        </button>
        {mostra_storico &&
          (gestite.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("richieste_private.nessuna_richiesta_gestita")}</p>
          ) : (
            <div className="space-y-3">
              {gestite.map((r) => (
                <Riga key={r.id} r={r} storico />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
};

export default RichiesteLezioniPrivateTab;
