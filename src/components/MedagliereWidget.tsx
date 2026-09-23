import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { segnala_errore } from "@/lib/errori";
import { use_gare, use_atleti, use_stagioni } from "@/hooks/use-supabase-data";
import { Trophy, Medal } from "lucide-react";
import { useTranslation } from "react-i18next";

interface RigaMedagliere {
  atleta_id: string;
  nome: string;
  oro: number;
  argento: number;
  bronzo: number;
  altre: number;
  partecipazioni: number;
  miglior_punteggio: number | null;
}

interface Props {
  compact?: boolean;
  limit?: number;
}

/** Una gara appartiene alla stagione se ne ha lo `stagione_id`; se manca, vale la data. */
function gara_in_stagione(g: any, st: any): boolean {
  if (g.stagione_id) return g.stagione_id === st.id;
  if (!g.data) return false;
  if (st.data_inizio && g.data < st.data_inizio) return false;
  if (st.data_fine && g.data > st.data_fine) return false;
  return true;
}

const MedagliereWidget: React.FC<Props> = ({ compact = false, limit }) => {
  const { t } = useTranslation("dashboard");
  const q_gare = use_gare();
  const q_atleti = use_atleti();
  const q_stagioni = use_stagioni();
  const gare: any[] = q_gare.data ?? [];
  const atleti: any[] = q_atleti.data ?? [];
  const stagioni: any[] = q_stagioni.data ?? [];
  const pronto = q_gare.isSuccess && q_atleti.isSuccess && q_stagioni.isSuccess;
  const guasto = q_gare.isError || q_atleti.isError || q_stagioni.isError;

  useEffect(() => {
    if (guasto) segnala_errore("MedagliereWidget", t("widget_medagliere.errore"), q_gare.error ?? q_atleti.error ?? q_stagioni.error, undefined, "avviso");
  }, [guasto]);

  const stagione_attiva = useMemo(() => stagioni.find((s: any) => s.attiva), [stagioni]);
  // "tutte" = storico completo; altrimenti id della stagione. null = non ancora scelto.
  const [stagione_sel, set_stagione_sel] = useState<string | null>(null);
  const stagione_scelta = stagione_sel === "tutte" ? null : stagioni.find((s: any) => s.id === stagione_sel) ?? null;

  const righe = useMemo<RigaMedagliere[]>(() => {
    const map = new Map<string, RigaMedagliere>();

    for (const g of gare) {
      if (stagione_scelta && !gara_in_stagione(g, stagione_scelta)) continue;
      for (const ai of g.atleti_iscritti ?? []) {
        if (!ai.atleta_id) continue;
        const a = atleti.find((x: any) => x.id === ai.atleta_id);
        if (!a) continue;
        const key = ai.atleta_id;
        if (!map.has(key)) {
          map.set(key, {
            atleta_id: key,
            nome: `${a.nome ?? ""} ${a.cognome ?? ""}`.trim(),
            oro: 0,
            argento: 0,
            bronzo: 0,
            altre: 0,
            partecipazioni: 0,
            miglior_punteggio: null,
          });
        }
        const r = map.get(key)!;
        r.partecipazioni += 1;
        const m = (ai.medaglia || "").toLowerCase();
        if (m === "oro") r.oro += 1;
        else if (m === "argento") r.argento += 1;
        else if (m === "bronzo") r.bronzo += 1;
        else if (ai.posizione && Number(ai.posizione) > 3) r.altre += 1;
        const punt = ai.punteggio != null ? Number(ai.punteggio) : NaN;
        if (!isNaN(punt) && punt > 0) {
          if (r.miglior_punteggio == null || punt > r.miglior_punteggio) {
            r.miglior_punteggio = punt;
          }
        }
      }
    }

    return Array.from(map.values())
      .filter((r) => r.partecipazioni > 0)
      .sort((a, b) => {
        if (b.oro !== a.oro) return b.oro - a.oro;
        if (b.argento !== a.argento) return b.argento - a.argento;
        if (b.bronzo !== a.bronzo) return b.bronzo - a.bronzo;
        return a.nome.localeCompare(b.nome);
      });
  }, [gare, atleti, stagione_scelta]);

  // Scelta iniziale: la stagione in corso se ha risultati, altrimenti tutto lo storico
  // (così al cambio stagione il medagliere non sembra sparito).
  useEffect(() => {
    if (stagione_sel !== null || !pronto) return;
    const ha_risultati = stagione_attiva && gare.some((g) => gara_in_stagione(g, stagione_attiva) && (g.atleti_iscritti ?? []).length > 0);
    set_stagione_sel(ha_risultati ? stagione_attiva.id : "tutte");
  }, [pronto, stagione_sel, stagione_attiva, gare]);

  const display = limit ? righe.slice(0, limit) : righe;

  if (guasto) {
    return (
      <div className="bg-card rounded-xl shadow-card p-6 text-center text-sm space-y-2">
        <p className="text-destructive">{t("widget_medagliere.errore")}</p>
        <Button size="sm" variant="outline" onClick={() => { q_gare.refetch(); q_atleti.refetch(); q_stagioni.refetch(); }}>
          {t("widget_medagliere.riprova")}
        </Button>
      </div>
    );
  }
  if (!pronto || stagione_sel === null) {
    return <div className="bg-card rounded-xl shadow-card p-6 text-center text-muted-foreground text-sm">{t("widget_medagliere.caricamento")}</div>;
  }

  const selettore = (
    <select
      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      value={stagione_sel}
      onChange={(e) => set_stagione_sel(e.target.value)}
      aria-label={t("widget_medagliere.stagione_label")}
      title={t("widget_medagliere.stagione_label")}
    >
      <option value="tutte">{t("widget_medagliere.tutte_stagioni")}</option>
      {stagioni.map((st: any) => <option key={st.id} value={st.id}>{st.nome}</option>)}
    </select>
  );
  const nome_periodo = stagione_scelta ? stagione_scelta.nome : t("widget_medagliere.tutte_stagioni");

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
        {!compact && (
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> {t("widget_medagliere.title", { stagione: nome_periodo })}
          </h3>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {!compact && righe.length > 0 && <span className="text-xs text-muted-foreground">{t("widget_medagliere.athletes_count", { count: righe.length })}</span>}
          {selettore}
        </div>
      </div>
      {righe.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground text-sm">
          <Trophy className="w-6 h-6 mx-auto mb-2 opacity-30" />
          {stagione_scelta ? t("widget_medagliere.empty_season", { stagione: stagione_scelta.nome }) : t("widget_medagliere.empty")}
        </div>
      ) : (<>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                #
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("widget_medagliere.col_athlete")}
              </th>
              <th className="text-center px-2 py-2 text-[10px] font-bold text-yellow-600 uppercase">🥇</th>
              <th className="text-center px-2 py-2 text-[10px] font-bold text-slate-500 uppercase">🥈</th>
              <th className="text-center px-2 py-2 text-[10px] font-bold text-orange-700 uppercase">🥉</th>
              {!compact && (
                <th className="text-center px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase">{t("widget_medagliere.col_other")}</th>
              )}
              {!compact && (
                <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  {t("widget_medagliere.col_score")}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {display.map((r, idx) => (
              <tr key={r.atleta_id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2 text-xs font-bold text-muted-foreground tabular-nums">
                  {idx === 0 ? (
                    <Medal className="w-4 h-4 text-yellow-500" />
                  ) : idx === 1 ? (
                    <Medal className="w-4 h-4 text-slate-400" />
                  ) : idx === 2 ? (
                    <Medal className="w-4 h-4 text-orange-600" />
                  ) : (
                    `${idx + 1}°`
                  )}
                </td>
                <td className="px-3 py-2 text-xs font-medium text-foreground">{r.nome}</td>
                <td className="px-2 py-2 text-center text-xs tabular-nums">{r.oro || "—"}</td>
                <td className="px-2 py-2 text-center text-xs tabular-nums">{r.argento || "—"}</td>
                <td className="px-2 py-2 text-center text-xs tabular-nums">{r.bronzo || "—"}</td>
                {!compact && (
                  <td className="px-2 py-2 text-center text-xs tabular-nums text-muted-foreground">
                    {r.altre || "—"}
                  </td>
                )}
                {!compact && (
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">
                    {r.miglior_punteggio != null ? r.miglior_punteggio.toFixed(2) : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}
      {limit && righe.length > limit && (
        <div className="px-5 py-2 text-[11px] text-muted-foreground text-center border-t border-border/50">
          {t("widget_medagliere.footer_top", { limit, total: righe.length })}
        </div>
      )}
    </div>
  );
};

export default MedagliereWidget;
