import React, { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { usePermessiSezioniMatrix } from "@/hooks/usePermessi";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { can_manage_griglia } from "@/lib/roles";
import { use_griglia_blocchi_giorno } from "@/hooks/use-griglia-ghiaccio";
import { use_risorse_strutture } from "@/hooks/use-risorse-strutture";
import GrigliaPistaSezione from "@/components/griglia/GrigliaPistaSezione";
import ProvenienzaLegenda from "@/components/ProvenienzaLegenda";
import StampaRiepilogoIstruttori, {
  type IstruttoreStampa,
  type RigaSessioneStampa,
} from "@/components/griglia/StampaRiepilogoIstruttori";
import TableauPosterStampa, {
  hhmm_da_min,
  type FormatoCarta,
  type TableauCorsia,
  type TableauEvento,
} from "@/components/griglia/TableauPosterStampa";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LayoutGrid, Printer, AlertTriangle, Columns3 } from "lucide-react";

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

const GrigliaGhiaccioPage: React.FC = () => {
  const { session } = useAuth();
  const { visibile_set, is_admin_like, is_loading: is_loading_permessi } = usePermessiSezioniMatrix();
  const allowed = is_admin_like || visibile_set.has("griglia_ghiaccio");
  const { modalita, is_loading: is_loading_modalita } = useModalitaArea("ghiaccio");
  const is_editor = can_manage_griglia(session?.ruolo);

  const [data_sel, set_data_sel] = useState<string>(oggi_iso());
  const [includi_ospiti, set_includi_ospiti] = useState(false);
  const [riepilogo_open, set_riepilogo_open] = useState(false);
  const [tableau_open, set_tableau_open] = useState(false);
  const [formato_carta, set_formato_carta] = useState<FormatoCarta>("A4");

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
    for (const b of blocchi_giorno) {
      if (!b.risorsa_id) continue;
      for (const s of b.sessioni ?? []) {
        out.push({
          id: s.id,
          risorsa_id: b.risorsa_id,
          inizio_min: min_da_hhmm(s.ora_inizio),
          fine_min: min_da_hhmm(s.ora_fine),
          titolo: s.corso_nome || s.specialita_nome || s.specialita_testo_libero || "Allenamento",
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
          </div>
        </div>
      </div>

      <ProvenienzaLegenda />

      <div className="space-y-5">
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

      <StampaRiepilogoIstruttori istruttori={riepilogo_istruttori} data_label={label_data(data_sel)} />
    </div>
  );
};

export default GrigliaGhiaccioPage;
