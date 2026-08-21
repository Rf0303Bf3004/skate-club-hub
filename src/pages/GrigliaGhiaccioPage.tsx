import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { usePermessiSezioniMatrix } from "@/hooks/usePermessi";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { can_manage_griglia } from "@/lib/roles";
import {
  use_griglia_blocchi_giorno,
  use_upsert_blocco,
  use_upsert_sessione,
  use_elimina_blocco,
  use_disponibilita_giorno,
  giorno_it_da_data,
  type GrigliaBlocco,
} from "@/hooks/use-griglia-ghiaccio";
import { use_risorse_strutture } from "@/hooks/use-risorse-strutture";
import GrigliaBuilder from "@/components/griglia/GrigliaBuilder";
import ProvenienzaLegenda from "@/components/ProvenienzaLegenda";
import ConfermaForzaturaDisponibilita from "@/components/griglia/ConfermaForzaturaDisponibilita";
import { verifica_orario_disponibilita } from "@/lib/availability";
import StampaRiepilogoIstruttori, {
  type IstruttoreStampa,
  type RigaSessioneStampa,
} from "@/components/griglia/StampaRiepilogoIstruttori";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { LayoutGrid, Plus, Trash2, ChevronDown, ChevronRight, GraduationCap, Printer, AlertTriangle } from "lucide-react";

function oggi_iso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function label_data(data_iso: string): string {
  if (!data_iso) return "";
  const d = new Date(`${data_iso}T00:00:00`);
  return d.toLocaleDateString("it-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function hhmm(t?: string | null): string {
  return (t ?? "").slice(0, 5);
}

function minuti(t: string): number {
  const [h, m] = hhmm(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function da_minuti(v: number): string {
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const GrigliaGhiaccioPage: React.FC = () => {
  const { session } = useAuth();
  const { visibile_set, is_admin_like, is_loading: is_loading_permessi } = usePermessiSezioniMatrix();
  const allowed = is_admin_like || visibile_set.has("griglia_ghiaccio");
  const { modalita, is_loading: is_loading_modalita } = useModalitaArea("ghiaccio");
  const is_editor = can_manage_griglia(session?.ruolo);

  const [data_sel, set_data_sel] = useState<string>(oggi_iso());
  const [risorsa_sel, set_risorsa_sel] = useState<string>("");
  const [espansi, set_espansi] = useState<string[]>([]);
  const [modal_open, set_modal_open] = useState(false);
  const [riepilogo_open, set_riepilogo_open] = useState(false);
  const [form, set_form] = useState({ ora_inizio: "17:00", ora_fine: "18:00", titolo: "" });

  // Wizard nuovo blocco
  const [passo, set_passo] = useState<"a" | "b">("a");
  const [fascia_scelta, set_fascia_scelta] = useState<string>("custom");
  const [modo_suddivisione, set_modo_suddivisione] = useState<"unico" | "sequenziale" | "parallelo">("unico");
  const [n_sessioni, set_n_sessioni] = useState(3);
  const [corsie, set_corsie] = useState<string[]>(["Pista 1", "Pista 2"]);
  const [creazione_in_corso, set_creazione_in_corso] = useState(false);
  const [forzatura_open, set_forzatura_open] = useState(false);
  const [motivo_blocco, set_motivo_blocco] = useState<string | null>(null);

  const [includi_ospiti, set_includi_ospiti] = useState(false);

  const { data: risorse = [] } = use_risorse_strutture();
  const risorse_ghiaccio = useMemo(
    () =>
      risorse.filter(
        (r) => r.tipo === "ghiaccio" && r.attiva && (includi_ospiti || !r.is_ospite),
      ),
    [risorse, includi_ospiti],
  );

  useEffect(() => {
    if (!risorsa_sel && risorse_ghiaccio.length > 0) set_risorsa_sel(risorse_ghiaccio[0].id);
  }, [risorse_ghiaccio, risorsa_sel]);

  // se disattivo gli ospiti mentre ne ho una selezionata, torno alla prima disponibile
  useEffect(() => {
    if (!risorsa_sel) return;
    if (!risorse_ghiaccio.some((r) => r.id === risorsa_sel)) {
      set_risorsa_sel(risorse_ghiaccio[0]?.id ?? "");
    }
  }, [risorse_ghiaccio, risorsa_sel]);

  const { data: blocchi = [], isLoading } = use_griglia_blocchi_giorno(data_sel, risorsa_sel || null);
  const upsert_blocco = use_upsert_blocco();
  const upsert_sessione = use_upsert_sessione();
  const elimina_blocco = use_elimina_blocco();

  const giorno_settimana = useMemo(() => (data_sel ? giorno_it_da_data(data_sel) : null), [data_sel]);
  const { data: fasce = [] } = use_disponibilita_giorno(risorsa_sel || null, giorno_settimana);
  const { data: fasce_pulizia = [] } = use_disponibilita_giorno(
    risorsa_sel || null,
    giorno_settimana,
    "pulizia",
  );

  const risorsa_corrente = risorse_ghiaccio.find((r) => r.id === risorsa_sel) ?? null;
  const nome_risorsa = risorsa_corrente?.nome ?? "";


  const titolo_suggerito = useMemo(() => {
    const l = label_data(data_sel);
    return l ? `Griglia di ${l.charAt(0).toUpperCase()}${l.slice(1)}` : "Griglia";
  }, [data_sel]);


  const riepilogo_istruttori = useMemo<IstruttoreStampa[]>(() => {
    const map = new Map<string, IstruttoreStampa>();
    for (const b of blocchi) {
      for (const s of b.sessioni ?? []) {
        const riga: RigaSessioneStampa = {
          ora_inizio: hhmm(s.ora_inizio),
          ora_fine: hhmm(s.ora_fine),
          pista: s.pista ?? null,
          specialita: s.specialita_nome || s.specialita_testo_libero || "Allenamento",
          specialita_descrizione: s.specialita_descrizione ?? null,
          atleti: (s.atleti ?? []).map((a) => ({
            nome: `${a.nome} ${a.cognome}`.trim(),
            provenienza: a.provenienza ?? null,
          })),
        };
        for (const i of s.istruttori ?? []) {
          const nome = `${i.nome} ${i.cognome}`.trim() || i.istruttore_id.slice(0, 8);
          const cur = map.get(i.istruttore_id) ?? { istruttore_id: i.istruttore_id, nome, sessioni: [] };
          cur.sessioni.push(riga);
          map.set(i.istruttore_id, cur);
        }
      }
    }
    return Array.from(map.values())
      .map((v) => ({
        ...v,
        sessioni: v.sessioni.sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio)),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [blocchi]);

  const stampa = () => {
    document.body.classList.add("stampa-griglia");
    const cleanup = () => {
      document.body.classList.remove("stampa-griglia");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1000);
  };


  const toggle_espanso = (id: string) =>
    set_espansi((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const apri_wizard = () => {
    set_passo("a");
    set_modo_suddivisione("unico");
    set_n_sessioni(3);
    set_corsie(["Pista 1", "Pista 2"]);
    set_fascia_scelta(fasce.length > 0 ? "0" : "custom");
    if (fasce.length > 0) {
      set_form({ ora_inizio: hhmm(fasce[0].ora_inizio), ora_fine: hhmm(fasce[0].ora_fine), titolo: "" });
    } else {
      set_form({ ora_inizio: "17:00", ora_fine: "18:00", titolo: "" });
    }
    set_modal_open(true);
  };

  const scegli_fascia = (val: string) => {
    set_fascia_scelta(val);
    if (val !== "custom") {
      const f = fasce[Number(val)];
      if (f) set_form((prev) => ({ ...prev, ora_inizio: hhmm(f.ora_inizio), ora_fine: hhmm(f.ora_fine) }));
    }
  };

  const salva_blocco = async (forzatura?: string) => {
    if (!risorsa_sel) {
      toast({ title: "Nessuna risorsa selezionata", variant: "destructive" });
      return;
    }

    if (!forzatura) {
      const check = verifica_orario_disponibilita({
        fasce_ghiaccio: fasce,
        fasce_pulizia,
        ora_inizio: form.ora_inizio,
        ora_fine: form.ora_fine,
        giorno: giorno_settimana ?? undefined,
        is_ospite: !!risorsa_corrente?.is_ospite,

      });
      if (!check.ok) {
        set_motivo_blocco(check.motivo ?? null);
        set_forzatura_open(true);
        return;
      }
    }

    set_creazione_in_corso(true);
    try {
      const id = await upsert_blocco.mutateAsync({
        data: data_sel,
        ora_inizio: form.ora_inizio,
        ora_fine: form.ora_fine,
        titolo: form.titolo.trim() || titolo_suggerito,
        risorsa_id: risorsa_sel,
        ...(forzatura ? { fuori_disponibilita: true, motivo_forzatura: forzatura } : {}),
      });

      if (id && modo_suddivisione === "sequenziale") {
        const inizio = minuti(form.ora_inizio);
        const fine = minuti(form.ora_fine);
        const totale = Math.max(fine - inizio, 0);
        const n = Math.max(1, Math.min(12, n_sessioni));
        const passo_min = Math.floor(totale / n);
        for (let i = 0; i < n; i++) {
          const s_start = inizio + passo_min * i;
          const s_end = i === n - 1 ? fine : inizio + passo_min * (i + 1);
          await upsert_sessione.mutateAsync({
            blocco_id: id,
            ordine: i + 1,
            ora_inizio: da_minuti(s_start),
            ora_fine: da_minuti(s_end),
            ...(forzatura ? { fuori_disponibilita: true, motivo_forzatura: forzatura } : {}),
          });
        }
      }

      if (id && modo_suddivisione === "parallelo") {
        for (let i = 0; i < corsie.length; i++) {
          await upsert_sessione.mutateAsync({
            blocco_id: id,
            ordine: i + 1,
            ora_inizio: form.ora_inizio,
            ora_fine: form.ora_fine,
            pista: corsie[i].trim() || `Pista ${i + 1}`,
            ...(forzatura ? { fuori_disponibilita: true, motivo_forzatura: forzatura } : {}),
          });
        }
      }

      set_modal_open(false);
      set_forzatura_open(false);
      set_form({ ora_inizio: "17:00", ora_fine: "18:00", titolo: "" });
      if (id) set_espansi((prev) => [...prev, id]);
      toast({ title: "Blocco creato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      set_creazione_in_corso(false);
    }
  };


  const rimuovi_blocco = async (id: string) => {
    try {
      await elimina_blocco.mutateAsync(id);
      toast({ title: "Blocco eliminato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  // ─── Controllo permessi (dopo tutti gli hook) ────────────
  if (is_loading_permessi || is_loading_modalita) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowed) return <Navigate to="/" replace />;

  if (modalita !== "griglia_giornaliera") {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <LayoutGrid className="w-10 h-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Griglia Ghiaccio</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Questa funzione non è attiva per il tuo club. Attivala in Setup del Club → Modalità di gestione.
        </p>
      </div>
    );
  }

  const render_lettura = (b: GrigliaBlocco) => (
    <div className="space-y-2">
      {(b.sessioni ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nessuna sotto-sessione.</p>
      )}
      {(b.sessioni ?? []).map((s) => (
        <div key={s.id} className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {hhmm(s.ora_inizio)}–{hhmm(s.ora_fine)}
            </span>
            <Badge variant="secondary">
              {s.specialita_nome || s.specialita_testo_libero || "Specialità non definita"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.istruttori.map((i) => (
              <span
                key={i.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-primary/40 bg-primary/10"
              >
                <GraduationCap className="w-3 h-3 text-primary" />
                {i.nome} {i.cognome}
              </span>
            ))}
            {s.atleti.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-border bg-background"
              >
                {a.nome} {a.cognome}
              </span>
            ))}
            {s.atleti.length === 0 && s.istruttori.length === 0 && (
              <span className="text-xs text-muted-foreground">Nessun assegnato.</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 print:hidden">
      <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-primary" /> Griglia Ghiaccio
            </h1>
            <div className="mt-1 inline-flex items-center rounded-xl bg-primary/10 border border-primary/30 px-4 py-2">
              <span className="text-xl md:text-3xl font-extrabold capitalize text-primary leading-tight">
                {label_data(data_sel)}
              </span>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={data_sel}
                onChange={(e) => set_data_sel(e.target.value)}
                className="h-9 w-[11rem]"
              />
            </div>
            {risorse_ghiaccio.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Pista</Label>
                <Select value={risorsa_sel} onValueChange={set_risorsa_sel}>
                  <SelectTrigger className="h-9 w-[12rem]">
                    <SelectValue placeholder="Seleziona pista" />
                  </SelectTrigger>
                  <SelectContent>
                    {risorse_ghiaccio.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {is_editor && (
              <Button variant="outline" onClick={() => set_riepilogo_open(true)}>
                <Printer className="w-4 h-4 mr-1" /> Stampa riepilogo istruttori
              </Button>
            )}
            {is_editor && (
              <Button onClick={apri_wizard} disabled={risorse_ghiaccio.length === 0}>
                <Plus className="w-4 h-4 mr-1" /> Nuovo blocco
              </Button>
            )}
          </div>
        </div>
      </div>

      <ProvenienzaLegenda />

      {risorse_ghiaccio.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Nessuna pista di ghiaccio attiva configurata. Vai in Setup del Club → Risorse e strutture per
            aggiungerne una prima di creare i blocchi della griglia.
          </span>
        </div>
      )}


      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : blocchi.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nessun blocco ghiaccio per questa data.
        </div>
      ) : (
        <div className="space-y-3">
          {blocchi.map((b) => {
            const aperto = espansi.includes(b.id);
            return (
              <div key={b.id} className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => toggle_espanso(b.id)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                  >
                    {aperto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-semibold truncate">{b.titolo || "Blocco ghiaccio"}</span>
                    <span className="text-sm text-muted-foreground">
                      {hhmm(b.ora_inizio)}–{hhmm(b.ora_fine)}
                    </span>
                  </button>
                  <Badge
                    className={
                      b.stato === "pubblicato"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-amber-100 text-amber-700 border-amber-200"
                    }
                  >
                    {b.stato === "pubblicato" ? "Pubblicato" : "Bozza"}
                  </Badge>
                  {b.fuori_disponibilita && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1">
                            <AlertTriangle className="w-3 h-3" /> Fuori disponibilità
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {b.motivo_forzatura || "Orario fuori dalla disponibilità dichiarata"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {is_editor && (
                    <Button variant="ghost" size="icon" onClick={() => rimuovi_blocco(b.id)} title="Elimina blocco">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {aperto && (
                  <div className="px-3 pb-4 border-t pt-3">
                    {is_editor ? <GrigliaBuilder blocco={b} blocchi_giorno={blocchi} /> : render_lettura(b)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={modal_open} onOpenChange={set_modal_open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {passo === "a" ? "Nuovo blocco — orario" : "Nuovo blocco — suddivisione"}
            </DialogTitle>
          </DialogHeader>

          {passo === "a" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {giorno_settimana} {nome_risorsa ? `— ${nome_risorsa}` : ""}
              </p>
              {fasce.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Nessuna disponibilità dichiarata per {giorno_settimana}
                    {nome_risorsa ? ` su ${nome_risorsa}` : ""} — inserisci l'orario manualmente.
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {fasce.map((f, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-muted/50"
                  >
                    <input
                      type="radio"
                      name="fascia"
                      checked={fascia_scelta === String(idx)}
                      onChange={() => scegli_fascia(String(idx))}
                    />
                    <span className="text-sm font-medium">
                      {hhmm(f.ora_inizio)}–{hhmm(f.ora_fine)}
                    </span>
                  </label>
                ))}
                <label className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    name="fascia"
                    checked={fascia_scelta === "custom"}
                    onChange={() => scegli_fascia("custom")}
                  />
                  <span className="text-sm font-medium">Orario personalizzato</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Ora inizio</Label>
                  <Input
                    type="time"
                    value={form.ora_inizio}
                    disabled={fascia_scelta !== "custom"}
                    onChange={(e) => set_form((f) => ({ ...f, ora_inizio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ora fine</Label>
                  <Input
                    type="time"
                    value={form.ora_fine}
                    disabled={fascia_scelta !== "custom"}
                    onChange={(e) => set_form((f) => ({ ...f, ora_fine: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Titolo (opzionale)</Label>
                <Input
                  value={form.titolo}
                  onChange={(e) => set_form((f) => ({ ...f, titolo: e.target.value }))}
                  placeholder={titolo_suggerito}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                Fascia scelta:{" "}
                <span className="font-semibold">
                  {form.ora_inizio}–{form.ora_fine}
                </span>
              </p>
              <div className="grid gap-2">
                <Button
                  variant={modo_suddivisione === "unico" ? "default" : "outline"}
                  onClick={() => set_modo_suddivisione("unico")}
                >
                  Un blocco unico
                </Button>
                <Button
                  variant={modo_suddivisione === "sequenziale" ? "default" : "outline"}
                  onClick={() => set_modo_suddivisione("sequenziale")}
                >
                  Dividi in N sessioni uguali
                </Button>
                <Button
                  variant={modo_suddivisione === "parallelo" ? "default" : "outline"}
                  onClick={() => set_modo_suddivisione("parallelo")}
                >
                  Dividi per pista/corsia in parallelo
                </Button>
              </div>

              {modo_suddivisione === "sequenziale" && (
                <div className="space-y-1">
                  <Label className="text-xs">Numero sessioni</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={n_sessioni}
                    onChange={(e) =>
                      set_n_sessioni(Math.max(1, Math.min(12, Number(e.target.value) || 1)))
                    }
                  />
                </div>
              )}

              {modo_suddivisione === "parallelo" && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Numero corsie</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={corsie.length}
                      onChange={(e) => {
                        const n = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                        set_corsie((prev) =>
                          Array.from({ length: n }, (_, i) => prev[i] ?? `Pista ${i + 1}`),
                        );
                      }}
                    />
                  </div>
                  {corsie.map((c, i) => (
                    <Input
                      key={i}
                      value={c}
                      onChange={(e) =>
                        set_corsie((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                      }
                      placeholder={`Pista ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {passo === "a" ? (
              <>
                <Button variant="outline" onClick={() => set_modal_open(false)}>
                  Annulla
                </Button>
                <Button onClick={() => set_passo("b")}>Avanti</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => set_passo("a")}>
                  Indietro
                </Button>
                <Button onClick={() => salva_blocco()} disabled={creazione_in_corso || upsert_blocco.isPending}>
                  Crea blocco
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={riepilogo_open} onOpenChange={set_riepilogo_open}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riepilogo istruttori</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {riepilogo_istruttori.length === 0 && (
              <p className="text-sm text-muted-foreground">Nessun istruttore assegnato per questa data.</p>
            )}
            {riepilogo_istruttori.map((i) => (
              <div key={i.istruttore_id} className="space-y-1">
                <h3 className="font-semibold">{i.nome}</h3>
                <p className="text-xs text-muted-foreground capitalize">{label_data(data_sel)}</p>
                <ul className="text-sm space-y-2 mt-1">
                  {i.sessioni.map((s, idx) => (
                    <li key={idx}>
                      <span className="font-medium">
                        {s.ora_inizio}–{s.ora_fine}
                      </span>
                      {s.pista ? ` — ${s.pista}` : ""} — {s.specialita}
                      {s.specialita_descrizione ? ` (${s.specialita_descrizione})` : ""}
                      <div className="text-muted-foreground">
                        Atleti:{" "}
                        {s.atleti
                          .map((a) => (a.provenienza ? `${a.nome} — ${a.provenienza}` : a.nome))
                          .join(", ") || "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_riepilogo_open(false)}>
              Chiudi
            </Button>
            <Button onClick={stampa}>
              <Printer className="w-4 h-4 mr-1" /> Stampa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfermaForzaturaDisponibilita
        open={forzatura_open}
        motivo={motivo_blocco}
        orario_label={`${form.ora_inizio}–${form.ora_fine}`}
        on_close={() => set_forzatura_open(false)}
        on_forza={(m) => salva_blocco(m)}
      />

      <StampaRiepilogoIstruttori istruttori={riepilogo_istruttori} data_label={label_data(data_sel)} />
    </div>
  );
};

export default GrigliaGhiaccioPage;

