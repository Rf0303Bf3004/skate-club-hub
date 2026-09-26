import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_livelli, type LivelloRow as LivelloUfficiale } from "@/hooks/use-supabase-data";
import { segnala_errore } from "@/lib/errori";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

// Ordine delle fasi della tabella ufficiale `livelli`. Dentro una fase conta
// `livelli.ordine`. Una fase sconosciuta va in fondo, non sparisce.
const FASI_ORDINE = ["pulcini", "amatori", "artistica"];
const indice_fase = (fase: string | null | undefined) => {
  const i = FASI_ORDINE.indexOf(String(fase ?? ""));
  return i === -1 ? FASI_ORDINE.length : i;
};

// Colore legato alla fase, non al nome: un livello nuovo eredita il colore della sua fase.
const COLORE_FASE: Record<string, string> = {
  pulcini: "bg-primary/30",
  amatori: "bg-primary/60",
  artistica: "bg-primary",
};
const colore_fase = (fase: string | null | undefined) => COLORE_FASE[String(fase ?? "")] ?? "bg-muted-foreground";

interface LivelloRow {
  id?: string;
  livello: string;
  max_atleti_pista: number;
  max_per_monitrice: number;
  lezioni_per_settimana: number;
  durata_minuti: number;
  costo_annuale: number;
  tipo_sessione_default: string;
  atleti_per_area: number;
  usa_corsie: boolean;
  [key: string]: any;
}

// ── Letture ──
function use_catalogo_livelli(club_id: string | null) {
  return useQuery({
    queryKey: ["catalogo_livelli", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("catalogo_livelli")
        .select("*")
        .eq("club_id", club_id);
      if (error) throw error;
      return (data ?? []) as LivelloRow[];
    },
  });
}

function use_paese_club(club_id: string | null) {
  return useQuery({
    queryKey: ["catalogo_paese_club", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("paese_iso, paese")
        .eq("id", club_id)
        .single();
      if (error) throw error;
      return String((data as any)?.paese_iso ?? (data as any)?.paese ?? "").trim().toUpperCase();
    },
  });
}

/** Atleti del club per livello: un conteggio esatto per ogni livello del catalogo. */
function use_iscritti_per_livello(club_id: string | null, nomi: string[]) {
  const chiave = [...nomi].sort();
  return useQuery({
    queryKey: ["catalogo_iscritti_per_livello", club_id, chiave],
    enabled: !!club_id && nomi.length > 0,
    queryFn: async () => {
      const risultati = await Promise.all(
        chiave.map(async (nome) => {
          const { count, error } = await supabase
            .from("atleti")
            .select("id", { count: "exact", head: true })
            .eq("club_id", club_id)
            .eq("livello_attuale", nome);
          if (error) throw error;
          if (count === null || count === undefined) throw new Error("count_mancante");
          return [nome, count] as const;
        }),
      );
      return Object.fromEntries(risultati) as Record<string, number>;
    },
  });
}

const minuti = (t: string) => {
  const [h, m] = String(t || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Ore di ghiaccio settimanali dichiarate: fasce "ghiaccio" su risorse di tipo
 * ghiaccio, attive, non ospiti (trasferte), meno le fasce di pulizia che vi si
 * sovrappongono. Fasce senza risorsa escluse: non si può sapere se sono ghiaccio.
 * Restituisce null se non c'è nessuna fascia valida.
 */
function use_ore_ghiaccio_disponibili(club_id: string | null, stagione_id: string | null) {
  return useQuery({
    queryKey: ["catalogo_ore_ghiaccio", club_id, stagione_id],
    enabled: !!club_id,
    queryFn: async () => {
      let q = supabase
        .from("disponibilita_ghiaccio")
        .select("giorno, ora_inizio, ora_fine, tipo, risorsa_id")
        .eq("club_id", club_id)
        .in("tipo", ["ghiaccio", "pulizia"]);
      if (stagione_id) q = q.or(`stagione_id.is.null,stagione_id.eq.${stagione_id}`);
      const [disp, ris] = await Promise.all([
        q,
        supabase
          .from("risorse_strutture")
          .select("id, nome, tipo, attiva, is_ospite")
          .eq("club_id", club_id),
      ]);
      if (disp.error) throw disp.error;
      if (ris.error) throw ris.error;
      const valide = new Map<string, string>();
      for (const r of (ris.data ?? []) as any[]) {
        if (r.tipo === "ghiaccio" && r.attiva === true && r.is_ospite !== true) valide.set(r.id, r.nome);
      }
      const griglie = new Map<string, Uint8Array>();
      const pulizie: any[] = [];
      for (const f of (disp.data ?? []) as any[]) {
        if (!f.risorsa_id || !valide.has(f.risorsa_id)) continue;
        if (f.tipo === "pulizia") { pulizie.push(f); continue; }
        const k = `${f.risorsa_id}|${f.giorno}`;
        const g = griglie.get(k) ?? new Uint8Array(1440);
        for (let m = minuti(f.ora_inizio); m < Math.min(1440, minuti(f.ora_fine)); m++) g[m] = 1;
        griglie.set(k, g);
      }
      for (const f of pulizie) {
        const g = griglie.get(`${f.risorsa_id}|${f.giorno}`);
        if (!g) continue;
        for (let m = minuti(f.ora_inizio); m < Math.min(1440, minuti(f.ora_fine)); m++) g[m] = 0;
      }
      if (griglie.size === 0) return null;
      let tot = 0;
      const usate = new Set<string>();
      griglie.forEach((g, k) => {
        let n = 0;
        for (let m = 0; m < 1440; m++) n += g[m];
        if (n > 0) usate.add(valide.get(k.split("|")[0]) ?? "");
        tot += n;
      });
      if (tot === 0) return null;
      return { ore: tot / 60, risorse: [...usate] };
    },
  });
}

// ── Component ──
interface Props {
  club_id?: string | null;
  stagione_id: string | null;
}

const CatalogoOffertaTab: React.FC<Props> = ({ club_id, stagione_id }) => {
  const { t } = useTranslation("settings");
  const resolved_club_id = club_id || get_current_club_id() || null;
  const queryClient = useQueryClient();

  const q_catalogo = use_catalogo_livelli(resolved_club_id);
  const q_paese = use_paese_club(resolved_club_id);
  const q_livelli = use_livelli();
  const q_ore = use_ore_ghiaccio_disponibili(resolved_club_id, stagione_id);

  const [livelli, set_livelli] = useState<LivelloRow[]>([]);
  const [saving_livelli, set_saving_livelli] = useState(false);
  const [nuovo_livello, set_nuovo_livello] = useState<string>("");

  // Livelli ufficiali del paese del club, nell'ordine fase → ordine.
  const ufficiali: LivelloUfficiale[] = useMemo(() => {
    if (!q_livelli.isSuccess || !q_paese.isSuccess) return [];
    return q_livelli.data
      .filter((l) => String(l.paese).toUpperCase() === q_paese.data)
      .sort((a, b) => indice_fase(a.fase) - indice_fase(b.fase) || a.ordine - b.ordine);
  }, [q_livelli.isSuccess, q_livelli.data, q_paese.isSuccess, q_paese.data]);

  const per_nome = useMemo(() => new Map(ufficiali.map((l, i) => [l.nome, { ...l, pos: i }])), [ufficiali]);

  useEffect(() => {
    if (!q_catalogo.isSuccess) return;
    const sorted = [...q_catalogo.data].sort((a, b) => {
      const pa = per_nome.get(a.livello)?.pos ?? 999;
      const pb = per_nome.get(b.livello)?.pos ?? 999;
      return pa - pb || a.livello.localeCompare(b.livello);
    });
    set_livelli(sorted);
  }, [q_catalogo.isSuccess, q_catalogo.data, per_nome]);

  const nomi_catalogo = useMemo(() => livelli.map((l) => l.livello), [livelli]);
  const q_iscritti = use_iscritti_per_livello(resolved_club_id, nomi_catalogo);
  const iscritti_pronti = q_iscritti.isSuccess;
  const iscritti_di = (nome: string): number | null =>
    iscritti_pronti && nome in (q_iscritti.data ?? {}) ? q_iscritti.data![nome] : null;

  const disponibili = useMemo(
    () => ufficiali.filter((l) => !nomi_catalogo.includes(l.nome)),
    [ufficiali, nomi_catalogo],
  );
  useEffect(() => {
    if (!disponibili.some((l) => l.nome === nuovo_livello)) set_nuovo_livello(disponibili[0]?.nome ?? "");
  }, [disponibili, nuovo_livello]);

  // Avvisi di lettura (gravità "avviso": in pagina c'è già il riquadro).
  useEffect(() => {
    if (q_iscritti.isError) segnala_errore("CatalogoOffertaTab", t("catalogo.errore_iscritti"), q_iscritti.error, undefined, "avviso");
  }, [q_iscritti.isError]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (q_ore.isError) segnala_errore("CatalogoOffertaTab", t("catalogo.errore_ore"), q_ore.error, undefined, "avviso");
  }, [q_ore.isError]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const e = q_catalogo.error ?? q_livelli.error ?? q_paese.error;
    if (e) segnala_errore("CatalogoOffertaTab", t("catalogo.errore_catalogo"), e, undefined, "avviso");
  }, [q_catalogo.isError, q_livelli.isError, q_paese.isError]); // eslint-disable-line react-hooks/exhaustive-deps

  const update_livello = (idx: number, field: string, value: any) => {
    set_livelli((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      if (field === "tipo_sessione_default") updated.usa_corsie = value === "aree_pista";
      return updated;
    }));
  };

  const calc_gruppi = (r: LivelloRow): number | null => {
    const n = iscritti_di(r.livello);
    if (n === null) return null;
    if (!r.max_per_monitrice || r.max_per_monitrice <= 0) return 0;
    return Math.ceil(n / r.max_per_monitrice);
  };

  const calc_ore_sett = (r: LivelloRow): number | null => {
    const g = calc_gruppi(r);
    if (g === null) return null;
    return (g * (r.lezioni_per_settimana || 0) * (r.durata_minuti || 0)) / 60;
  };

  const gruppi_color = (g: number) => {
    if (g <= 3) return "text-green-600";
    if (g <= 6) return "text-orange-500";
    return "text-red-600";
  };

  const summary = useMemo(() => {
    if (!iscritti_pronti) return null;
    const tot_iscritti = livelli.reduce((s, r) => s + (iscritti_di(r.livello) ?? 0), 0);
    const tot_slot = livelli.reduce((s, r) => s + (calc_gruppi(r) ?? 0) * (r.lezioni_per_settimana || 0), 0);
    const tot_ore = livelli.reduce((s, r) => s + (calc_ore_sett(r) ?? 0), 0);
    return { tot_iscritti, tot_slot, tot_ore };
  }, [livelli, iscritti_pronti, q_iscritti.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const ore_disp = q_ore.isSuccess ? q_ore.data : undefined; // undefined = non arrivata / fallita
  const surplus = summary && ore_disp ? ore_disp.ore - summary.tot_ore : null;

  const save_livelli = async () => {
    set_saving_livelli(true);
    try {
      const results = await Promise.all(
        livelli.filter((r) => r.id).map((r) =>
          (supabase as any).from("catalogo_livelli").update({
            max_atleti_pista: r.max_atleti_pista || 1,
            max_per_monitrice: r.max_per_monitrice || 1,
            lezioni_per_settimana: r.lezioni_per_settimana || 1,
            durata_minuti: r.durata_minuti || 15,
            costo_annuale: r.costo_annuale || 0,
            tipo_sessione_default: r.tipo_sessione_default || "standard",
            atleti_per_area: r.atleti_per_area || 0,
            usa_corsie: r.tipo_sessione_default === "aree_pista",
          }).eq("id", r.id).eq("club_id", resolved_club_id),
        ),
      );
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
      toast({ title: t("catalogo.toast_levels_saved") });
    } catch (e: any) {
      toast({ title: t("catalogo.toast_save_error"), description: e?.message, variant: "destructive" });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["catalogo_livelli"] });
      set_saving_livelli(false);
    }
  };

  const add_livello = async () => {
    // Scrittura decisa solo su letture riuscite: catalogo e livelli ufficiali.
    if (!q_catalogo.isSuccess || !q_livelli.isSuccess || !q_paese.isSuccess) return;
    const scelto = disponibili.find((l) => l.nome === nuovo_livello);
    if (!scelto) return;
    try {
      const { error } = await (supabase as any).from("catalogo_livelli").insert({
        club_id: resolved_club_id,
        stagione_id: stagione_id || null,
        livello: scelto.nome,
        iscritti_attuali: 0,
        max_atleti_pista: 30,
        max_per_monitrice: 8,
        lezioni_per_settimana: 1,
        durata_minuti: 60,
        costo_annuale: 0,
        tipo_sessione_default: "standard",
        atleti_per_area: 0,
        usa_corsie: false,
      });
      if (error) throw error;
      toast({ title: t("catalogo.toast_level_added", { livello: scelto.nome }) });
    } catch (e: any) {
      toast({ title: t("catalogo.toast_add_error"), description: e?.message, variant: "destructive" });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["catalogo_livelli"] });
    }
  };

  if (q_catalogo.isError || q_livelli.isError || q_paese.isError) {
    return (
      <div className="bg-card rounded-xl shadow-card p-6 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-6 h-6 text-destructive" />
        <p className="text-sm text-foreground">{t("catalogo.errore_catalogo")}</p>
        <Button size="sm" variant="outline" onClick={() => { q_catalogo.refetch(); q_livelli.refetch(); q_paese.refetch(); }}>
          {t("catalogo.riprova")}
        </Button>
      </div>
    );
  }

  if (!q_catalogo.isSuccess || !q_livelli.isSuccess || !q_paese.isSuccess) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const nessun_livello_paese = ufficiali.length === 0;

  const selettore_aggiunta = !nessun_livello_paese && disponibili.length > 0 && (
    <div className="flex items-center gap-2">
      <Select value={nuovo_livello} onValueChange={set_nuovo_livello}>
        <SelectTrigger className="h-9 w-[160px] text-sm" aria-label={t("catalogo.scegli_livello")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {disponibili.map((l) => (
            <SelectItem key={l.id} value={l.nome}>{l.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={add_livello} disabled={!nuovo_livello}>
        {t("catalogo.add_level")}
      </Button>
    </div>
  );

  const riprova_iscritti = (
    <Button size="sm" variant="outline" onClick={() => q_iscritti.refetch()}>{t("catalogo.riprova")}</Button>
  );

  return (
    <div className="space-y-8">
      <div className="bg-card rounded-xl shadow-card p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold text-foreground">{t("catalogo.section_title")}</h2>
          {livelli.length > 0 && selettore_aggiunta}
        </div>

        {nessun_livello_paese && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {t("catalogo.vuoto_livelli_paese", { paese: q_paese.data || "—" })}
          </div>
        )}

        {q_iscritti.isError && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-center justify-between gap-3 flex-wrap">
            <span>{t("catalogo.errore_iscritti")}</span>
            {riprova_iscritti}
          </div>
        )}

        {livelli.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground italic">{t("catalogo.empty")}</p>
            <div className="flex justify-center">{selettore_aggiunta}</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">{t("catalogo.col_livello")}</TableHead>
                    <TableHead className="w-[70px]">{t("catalogo.col_iscritti")}</TableHead>
                    <TableHead className="w-[80px]">{t("catalogo.col_max_pista")}</TableHead>
                    <TableHead className="w-[85px]">{t("catalogo.col_max_monitrice")}</TableHead>
                    <TableHead className="w-[70px]">{t("catalogo.col_lezioni_sett")}</TableHead>
                    <TableHead className="w-[80px]">{t("catalogo.col_durata")}</TableHead>
                    <TableHead className="w-[100px]">{t("catalogo.col_costo")}</TableHead>
                    <TableHead className="w-[120px]">{t("catalogo.col_tipo_sessione")}</TableHead>
                    <TableHead className="w-[80px]">{t("catalogo.col_atleti_area")}</TableHead>
                    <TableHead className="w-[60px]">{t("catalogo.col_gruppi")}</TableHead>
                    <TableHead className="w-[70px]">{t("catalogo.col_ore_sett")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {livelli.map((r, idx) => {
                    const ufficiale = per_nome.get(r.livello);
                    const n = iscritti_di(r.livello);
                    const gruppi = calc_gruppi(r);
                    const ore = calc_ore_sett(r);
                    return (
                      <TableRow key={r.id || idx}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${colore_fase(ufficiale?.fase)}`} />
                            <span className="text-sm font-medium text-foreground">{r.livello}</span>
                            {!ufficiale && (
                              <span title={t("catalogo.livello_non_ufficiale")}>
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-label={t("catalogo.livello_non_ufficiale")} />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {n !== null ? (
                            <span className="text-sm font-medium text-foreground" title={t("catalogo.iscritti_calcolati")}>{n}</span>
                          ) : q_iscritti.isError ? (
                            <span className="text-muted-foreground text-xs" title={t("catalogo.errore_iscritti")}>—</span>
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={1} value={r.max_atleti_pista ?? 1}
                            onChange={(e) => update_livello(idx, "max_atleti_pista", parseInt(e.target.value) || 1)}
                            className="h-8 w-16 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={1} value={r.max_per_monitrice ?? 1}
                            onChange={(e) => update_livello(idx, "max_per_monitrice", parseInt(e.target.value) || 1)}
                            className="h-8 w-16 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={1} max={7} value={r.lezioni_per_settimana ?? 1}
                            onChange={(e) => update_livello(idx, "lezioni_per_settimana", Math.min(7, parseInt(e.target.value) || 1))}
                            className="h-8 w-14 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={15} step={5} value={r.durata_minuti ?? 15}
                            onChange={(e) => update_livello(idx, "durata_minuti", parseInt(e.target.value) || 15)}
                            className="h-8 w-16 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={0} value={r.costo_annuale ?? 0}
                            onChange={(e) => update_livello(idx, "costo_annuale", parseFloat(e.target.value) || 0)}
                            className="h-8 w-20 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Select value={r.tipo_sessione_default || "standard"}
                            onValueChange={(v) => update_livello(idx, "tipo_sessione_default", v)}>
                            <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">{t("catalogo.tipo_standard")}</SelectItem>
                              <SelectItem value="aree_pista">{t("catalogo.tipo_aree_pista")}</SelectItem>
                              <SelectItem value="officestripe">{t("catalogo.tipo_officestripe")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {r.tipo_sessione_default === "aree_pista" ? (
                            <Input type="number" min={1} value={r.atleti_per_area ?? 0}
                              onChange={(e) => update_livello(idx, "atleti_per_area", parseInt(e.target.value) || 0)}
                              className="h-8 w-14 text-xs" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {gruppi === null
                            ? <span className="text-muted-foreground text-xs">—</span>
                            : <span className={`text-sm font-bold ${gruppi_color(gruppi)}`}>{gruppi}</span>}
                        </TableCell>
                        <TableCell>
                          {ore === null
                            ? <span className="text-muted-foreground text-xs">—</span>
                            : <span className="text-sm text-foreground">{ore.toFixed(1)}h</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
              <SummaryCard label={t("catalogo.summary_iscritti")} value={summary ? String(summary.tot_iscritti) : "—"} />
              <SummaryCard label={t("catalogo.summary_slot")} value={summary ? String(summary.tot_slot) : "—"} />
              <SummaryCard label={t("catalogo.summary_ore_necessarie")} value={summary ? `${summary.tot_ore.toFixed(1)}h` : "—"} />
              <SummaryCard
                label={t("catalogo.summary_ore_disponibili")}
                value={ore_disp ? `${ore_disp.ore.toFixed(1)}h` : "—"}
                nota={
                  q_ore.isError ? t("catalogo.errore_ore")
                  : q_ore.isSuccess && ore_disp === null ? t("catalogo.vuoto_ore")
                  : ore_disp ? t("catalogo.ore_da_risorse", { risorse: ore_disp.risorse.join(", ") })
                  : undefined
                }
                azione={q_ore.isError ? <Button size="sm" variant="outline" onClick={() => q_ore.refetch()}>{t("catalogo.riprova")}</Button> : undefined}
              />
              <SummaryCard
                label={t("catalogo.summary_surplus")}
                value={surplus === null ? "—" : `${surplus >= 0 ? "+" : ""}${surplus.toFixed(1)}h`}
                color={surplus === null ? undefined : surplus >= 0 ? "text-green-600" : "text-red-600"}
                nota={
                  surplus !== null ? undefined
                  : q_ore.isSuccess && ore_disp === null ? t("catalogo.surplus_senza_ore")
                  : !summary && q_iscritti.isError ? t("catalogo.surplus_senza_iscritti")
                  : undefined
                }
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={save_livelli} disabled={saving_livelli}>
                {saving_livelli ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("catalogo.saving")}</> : t("catalogo.save_all")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; color?: string; nota?: string; azione?: React.ReactNode }> = ({ label, value, color, nota, azione }) => (
  <div className="bg-muted/50 rounded-lg p-3 text-center space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-lg font-bold ${color || "text-foreground"}`}>{value}</p>
    {nota && <p className="text-[11px] text-muted-foreground leading-snug">{nota}</p>}
    {azione}
  </div>
);

export default CatalogoOffertaTab;
