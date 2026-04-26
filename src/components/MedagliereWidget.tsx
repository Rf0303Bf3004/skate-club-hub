import React, { useMemo } from "react";
import { use_gare, use_atleti, use_setup_club, use_stagioni } from "@/hooks/use-supabase-data";
import { Trophy, Medal, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RigaMedagliere {
  atleta_id: string;
  nome: string;
  oro: number;
  argento: number;
  bronzo: number;
  altre: number;
  punti: number;
  partecipazioni: number;
  miglior_punteggio: number | null;
}

const DEFAULT_PUNTI: Record<string, number> = { "1": 10, "2": 7, "3": 5, "4": 3, "5": 2, "6": 1 };

function get_punti_table(setup: any): Record<string, number> {
  const raw = (setup as any)?.medagliere_punti;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) out[String(k)] = Number(v) || 0;
    return Object.keys(out).length ? out : DEFAULT_PUNTI;
  }
  return DEFAULT_PUNTI;
}

interface Props {
  compact?: boolean;
  limit?: number;
}

const MedagliereWidget: React.FC<Props> = ({ compact = false, limit }) => {
  const { data: gare = [] } = use_gare();
  const { data: atleti = [] } = use_atleti();
  const { data: setup } = use_setup_club();
  const { data: stagioni = [] } = use_stagioni();

  const stagione_attiva = useMemo(() => stagioni.find((s: any) => s.attiva), [stagioni]);
  const punti_table = useMemo(() => get_punti_table(setup), [setup]);

  const tooltip_formula = useMemo(() => {
    const ord = (n: string) => `${n}°`;
    return Object.entries(punti_table)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([pos, pts]) => `${ord(pos)} = ${pts} pt`)
      .join(" · ");
  }, [punti_table]);

  const righe = useMemo<RigaMedagliere[]>(() => {
    const map = new Map<string, RigaMedagliere>();

    const data_inizio = stagione_attiva?.data_inizio;
    const data_fine = stagione_attiva?.data_fine;

    for (const g of gare) {
      if (g.tipo === "campo_estivo") continue;
      if (!g.data) continue;
      if (data_inizio && g.data < data_inizio) continue;
      if (data_fine && g.data > data_fine) continue;
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
            punti: 0,
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
        const pos = ai.posizione ? String(Number(ai.posizione)) : null;
        if (pos && punti_table[pos] != null) {
          r.punti += Number(punti_table[pos]) || 0;
        }
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
        if (b.punti !== a.punti) return b.punti - a.punti;
        if (b.oro !== a.oro) return b.oro - a.oro;
        if (b.argento !== a.argento) return b.argento - a.argento;
        if (b.bronzo !== a.bronzo) return b.bronzo - a.bronzo;
        return a.nome.localeCompare(b.nome);
      });
  }, [gare, atleti, setup, stagione_attiva]);

  const display = limit ? righe.slice(0, limit) : righe;

  if (righe.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card p-6 text-center text-muted-foreground text-sm">
        <Trophy className="w-6 h-6 mx-auto mb-2 opacity-30" />
        Nessun risultato registrato
        {stagione_attiva ? ` per la stagione ${stagione_attiva.nome}` : ""}.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      {!compact && (
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Medagliere {stagione_attiva ? stagione_attiva.nome : "stagione"}
          </h3>
          <span className="text-xs text-muted-foreground">{righe.length} atleti</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                #
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Atleta
              </th>
              <th className="text-center px-2 py-2 text-[10px] font-bold text-yellow-600 uppercase">🥇</th>
              <th className="text-center px-2 py-2 text-[10px] font-bold text-slate-500 uppercase">🥈</th>
              <th className="text-center px-2 py-2 text-[10px] font-bold text-orange-700 uppercase">🥉</th>
              {!compact && (
                <th className="text-center px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase">Altre</th>
              )}
              <th className="text-right px-3 py-2 text-[10px] font-bold text-primary uppercase tracking-wider">
                Punti
              </th>
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
                <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-primary">{r.punti}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit && righe.length > limit && (
        <div className="px-5 py-2 text-[11px] text-muted-foreground text-center border-t border-border/50">
          Top {limit} di {righe.length} atleti — vedi pagina Gare per il medagliere completo
        </div>
      )}
    </div>
  );
};

export default MedagliereWidget;
