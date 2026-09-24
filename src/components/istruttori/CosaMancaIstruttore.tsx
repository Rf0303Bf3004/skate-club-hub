import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, CheckCircle2, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmButton from "@/components/common/ConfirmButton";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { segnala_errore } from "@/lib/errori";
import { format_data_completa } from "@/lib/format-data";

/**
 * Riquadro «Cosa manca» della scheda istruttore.
 *
 * Distingue «vuoto» da «deciso di lasciare vuoto»: l'elenco si calcola sui dati,
 * la riga in `completamenti_saltati` serve solo a non richiedere più quel campo.
 * Non blocca mai il salvataggio della scheda.
 */

export type CampoMancanteIstruttore =
  | "disponibilita"
  | "tariffa_oraria"
  | "accesso_app"
  | "gs_valido_fino"
  | "data_nascita";

type Livello = "impedisce" | "utile";

const VOCI: { campo: CampoMancanteIstruttore; livello: Livello; vai: string }[] = [
  { campo: "disponibilita", livello: "impedisce", vai: "cosa_manca.vai_disponibilita" },
  { campo: "tariffa_oraria", livello: "impedisce", vai: "cosa_manca.vai_compenso" },
  { campo: "accesso_app", livello: "impedisce", vai: "cosa_manca.vai_accesso" },
  { campo: "gs_valido_fino", livello: "impedisce", vai: "cosa_manca.vai_scheda" },
  { campo: "data_nascita", livello: "utile", vai: "cosa_manca.vai_scheda" },
];

type RigaSaltata = {
  id: string;
  campo: string;
  saltato_da: string | null;
  saltato_il: string;
  nome_chi: string | null;
};

interface Props {
  istruttore: any;
  /** Stato della lettura dell'istruttore (anagrafica + disponibilità + tariffe). */
  lettura_istruttore: { isSuccess: boolean; isError: boolean; refetch: () => unknown };
  puo_vedere_costi: boolean;
  puo_saltare: boolean;
  /** Per ogni campo, se chi guarda può raggiungere il punto in cui si compila. */
  destinazione_disponibile: Record<CampoMancanteIstruttore, boolean>;
  on_vai: (campo: CampoMancanteIstruttore) => void;
}

const tariffa_assente = (v: unknown) => v === null || v === undefined || Number(v) === 0;

const CosaMancaIstruttore: React.FC<Props> = ({
  istruttore,
  lettura_istruttore,
  puo_vedere_costi,
  puo_saltare,
  destinazione_disponibile,
  on_vai,
}) => {
  const { t } = useTranslation("istruttori");
  const { session } = useAuth();
  const qc = useQueryClient();
  const club_id = get_current_club_id();
  const [saltati_aperti, set_saltati_aperti] = useState(false);
  const chiave_saltati = ["completamenti_saltati", club_id, "istruttore", istruttore?.id];

  const saltati_query = useQuery({
    queryKey: chiave_saltati,
    enabled: !!club_id && !!istruttore?.id,
    queryFn: async (): Promise<RigaSaltata[]> => {
      const { data, error } = await supabase
        .from("completamenti_saltati")
        .select("id, campo, saltato_da, saltato_il")
        .eq("club_id", club_id)
        .eq("entita", "istruttore")
        .eq("entita_id", istruttore.id);
      if (error) throw error;
      const righe = data ?? [];
      const ids = [...new Set(righe.map((r) => r.saltato_da).filter((x): x is string => !!x))];
      const nomi = new Map<string, string>();
      if (ids.length > 0) {
        const { data: utenti, error: e2 } = await supabase
          .from("utenti_club")
          .select("user_id, nome, cognome")
          .eq("club_id", club_id)
          .in("user_id", ids);
        if (e2) throw e2;
        (utenti ?? []).forEach((u: any) => {
          const n = `${u.nome ?? ""} ${u.cognome ?? ""}`.trim();
          if (n) nomi.set(u.user_id, n);
        });
      }
      return righe.map((r) => ({ ...r, nome_chi: r.saltato_da ? nomi.get(r.saltato_da) ?? null : null }));
    },
  });

  // Avviso d'errore fuori dalla queryFn: un solo avviso per guasto, non uno per tentativo.
  useEffect(() => {
    if (saltati_query.isError) {
      void segnala_errore(
        "CosaMancaIstruttore",
        t("cosa_manca.errore"),
        saltati_query.error,
        { istruttore_id: istruttore?.id },
        "avviso",
      );
    }
  }, [saltati_query.isError, saltati_query.error, istruttore?.id, t]);

  const aggiorna = () =>
    Promise.allSettled([
      qc.invalidateQueries({ queryKey: ["completamenti_saltati"] }),
      qc.invalidateQueries({ queryKey: ["istruttori"] }),
    ]);

  const salta = useMutation({
    mutationFn: async (campo: CampoMancanteIstruttore) => {
      if (!club_id || !session?.user_id) throw new Error(t("cosa_manca.errore_salta"));
      const { error } = await supabase.from("completamenti_saltati").insert({
        club_id,
        entita: "istruttore",
        entita_id: istruttore.id,
        campo,
        saltato_da: session.user_id,
      });
      if (error) throw error;
    },
    onError: (err) => void segnala_errore("CosaMancaIstruttore", t("cosa_manca.errore_salta"), err),
    onSettled: () => aggiorna(),
  });

  const riapri = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("completamenti_saltati")
        .delete()
        .eq("id", id)
        .eq("club_id", club_id);
      if (error) throw error;
    },
    onError: (err) => void segnala_errore("CosaMancaIstruttore", t("cosa_manca.errore_riapri"), err),
    onSettled: () => aggiorna(),
  });

  // Tariffe: se il contratto è a ore e chi guarda è autorizzato ma le tariffe non sono
  // arrivate, non si può dire se mancano. Chi non vede i costi non riceve la voce.
  const tariffa_applicabile = istruttore?.tipo_contratto === "orario" && puo_vedere_costi;
  const costi_illeggibili = tariffa_applicabile && !istruttore?.costi_visibili;

  const pronto = lettura_istruttore.isSuccess && saltati_query.isSuccess && !costi_illeggibili;
  const fallito = lettura_istruttore.isError || saltati_query.isError || (lettura_istruttore.isSuccess && costi_illeggibili);

  const { mancanti, saltati } = useMemo(() => {
    if (!pronto || !istruttore) return { mancanti: [], saltati: [] as (RigaSaltata & { livello: Livello })[] };
    const disp = istruttore.disponibilita ?? {};
    const vuota = (campo: CampoMancanteIstruttore): boolean => {
      switch (campo) {
        case "disponibilita":
          return !Object.values(disp).some((f: any) => Array.isArray(f) && f.length > 0);
        case "tariffa_oraria":
          return (
            tariffa_applicabile &&
            (tariffa_assente(istruttore.costo_orario_corsi) || tariffa_assente(istruttore.costo_orario_lezioni))
          );
        case "accesso_app":
          return !istruttore.user_id;
        case "gs_valido_fino":
          // Con qualifica «nessuna» la scadenza non esiste e il campo non si mostra.
          return (istruttore.qualifica_gs || "nessuna") !== "nessuna" && !istruttore.gs_valido_fino;
        case "data_nascita":
          return !istruttore.data_nascita;
      }
    };
    const per_campo = new Map((saltati_query.data ?? []).map((r) => [r.campo, r]));
    const m: typeof VOCI = [];
    const s: (RigaSaltata & { livello: Livello })[] = [];
    VOCI.forEach((v) => {
      if (!vuota(v.campo)) return;
      const r = per_campo.get(v.campo);
      if (r) s.push({ ...r, livello: v.livello });
      else m.push(v);
    });
    return { mancanti: m, saltati: s };
  }, [pronto, istruttore, saltati_query.data, tariffa_applicabile]);

  const riprova = () => {
    void lettura_istruttore.refetch();
    void saltati_query.refetch();
  };

  if (fallito) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 text-sm text-destructive">
          <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{costi_illeggibili && !saltati_query.isError ? t("cosa_manca.errore_costi") : t("cosa_manca.errore")}</span>
        </div>
        <Button size="sm" variant="outline" onClick={riprova}>
          {t("gs.riprova")}
        </Button>
      </div>
    );
  }

  if (!pronto) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        {t("cosa_manca.in_corso")}
      </div>
    );
  }

  if (mancanti.length === 0 && saltati.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-2 text-sm text-foreground">
        <CheckCircle2 className="w-4 h-4 text-success" />
        {t("cosa_manca.completo")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-foreground">{t("cosa_manca.titolo")}</p>
        <p className="text-xs text-muted-foreground">
          {mancanti.length > 0 ? t("cosa_manca.sottotitolo") : t("cosa_manca.completo_con_saltati")}
        </p>
      </div>

      {mancanti.length > 0 && (
        <ul className="space-y-2">
          {mancanti.map((v) => {
            const cosa = t(`cosa_manca.voci.${v.campo}.cosa`);
            const conseguenza = t(`cosa_manca.voci.${v.campo}.conseguenza`);
            return (
              <li
                key={v.campo}
                className="rounded-lg border border-border px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {v.livello === "impedisce" ? (
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {cosa}{" "}
                      <span
                        className={`ml-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          v.livello === "impedisce"
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t(`cosa_manca.livello_${v.livello}`)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{conseguenza}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {destinazione_disponibile[v.campo] && (
                    <Button size="sm" variant="outline" onClick={() => on_vai(v.campo)}>
                      {t(v.vai)}
                    </Button>
                  )}
                  {puo_saltare && (
                    <ConfirmButton
                      titolo={t("cosa_manca.conferma_titolo", { cosa })}
                      descrizione={t("cosa_manca.conferma_testo", { conseguenza })}
                      conferma_label={t("cosa_manca.salta")}
                      variante="conferma"
                      on_conferma={() => salta.mutate(v.campo)}
                    >
                      <Button size="sm" variant="ghost" disabled={salta.isPending}>
                        {t("cosa_manca.salta")}
                      </Button>
                    </ConfirmButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {saltati.length > 0 && (
        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={() => set_saltati_aperti((x) => !x)}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {saltati_aperti ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {t("cosa_manca.saltati_titolo", { count: saltati.length })}
          </button>
          {saltati_aperti && (
            <ul className="mt-2 space-y-1.5">
              {saltati.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-foreground">{t(`cosa_manca.voci.${r.campo}.cosa`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("cosa_manca.saltato_da", {
                        chi: r.nome_chi ?? t("cosa_manca.chi_sconosciuto"),
                        quando: format_data_completa(r.saltato_il),
                      })}
                    </p>
                  </div>
                  {puo_saltare && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={riapri.isPending}
                      onClick={() => riapri.mutate(r.id)}
                    >
                      {t("cosa_manca.riapri")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CosaMancaIstruttore;
