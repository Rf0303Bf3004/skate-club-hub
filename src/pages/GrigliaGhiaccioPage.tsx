import React, { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { usePermessiSezioniMatrix } from "@/hooks/usePermessi";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import { use_griglia_blocchi_giorno, giorno_it_da_data } from "@/hooks/use-griglia-ghiaccio";
import { use_risorse_strutture } from "@/hooks/use-risorse-strutture";
import GrigliaPistaSezione from "@/components/griglia/GrigliaPistaSezione";
import ProvenienzaLegenda from "@/components/ProvenienzaLegenda";
import DisponibilitaResiduaPopover from "@/components/griglia/DisponibilitaResiduaPopover";
import BannerDisponibilitaScaduta from "@/components/common/BannerDisponibilitaScaduta";
import BlocchiFuoriStagione from "@/components/griglia/BlocchiFuoriStagione";
import TableauSchermo from "@/components/griglia/TableauSchermo";
import SettimanaView from "@/components/griglia/SettimanaView";
import MeseGrigliaView from "@/components/griglia/MeseGrigliaView";
import StagioneView from "@/components/griglia/StagioneView";
import LegendaFonti from "@/components/griglia/LegendaFonti";
import StampaRiepilogoIstruttori, {
  type IstruttoreStampa,
  type RigaSessioneStampa,
} from "@/components/griglia/StampaRiepilogoIstruttori";
import TableauPosterStampa, {
  calcola_fogli,
  hhmm_da_min,
  impacchetta_sottorighe,
  type FormatoCarta,
  type TableauCorsia,
  type TableauEvento,
} from "@/components/griglia/TableauPosterStampa";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, Printer, AlertTriangle, Columns3, Rows3, CalendarDays, CalendarRange, CalendarClock } from "lucide-react";

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

function min_da_hhmm(t?: string | null): number {
  const [h, m] = hhmm(t).split(":");
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

const GrigliaGhiaccioPage: React.FC = () => {
  const { session } = useAuth();
  const { visibile_set, is_admin_like, is_loading: is_loading_permessi } = usePermessiSezioniMatrix();
  const allowed = is_admin_like || visibile_set.has("griglia_ghiaccio");
  const { modalita, is_loading: is_loading_modalita } = useModalitaArea("ghiaccio");
  const { puo_pianificare } = usePermessiAzione();
  const is_editor = puo_pianificare;

  const [data_sel, set_data_sel] = useState<string>(oggi_iso());
  const [includi_ospiti, set_includi_ospiti] = useState(false);
  const [riepilogo_open, set_riepilogo_open] = useState(false);
  const [tableau_open, set_tableau_open] = useState(false);
  const [formato_carta, set_formato_carta] = useState<FormatoCarta>("A4");
  const [periodo, set_periodo] = useState<"giorno" | "settimana" | "mese" | "stagione">("giorno");
  const [vista, set_vista] = useState<"impilata" | "tableau">("impilata");
  const navigate = useNavigate();

  const { data: risorse = [] } = use_risorse_strutture();
  const risorse_ghiaccio = useMemo(
    () =>
      risorse
        .filter((r) => r.tipo === "ghiaccio" && r.attiva && (includi_ospiti || !r.is_ospite))
        .sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)),
    [risorse, includi_ospiti],
  );
  const risorse_palestra = useMemo(
    () =>
      risorse
        .filter((r) => r.tipo === "palestra" && r.attiva && (includi_ospiti || !r.is_ospite))
        .sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)),
    [risorse, includi_ospiti],
  );

  // Riepilogo istruttori: aggregato su TUTTE le piste del giorno
  const { data: blocchi_giorno = [] } = use_griglia_blocchi_giorno(data_sel);

  const riepilogo_istruttori = useMemo<IstruttoreStampa[]>(() => {
    const map = new Map<string, IstruttoreStampa>();
    for (const b of blocchi_giorno) {
      for (const s of b.sessioni ?? []) {
        const riga: RigaSessioneStampa = {
          ora_inizio: hhmm(s.ora_inizio),
          ora_fine: hhmm(s.ora_fine),
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
  }, [blocchi_giorno]);

  // ─── Tableau poster (swimlane per risorsa) ───────────────
  const corsie_tableau = useMemo<TableauCorsia[]>(
    () =>
      [...risorse_ghiaccio, ...risorse_palestra].map((r) => ({
        id: r.id,
        nome: r.nome,
        tipo: r.tipo,
        colore: r.colore,
      })),
    [risorse_ghiaccio, risorse_palestra],
  );

  const eventi_tableau = useMemo<TableauEvento[]>(() => {
    const out: TableauEvento[] = [];
    let progressivo = 0;
    for (const b of blocchi_giorno) {
      if (!b.risorsa_id) continue;
      for (const s of b.sessioni ?? []) {
        progressivo += 1;
        const gruppi = (s.gruppi ?? []).map((g) => g.gruppo_livello).filter(Boolean).join(" + ");
        out.push({
          id: s.id,
          risorsa_id: b.risorsa_id,
          inizio_min: min_da_hhmm(s.ora_inizio),
          fine_min: min_da_hhmm(s.ora_fine),
          titolo:
            s.corso_nome ||
            s.specialita_nome ||
            s.specialita_testo_libero ||
            gruppi ||
            `Sessione ${progressivo}`,
          istruttori: (s.istruttori ?? []).map((i) => `${i.nome} ${i.cognome}`.trim()).join(", "),
          fuori_disponibilita: !!s.fuori_disponibilita,
        });
      }
    }
    return out;
  }, [blocchi_giorno]);

  const finestra_tableau = useMemo(() => {
    const rilevanti = blocchi_giorno.filter((b) => b.risorsa_id && corsie_tableau.some((c) => c.id === b.risorsa_id));
    if (rilevanti.length === 0) return { min_inizio: 8 * 60, min_fine: 20 * 60 };
    const inizio = Math.min(...rilevanti.map((b) => min_da_hhmm(b.ora_inizio)));
    const fine = Math.max(...rilevanti.map((b) => min_da_hhmm(b.ora_fine)));
    return {
      min_inizio: Math.max(0, Math.floor((inizio - 30) / 30) * 30),
      min_fine: Math.min(24 * 60, Math.ceil((fine + 30) / 30) * 30),
    };
  }, [blocchi_giorno, corsie_tableau]);

  const fogli_tableau = useMemo(
    () => calcola_fogli(formato_carta, finestra_tableau.min_inizio, finestra_tableau.min_fine),
    [formato_carta, finestra_tableau],
  );

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

  const stampa_tableau = () => {
    document.body.classList.add("stampa-tableau");
    const cleanup = () => {
      document.body.classList.remove("stampa-tableau");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1000);
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
            <label className="flex cursor-pointer items-center gap-2 pt-5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={includi_ospiti}
                onChange={(e) => set_includi_ospiti(e.target.checked)}
              />
              Includi risorse ospiti (trasferta)
            </label>

            {is_editor && (
              <Button variant="outline" onClick={() => set_riepilogo_open(true)}>
                <Printer className="w-4 h-4 mr-1" /> Stampa riepilogo istruttori
              </Button>
            )}

            <DisponibilitaResiduaPopover
              data_sel={data_sel}
              risorse={[...risorse_ghiaccio, ...risorse_palestra].map((r) => ({
                id: r.id,
                nome: r.nome,
                tipo: r.tipo,
              }))}
            />

            <Button variant="outline" onClick={() => set_tableau_open(true)}>
              <Columns3 className="w-4 h-4 mr-1" /> Stampa tableau poster
            </Button>
          </div>
        </div>
      </div>

      <BannerDisponibilitaScaduta />
      <BlocchiFuoriStagione is_editor={is_editor} />

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={periodo}
          onValueChange={(v) => v && set_periodo(v as typeof periodo)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="giorno" aria-label="Vista giorno">
            <CalendarDays className="mr-1 h-4 w-4" /> Giorno
          </ToggleGroupItem>
          <ToggleGroupItem value="settimana" aria-label="Vista settimana">
            <CalendarRange className="mr-1 h-4 w-4" /> Settimana
          </ToggleGroupItem>
          <ToggleGroupItem value="mese" aria-label="Vista mese">
            <CalendarDays className="mr-1 h-4 w-4" /> Mese
          </ToggleGroupItem>
          <ToggleGroupItem value="stagione" aria-label="Vista stagione">
            <CalendarClock className="mr-1 h-4 w-4" /> Stagione
          </ToggleGroupItem>
        </ToggleGroup>

        {periodo === "giorno" && (
          <ToggleGroup
            type="single"
            value={vista}
            onValueChange={(v) => v && set_vista(v as "impilata" | "tableau")}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="impilata" aria-label="Vista impilata">
              <Rows3 className="mr-1 h-4 w-4" /> Impilata
            </ToggleGroupItem>
            <ToggleGroupItem value="tableau" aria-label="Vista tableau">
              <Columns3 className="mr-1 h-4 w-4" /> Tableau
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      <ProvenienzaLegenda />
      {periodo !== "giorno" && <LegendaFonti />}

      {periodo === "settimana" ? (
        <SettimanaView
          data_sel={data_sel}
          includi_ospiti={includi_ospiti}
          on_cambia_data={set_data_sel}
          on_apri_giorno={(d) => {
            set_data_sel(d);
            set_periodo("giorno");
          }}
          on_apri_planning={() => navigate("/planning")}
        />
      ) : periodo === "mese" ? (
        <MeseGrigliaView
          data_sel={data_sel}
          includi_ospiti={includi_ospiti}
          on_cambia_data={set_data_sel}
          on_apri_settimana={(d) => {
            set_data_sel(d);
            set_periodo("settimana");
          }}
          on_apri_giorno={(d) => {
            set_data_sel(d);
            set_periodo("giorno");
          }}
        />
      ) : periodo === "stagione" ? (
        <StagioneView
          includi_ospiti={includi_ospiti}
          on_apri_settimana={(d) => {
            set_data_sel(d);
            set_periodo("settimana");
          }}
        />
      ) : vista === "tableau" ? (
        <TableauSchermo
          corsie={corsie_tableau}
          eventi={eventi_tableau}
          min_inizio={finestra_tableau.min_inizio}
          min_fine={finestra_tableau.min_fine}
          giorno_settimana={giorno_it_da_data(data_sel)}
        />
      ) : (
      <div className="space-y-5">
        {!is_editor && (
          <NotaPermesso testo="Solo chi pianifica il ghiaccio può modificare la griglia." />
        )}
        {risorse_ghiaccio.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Nessuna pista di ghiaccio attiva configurata. Vai in Setup del Club → Risorse e strutture per
              aggiungerne una prima di creare i blocchi della griglia.
            </span>
          </div>
        ) : (
          <div className="space-y-5">
            {risorse_ghiaccio.map((r) => (
              <GrigliaPistaSezione key={r.id} risorsa={r} data_sel={data_sel} is_editor={is_editor} />
            ))}
          </div>
        )}

        {risorse_palestra.length > 0 && (
          <div className="space-y-3 pt-2">
            <Separator />
            <h2 className="text-sm font-semibold text-muted-foreground">Palestre / Off Ice</h2>
            <div className="space-y-5">
              {risorse_palestra.map((r) => (
                <GrigliaPistaSezione key={r.id} risorsa={r} data_sel={data_sel} is_editor={is_editor} />
              ))}
            </div>
          </div>
        )}
      </div>
      )}

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
                      — {s.specialita}
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

      <Dialog open={tableau_open} onOpenChange={set_tableau_open}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tableau poster stampabile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Formato carta (sempre orizzontale)</Label>
                <div className="flex gap-2">
                  {(["A4", "A3"] as FormatoCarta[]).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={formato_carta === f ? "default" : "outline"}
                      onClick={() => set_formato_carta(f)}
                    >
                      {f} landscape
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Fascia oraria {hhmm_da_min(finestra_tableau.min_inizio)}–{hhmm_da_min(finestra_tableau.min_fine)} ·{" "}
                {corsie_tableau.length} corsie · {eventi_tableau.length} sessioni
              </p>
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {fogli_tableau.length} foglio{fogli_tableau.length > 1 ? "i" : ""} da affiancare in orizzontale
              </p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground text-xs">
                {fogli_tableau.map((f) => (
                  <li key={f.indice}>
                    Foglio {f.indice}: {hhmm_da_min(f.da)} – {hhmm_da_min(f.a)} (tutte le risorse)
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                I segni di registro «+» agli angoli sono alla stessa altezza su ogni foglio: accosta il marker destro
                del foglio N a quello sinistro del foglio N+1 per allineare le corsie.
              </p>
            </div>

            {/* Anteprima a schermo (scala ridotta, solo prima fascia) */}
            <div className="rounded-lg border p-3 space-y-1 overflow-x-auto">
              {corsie_tableau.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessuna risorsa attiva per questo giorno.</p>
              ) : (
                corsie_tableau.map((c) => {
                  const items = eventi_tableau.filter((e) => e.risorsa_id === c.id);
                  const { riga_per_evento, n_righe } = impacchetta_sottorighe(items);
                  return (
                    <div key={c.id} className="flex items-start gap-2 text-xs">
                      <span
                        className="mt-1 inline-block h-3 w-1 shrink-0 rounded"
                        style={{ backgroundColor: c.colore || "hsl(var(--primary))" }}
                      />
                      <span className="w-40 shrink-0 truncate font-medium">
                        {c.nome}
                        {n_righe > 1 && (
                          <span className="ml-1 text-muted-foreground">({n_righe} gruppi)</span>
                        )}
                      </span>
                      <span className="text-muted-foreground min-w-0">
                        {items.length === 0
                          ? "—"
                          : [...items]
                              .sort(
                                (a, b) =>
                                  (riga_per_evento[a.id] ?? 0) - (riga_per_evento[b.id] ?? 0) ||
                                  a.inizio_min - b.inizio_min,
                              )
                              .map(
                                (e) =>
                                  `${n_righe > 1 ? `[${(riga_per_evento[e.id] ?? 0) + 1}] ` : ""}${hhmm_da_min(e.inizio_min)} ${e.titolo}${e.istruttori ? ` – ${e.istruttori}` : ""}`,
                              )
                              .join(" · ")}
                      </span>
                    </div>
                  );
                })

              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => set_tableau_open(false)}>
              Chiudi
            </Button>
            <Button onClick={stampa_tableau} disabled={corsie_tableau.length === 0}>
              <Printer className="w-4 h-4 mr-1" /> Stampa tableau
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StampaRiepilogoIstruttori istruttori={riepilogo_istruttori} data_label={label_data(data_sel)} />

      <TableauPosterStampa
        corsie={corsie_tableau}
        eventi={eventi_tableau}
        min_inizio={finestra_tableau.min_inizio}
        min_fine={finestra_tableau.min_fine}
        data_label={label_data(data_sel)}
        formato={formato_carta}
      />
    </div>

  );
};

export default GrigliaGhiaccioPage;
