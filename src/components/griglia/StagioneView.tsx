import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Snowflake, Dumbbell, Lock, HelpCircle } from "lucide-react";
import {
  use_eventi_unificati,
  add_giorni,
  lunedi_di_iso,
  iso_da_date,
  type EventoUnificato,
} from "@/hooks/use-planning-unificato";

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function indice_giorno(data_iso: string): number {
  const dow = new Date(`${data_iso}T00:00:00`).getDay(); // 0 = domenica
  return dow === 0 ? 6 : dow - 1;
}

function hhmm_da_min(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Stagione attiva del club (per delimitare la finestra temporale). */
function use_stagione_attiva() {
  const club_id = get_current_club_id();
  return useQuery({
    enabled: !!club_id,
    queryKey: ["stagione_attiva_griglia", club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stagioni")
        .select("id,nome,data_inizio,data_fine,attiva")
        .eq("club_id", club_id as string)
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      const lista = (data ?? []) as any[];
      return (lista.find((s) => s.attiva) ?? lista[0] ?? null) as
        | { id: string; nome: string; data_inizio: string; data_fine: string }
        | null;
    },
  });
}

interface SlotTipo {
  chiave: string;
  giorno: number;
  inizio_min: number;
  fine_min: number;
  titolo: string;
  fonte: "griglia" | "planning";
  occorrenze: number;
  eccezioni: number;
}

const StagioneView: React.FC<{
  includi_ospiti: boolean;
  on_apri_settimana: (data_iso: string) => void;
}> = ({ includi_ospiti, on_apri_settimana }) => {
  const { data: stagione, isLoading: is_loading_stagione } = use_stagione_attiva();
  const [soglia, set_soglia] = useState(50);

  const da = stagione?.data_inizio ?? iso_da_date(new Date());
  const a = stagione?.data_fine ?? add_giorni(da, 30);

  const { eventi, risorse, is_loading } = use_eventi_unificati(da, a);

  const risorse_visibili = useMemo(
    () =>
      risorse
        .filter((r) => r.attiva && (includi_ospiti || !r.is_ospite))
        .sort((x, y) => (x.tipo === y.tipo ? (x.ordine ?? 0) - (y.ordine ?? 0) : x.tipo === "ghiaccio" ? -1 : 1)),
    [risorse, includi_ospiti],
  );

  const id_visibili = useMemo(() => new Set(risorse_visibili.map((r) => r.id)), [risorse_visibili]);
  const eventi_filtrati = useMemo(
    () => eventi.filter((e) => !e.annullato && (!e.risorsa_id || id_visibili.has(e.risorsa_id))),
    [eventi, id_visibili],
  );

  /** Numero di settimane distinte coperte dalla stagione (denominatore del "x/N"). */
  const n_settimane = useMemo(() => {
    const set = new Set<string>();
    let cur = lunedi_di_iso(da);
    const fine = a;
    let guard = 0;
    while (cur <= fine && guard < 80) {
      set.add(cur);
      cur = add_giorni(cur, 7);
      guard += 1;
    }
    return Math.max(1, set.size);
  }, [da, a]);

  /** Settimana tipo: pattern che ricorre in almeno `soglia`% delle settimane. */
  const settimana_tipo = useMemo(() => {
    const map = new Map<string, SlotTipo & { settimane: Set<string> }>();
    for (const e of eventi_filtrati) {
      const chiave = [
        e.risorsa_id ?? "nessuna",
        indice_giorno(e.data),
        e.ora_inizio,
        e.ora_fine,
        e.titolo.toLowerCase(),
        e.fonte,
      ].join("|");
      const cur =
        map.get(chiave) ??
        ({
          chiave,
          giorno: indice_giorno(e.data),
          inizio_min: e.inizio_min,
          fine_min: e.fine_min,
          titolo: e.titolo,
          fonte: e.fonte,
          occorrenze: 0,
          eccezioni: 0,
          settimane: new Set<string>(),
          risorsa_id: e.risorsa_id ?? null,
        } as any);
      cur.occorrenze += 1;
      if (e.eccezione) cur.eccezioni += 1;
      cur.settimane.add(lunedi_di_iso(e.data));
      map.set(chiave, cur as any);
    }
    return Array.from(map.values()).map((s: any) => ({
      ...s,
      settimane_coperte: s.settimane.size,
      percentuale: Math.round((s.settimane.size / n_settimane) * 100),
    })) as (SlotTipo & { risorsa_id: string | null; settimane_coperte: number; percentuale: number })[];
  }, [eventi_filtrati, n_settimane]);

  /** Heatmap: minuti occupati per (giorno della settimana × fascia da 30') per risorsa. */
  const heatmap = useMemo(() => {
    const per_risorsa = new Map<string, number[][]>(); // [giorno][slot30]
    const nuovo = () => Array.from({ length: 7 }, () => Array.from({ length: 48 }, () => 0));
    for (const e of eventi_filtrati) {
      const rid = e.risorsa_id ?? "nessuna";
      const m = per_risorsa.get(rid) ?? nuovo();
      const g = indice_giorno(e.data);
      for (let slot = Math.floor(e.inizio_min / 30); slot < Math.ceil(e.fine_min / 30); slot += 1) {
        if (slot >= 0 && slot < 48) m[g][slot] += 1;
      }
      per_risorsa.set(rid, m);
    }
    return per_risorsa;
  }, [eventi_filtrati]);

  const finestra_heatmap = useMemo(() => {
    if (eventi_filtrati.length === 0) return { da: 16, a: 40 }; // 08:00–20:00 in slot da 30'
    const min = Math.min(...eventi_filtrati.map((e) => Math.floor(e.inizio_min / 30)));
    const max = Math.max(...eventi_filtrati.map((e) => Math.ceil(e.fine_min / 30)));
    return { da: Math.max(0, min), a: Math.min(48, max) };
  }, [eventi_filtrati]);

  const max_occupazione = useMemo(() => {
    let max = 0;
    heatmap.forEach((m) => m.forEach((riga) => riga.forEach((v) => (max = Math.max(max, v)))));
    return Math.max(1, max);
  }, [heatmap]);

  const nome_risorsa = (id: string | null) =>
    id ? risorse.find((r) => r.id === id)?.nome ?? "Risorsa" : "Non assegnata a una risorsa";

  const icona_risorsa = (id: string | null) => {
    const tipo = id ? risorse.find((r) => r.id === id)?.tipo : null;
    if (tipo === "ghiaccio") return <Snowflake className="h-4 w-4 text-sky-600" />;
    if (tipo === "palestra") return <Dumbbell className="h-4 w-4 text-muted-foreground" />;
    return <HelpCircle className="h-4 w-4 text-amber-600" />;
  };

  const chiavi_risorse = useMemo(() => {
    const ids: (string | null)[] = risorse_visibili.map((r) => r.id);
    if (eventi_filtrati.some((e) => !e.risorsa_id)) ids.push(null);
    return ids;
  }, [risorse_visibili, eventi_filtrati]);

  if (is_loading_stagione || is_loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!stagione) {
    return <p className="text-sm text-muted-foreground">Nessuna stagione configurata per questo club.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">{stagione.nome}</span>
        <span className="text-muted-foreground">
          {new Date(`${da}T00:00:00`).toLocaleDateString("it-CH")} –{" "}
          {new Date(`${a}T00:00:00`).toLocaleDateString("it-CH")} · {n_settimane} settimane ·{" "}
          {eventi_filtrati.length} voci
        </span>
      </div>

      <Tabs defaultValue="tipo">
        <TabsList>
          <TabsTrigger value="tipo">Settimana tipo</TabsTrigger>
          <TabsTrigger value="heatmap">Occupazione (heatmap)</TabsTrigger>
        </TabsList>

        {/* ─── Settimana tipo ─────────────────────────── */}
        <TabsContent value="tipo" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Soglia di ricorrenza (% delle settimane)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={soglia}
                onChange={(e) => set_soglia(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                className="h-9 w-28"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Vengono mostrati gli slot presenti in almeno il {soglia}% delle {n_settimane} settimane della stagione.
            </p>
          </div>

          <div className="space-y-4">
            {chiavi_risorse.map((rid) => {
              const slot = settimana_tipo
                .filter((s) => (s.risorsa_id ?? null) === rid && s.percentuale >= soglia)
                .sort((x, y) => x.giorno - y.giorno || x.inizio_min - y.inizio_min);
              return (
                <div key={rid ?? "nessuna"} className="overflow-hidden rounded-xl border">
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                    {icona_risorsa(rid)}
                    <span className="text-sm font-semibold">{nome_risorsa(rid)}</span>
                    <span className="text-xs text-muted-foreground">{slot.length} slot ricorrenti</span>
                  </div>
                  <div className="grid grid-cols-7 divide-x">
                    {GIORNI.map((g, i) => (
                      <div key={g} className="min-h-[110px] p-1.5">
                        <div className="mb-1 text-center text-[11px] font-medium text-muted-foreground">{g}</div>
                        <div className="space-y-1">
                          {slot
                            .filter((s) => s.giorno === i)
                            .map((s) => (
                              <div
                                key={s.chiave}
                                className={`rounded-md border px-1.5 py-1 text-[11px] leading-tight ${
                                  s.fonte === "griglia"
                                    ? "border-primary/40 bg-primary/10"
                                    : "border-dashed border-border bg-muted"
                                }`}
                              >
                                <div className="flex items-center gap-1 font-semibold">
                                  {s.fonte === "planning" && <Lock className="h-2.5 w-2.5" />}
                                  {hhmm_da_min(s.inizio_min)}–{hhmm_da_min(s.fine_min)}
                                </div>
                                <div className="truncate">{s.titolo}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                                    {s.settimane_coperte}/{n_settimane}
                                  </Badge>
                                  {s.eccezioni > 0 && (
                                    <Badge variant="outline" className="px-1 py-0 text-[10px] text-amber-700">
                                      {s.eccezioni} ecc.
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {chiavi_risorse.length === 0 && (
              <p className="text-sm text-muted-foreground">Nessuna risorsa attiva configurata.</p>
            )}
          </div>
        </TabsContent>

        {/* ─── Heatmap occupazione ────────────────────── */}
        <TabsContent value="heatmap" className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Numero di voci sovrapposte per fascia da 30 minuti, aggregate su tutte le settimane della stagione.
            Più il colore è intenso, più quella fascia è utilizzata.
          </p>
          {chiavi_risorse.map((rid) => {
            const m = heatmap.get(rid ?? "nessuna");
            return (
              <div key={rid ?? "nessuna"} className="overflow-hidden rounded-xl border">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                  {icona_risorsa(rid)}
                  <span className="text-sm font-semibold">{nome_risorsa(rid)}</span>
                </div>
                <div className="overflow-x-auto p-2">
                  <table className="min-w-[640px] border-separate border-spacing-[1px] text-[10px]">
                    <thead>
                      <tr>
                        <th className="w-10" />
                        {Array.from({ length: finestra_heatmap.a - finestra_heatmap.da }, (_, k) => {
                          const slot = finestra_heatmap.da + k;
                          return (
                            <th key={slot} className="font-normal text-muted-foreground">
                              {slot % 2 === 0 ? hhmm_da_min(slot * 30) : ""}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {GIORNI.map((g, i) => (
                        <tr key={g}>
                          <td className="pr-1 text-right text-muted-foreground">{g}</td>
                          {Array.from({ length: finestra_heatmap.a - finestra_heatmap.da }, (_, k) => {
                            const slot = finestra_heatmap.da + k;
                            const v = m?.[i]?.[slot] ?? 0;
                            const alpha = v === 0 ? 0 : 0.15 + 0.85 * (v / max_occupazione);
                            return (
                              <td
                                key={slot}
                                title={`${g} ${hhmm_da_min(slot * 30)} · ${v} voci`}
                                className="h-4 w-3 rounded-[2px] border border-border/40"
                                style={{ backgroundColor: v ? `hsl(var(--primary) / ${alpha})` : "transparent" }}
                              />
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="text-xs text-primary underline"
            onClick={() => on_apri_settimana(lunedi_di_iso(da))}
          >
            Apri la prima settimana della stagione
          </button>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StagioneView;
