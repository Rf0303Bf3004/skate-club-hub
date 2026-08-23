import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgePercent, MapPin, Calendar, Ticket, Star, Loader2, Tag, Search, X, Globe2, SlidersHorizontal, List, Map as MapIcon, UtensilsCrossed } from "lucide-react";
import { Input } from "@/components/ui/input";
import QRCode from "qrcode";
import { is_pubblicata, stato_validita } from "@/lib/convenzioni-date";
import { use_nazioni, use_regioni, raggruppa_per_nazione } from "@/lib/convenzioni-territori";
import { e_area_alloggio, e_area_ristorazione } from "@/lib/convenzioni-tipologie";
import MappaConvenzioni from "@/components/convenzioni/MappaConvenzioni";

interface Area { id: string; nome: string; icona: string | null; ordine: number; attiva: boolean; }
interface Tipo { id: string; nome: string; formato: string | null; }
interface Convenzione {
  id: string;
  area_id: string | null;
  azienda: string;
  titolo: string;
  descrizione: string | null;
  logo_url: string | null;
  immagine_url: string | null;
  indirizzo: string | null;
  geo_cantone: string | null;
  geo_citta: string | null;
  regione_id: string | null;
  provincia_id: string | null;
  stelle: number | null;
  tipo_cucina: string | null;
  fascia_prezzo: string | null;
  validita_da: string | null;
  validita_a: string | null;
  pubblicazione_da: string | null;
  pubblicazione_a: string | null;
  codice_sconto: string | null;
  qr_token: string;
  stato: string;
  in_evidenza: boolean;
  tipo_proposta_id: string | null;
  valore_proposta: string | null;
  convenzioni_aree?: Area | null;
  convenzioni_tipi_proposta?: Tipo | null;
  convenzioni_province?: { id: string; nome: string } | null;
  convenzioni_regioni?: { id: string; nome: string; nazione_id: string; ordine: number; convenzioni_nazioni?: { id: string; nome: string; ordine: number } | null } | null;
}

/** Sezioni tematiche della vista soci. */
type sezione_tema = "tutte" | "hotel" | "ristoranti" | "altro";

function sezione_di(c: Convenzione): Exclude<sezione_tema, "tutte"> {
  const nome = c.convenzioni_aree?.nome;
  if (e_area_ristorazione(nome)) return "ristoranti";
  if (e_area_alloggio(nome)) return "hotel";
  return "altro";
}



function format_proposta(formato: string | null | undefined, valore: string | null | undefined): string | null {
  const v = (valore ?? "").trim();
  if (!v) return null;
  if (formato === "percentuale") return `-${v}%`;
  if (formato === "importo") return `-${v} CHF`;
  return v;
}

function useSignedUrl(path: string | null | undefined) {
  const [url, set_url] = useState<string | null>(null);
  useEffect(() => {
    let attivo = true;
    if (!path) { set_url(null); return; }
    supabase.storage.from("convenzioni").createSignedUrl(path, 3600).then(({ data }) => {
      if (attivo) set_url(data?.signedUrl ?? null);
    });
    return () => { attivo = false; };
  }, [path]);
  return url;
}

/** Pillola filtro con contatore. */
const FilterPill: React.FC<{
  attivo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
}> = ({ attivo, onClick, children, count }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={count === 0 && !attivo}
    className={[
      "group inline-flex items-center gap-2 rounded-full border px-3.5 h-9 text-sm font-medium",
      "transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed",
      attivo
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-accent",
    ].join(" ")}
  >
    <span className="truncate max-w-[11rem]">{children}</span>
    <span
      className={[
        "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[11px] font-semibold tabular-nums transition-colors",
        attivo ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
      ].join(" ")}
    >
      {count}
    </span>
  </button>
);

const ConvenzioneCard: React.FC<{ c: Convenzione; on_open: (c: Convenzione) => void }> = ({ c, on_open }) => {
  const logo = useSignedUrl(c.logo_url);
  const banner = useSignedUrl(c.immagine_url);
  const lbl = format_proposta(c.convenzioni_tipi_proposta?.formato, c.valore_proposta);
  const stato_val = stato_validita(c);
  const luogo = [c.geo_citta, c.convenzioni_province?.nome, c.convenzioni_regioni?.nome ?? c.geo_cantone].filter(Boolean).join(" · ");


  return (
    <button
      type="button"
      onClick={() => on_open(c)}
      className={[
        "group relative text-left bg-card border rounded-2xl overflow-hidden flex flex-col",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        c.in_evidenza ? "border-amber-300/70 ring-1 ring-amber-200/60" : "border-border hover:border-primary/30",
      ].join(" ")}
    >
      <div className="relative aspect-[16/9] bg-gradient-to-br from-muted via-muted/60 to-accent overflow-hidden">
        {banner ? (
          <img
            src={banner}
            alt={c.azienda}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl font-black text-muted-foreground/25 tracking-tight">
              {c.azienda.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/85 to-transparent" />

        {c.in_evidenza && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-amber-500 text-white text-[11px] font-semibold px-2.5 py-1 shadow-sm">
            <Star className="w-3 h-3 fill-white" /> In evidenza
          </span>
        )}
        {lbl && (
          <span className="absolute top-3 right-3 rounded-full bg-primary text-primary-foreground text-sm font-bold px-3 py-1 shadow-md">
            {lbl}
          </span>
        )}

        <div className="absolute -bottom-7 left-5 w-16 h-16 rounded-xl border border-border bg-card shadow-md flex items-center justify-center overflow-hidden">
          {logo
            ? <img src={logo} alt={c.azienda} className="w-full h-full object-contain p-1.5" />
            : <span className="text-xl font-bold text-muted-foreground">{c.azienda.charAt(0).toUpperCase()}</span>}
        </div>
      </div>

      <div className="pt-10 px-5 pb-5 flex flex-col gap-3 flex-1">
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-foreground leading-tight truncate">{c.azienda}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-snug">{c.titolo}</p>
        </div>

        {!!c.stelle && (
          <div className="flex items-center gap-0.5" aria-label={`${c.stelle} stelle`}>
            {Array.from({ length: c.stelle }).map((_, i) => (
              <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {c.convenzioni_aree?.nome && (
            <Badge variant="secondary" className="gap-1 font-medium">
              <Tag className="w-3 h-3" />{c.convenzioni_aree.nome}
            </Badge>
          )}
          {c.tipo_cucina && (
            <Badge variant="outline" className="gap-1 font-normal">
              <UtensilsCrossed className="w-3 h-3" />{c.tipo_cucina}
            </Badge>
          )}
          {c.fascia_prezzo && (
            <Badge variant="outline" className="font-semibold text-emerald-700 border-emerald-200 bg-emerald-50">
              {c.fascia_prezzo}
            </Badge>
          )}
          {luogo && (
            <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
              <MapPin className="w-3 h-3" />{luogo}
            </Badge>
          )}
          {stato_val.label && (
            <Badge
              variant="outline"
              className={stato_val.tipo === "scaduta"
                ? "text-muted-foreground bg-muted/50"
                : "border-amber-300 text-amber-700 bg-amber-50"}
            >
              {stato_val.label}
            </Badge>
          )}
        </div>

        {(c.validita_da || c.validita_a) && (
          <div className="mt-auto pt-3 border-t border-border/70 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>Valida {c.validita_da ?? "—"} → {c.validita_a ?? "—"}</span>
          </div>
        )}
      </div>
    </button>
  );
};

const DettaglioDialog: React.FC<{ c: Convenzione | null; on_close: () => void }> = ({ c, on_close }) => {
  const [qr_url, set_qr_url] = useState<string | null>(null);
  const logo = useSignedUrl(c?.logo_url ?? null);
  const banner = useSignedUrl(c?.immagine_url ?? null);

  useEffect(() => {
    if (!c) { set_qr_url(null); return; }
    const target = `${window.location.origin}/c/${c.qr_token}`;
    QRCode.toDataURL(target, { width: 320, margin: 1 }).then((u) => set_qr_url(u)).catch(() => set_qr_url(null));
  }, [c?.id]);

  if (!c) return null;
  const lbl = format_proposta(c.convenzioni_tipi_proposta?.formato, c.valore_proposta);
  const stato_val = stato_validita(c);

  return (
    <Dialog open={!!c} onOpenChange={(o) => { if (!o) on_close(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 border border-border rounded bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
              {logo
                ? <img src={logo} alt={c.azienda} className="w-full h-full object-contain" />
                : <span className="text-lg font-bold text-muted-foreground">{c.azienda.charAt(0).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold truncate">{c.azienda}</p>
              <p className="text-sm font-normal text-muted-foreground truncate">{c.titolo}</p>
            </div>
            {lbl && <Badge className="bg-primary text-primary-foreground hover:bg-primary">{lbl}</Badge>}
            {stato_val.label && (
              <Badge variant="outline" className={stato_val.tipo === "scaduta" ? "text-muted-foreground" : "border-amber-300 text-amber-700 bg-amber-50"}>
                {stato_val.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {banner && (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <img src={banner} alt={c.azienda} className="w-full h-full object-cover" />
            </div>
          )}

          {c.descrizione && (
            <p className="text-sm text-foreground whitespace-pre-wrap">{c.descrizione}</p>
          )}

          <div className="space-y-2 text-sm">
            {(c.indirizzo || c.geo_citta || c.geo_cantone) && (
              <div className="flex gap-2 text-foreground">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{[c.indirizzo, c.geo_citta, c.geo_cantone].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {(c.validita_da || c.validita_a) && (
              <div className="flex gap-2 text-foreground">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>Validità: {c.validita_da ?? "—"} → {c.validita_a ?? "—"}</span>
              </div>
            )}
          </div>

          <div className="bg-muted/40 border border-border rounded-lg p-4 flex flex-col items-center gap-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Mostra in negozio
            </p>
            {qr_url
              ? <img src={qr_url} alt="QR convenzione" className="w-48 h-48" />
              : <div className="w-48 h-48 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
            {c.codice_sconto && (
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Codice:</span>
                <code className="bg-background border border-border rounded px-2 py-0.5 text-sm font-mono">
                  {c.codice_sconto}
                </code>
              </div>
            )}
            <a
              href={`/c/${c.qr_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Apri pagina pubblica
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function ConvenzioniSociPage() {
  const { session } = useAuth();
  const [area_id, set_area_id] = useState<string | null>(null);
  const [regione_id, set_regione_id] = useState<string | null>(null);
  const [search, set_search] = useState("");
  const [selected, set_selected] = useState<Convenzione | null>(null);
  const [sezione, set_sezione] = useState<sezione_tema>("tutte");
  const [vista, set_vista] = useState<"lista" | "mappa">("lista");

  const { data: club } = useQuery({
    queryKey: ["club_geo", session?.club_id],
    enabled: !!session?.club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clubs")
        .select("citta, cantone")
        .eq("id", session!.club_id)
        .maybeSingle();
      return data ?? { citta: null, cantone: null };
    },
  });

  const { data: aree_src = [] } = useQuery({
    queryKey: ["convenzioni_aree_attive"],
    queryFn: async () => {
      const { data } = await supabase
        .from("convenzioni_aree")
        .select("*")
        .eq("attiva", true)
        .order("ordine");
      return (data ?? []) as Area[];
    },
  });

  const { data: nazioni = [] } = use_nazioni();
  const { data: regioni_all = [] } = use_regioni();

  const { data: convenzioni_src = [], isLoading } = useQuery({
    queryKey: ["convenzioni_attive"],
    queryFn: async () => {
      const { data } = await supabase
        .from("convenzioni")
        .select("*, convenzioni_aree(id, nome, icona, ordine, attiva), convenzioni_tipi_proposta(id, nome, formato), convenzioni_province(id, nome), convenzioni_regioni(id, nome, nazione_id, ordine, convenzioni_nazioni(id, nome, ordine))")
        .eq("stato", "attiva");
      return ((data ?? []) as unknown as Convenzione[]).filter((c) => is_pubblicata(c));
    },
  });

  // Traduzione automatica del CONTENUTO (fallback silenzioso all'italiano)
  const { traduci: t_conv, mappa: mappa_conv } = use_contenuti_traduzioni(
    "convenzioni",
    useMemo(() => convenzioni_src.map((c) => c.id), [convenzioni_src]),
  );
  const { traduci: t_area, mappa: mappa_aree } = use_contenuti_traduzioni(
    "convenzioni_aree",
    useMemo(
      () => [...aree_src.map((a) => a.id), ...convenzioni_src.map((c) => c.convenzioni_aree?.id).filter(Boolean) as string[]],
      [aree_src, convenzioni_src],
    ),
  );

  const aree = useMemo(
    () => aree_src.map((a) => ({ ...a, nome: t_area(a.id, "nome", a.nome) })),
    [aree_src, mappa_aree],
  );

  const convenzioni = useMemo(
    () =>
      convenzioni_src.map((c) => ({
        ...c,
        titolo: t_conv(c.id, "titolo", c.titolo),
        descrizione: t_conv(c.id, "descrizione", c.descrizione),
        valore_proposta: t_conv(c.id, "valore_proposta", c.valore_proposta),
        convenzioni_aree: c.convenzioni_aree
          ? { ...c.convenzioni_aree, nome: t_area(c.convenzioni_aree.id, "nome", c.convenzioni_aree.nome) }
          : c.convenzioni_aree,
      })) as Convenzione[],
    [convenzioni_src, mappa_conv, mappa_aree],
  );


  const match_search = (c: Convenzione, q: string) =>
    !q ||
    `${c.azienda ?? ""} ${c.titolo ?? ""} ${c.descrizione ?? ""} ${c.geo_citta ?? ""} ${c.convenzioni_regioni?.nome ?? ""} ${c.convenzioni_regioni?.convenzioni_nazioni?.nome ?? ""} ${c.geo_cantone ?? ""} ${c.convenzioni_aree?.nome ?? ""}`
      .toLowerCase()
      .includes(q);

  const q = search.trim().toLowerCase();

  /** Base su cui contare: la ricerca testuale si applica sempre. */
  const base_ricerca = useMemo(() => convenzioni.filter((c) => match_search(c, q)), [convenzioni, q]);

  /** Contatori per le sezioni tematiche (Hotel & Viaggi / Ristoranti / Altro). */
  const conteggi_sezioni = useMemo(() => {
    const m: Record<Exclude<sezione_tema, "tutte">, number> = { hotel: 0, ristoranti: 0, altro: 0 };
    base_ricerca.forEach((c) => { m[sezione_di(c)] += 1; });
    return m;
  }, [base_ricerca]);

  const base = useMemo(
    () => (sezione === "tutte" ? base_ricerca : base_ricerca.filter((c) => sezione_di(c) === sezione)),
    [base_ricerca, sezione],
  );

  /** Conteggi incrociati: ogni contatore rispetta l'altro filtro attivo. */
  const conteggi_aree = useMemo(() => {
    const m = new Map<string, number>();
    base
      .filter((c) => !regione_id || c.regione_id === regione_id)
      .forEach((c) => {
        if (!c.area_id) return;
        m.set(c.area_id, (m.get(c.area_id) ?? 0) + 1);
      });
    return m;
  }, [base, regione_id]);

  /** Pillole geografiche a due livelli: Nazione → Regioni (solo quelle con convenzioni). */
  const gruppi_geo = useMemo(() => {
    const conteggi = new Map<string, number>();
    base
      .filter((c) => !area_id || c.area_id === area_id)
      .forEach((c) => {
        if (!c.regione_id) return;
        conteggi.set(c.regione_id, (conteggi.get(c.regione_id) ?? 0) + 1);
      });
    return raggruppa_per_nazione(nazioni, regioni_all)
      .map((g) => ({
        nazione: g.nazione.nome,
        voci: g.regioni
          .filter((r) => (conteggi.get(r.id) ?? 0) > 0)
          .map((r) => ({ id: r.id, nome: r.nome, count: conteggi.get(r.id) ?? 0 })),
      }))
      .filter((g) => g.voci.length > 0);
  }, [base, area_id, nazioni, regioni_all]);

  const lista_ordinata = useMemo(() => {
    const filtrate = base.filter(
      (c) => (!area_id || c.area_id === area_id) && (!regione_id || c.regione_id === regione_id),
    );
    const citta = (club?.citta || "").trim().toLowerCase();
    const cantone = (club?.cantone || "").trim().toUpperCase();
    const rank = (c: Convenzione) => {
      const cc = (c.geo_citta || "").trim().toLowerCase();
      const cn = (c.geo_cantone || "").trim().toUpperCase();
      if (citta && cc === citta) return 0;
      if (cantone && cn === cantone) return 1;
      return 2;
    };
    return [...filtrate].sort((a, b) => {
      if (a.in_evidenza !== b.in_evidenza) return a.in_evidenza ? -1 : 1;
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.azienda.localeCompare(b.azienda);
    });
  }, [base, area_id, regione_id, club?.citta, club?.cantone]);

  const filtri_attivi = !!area_id || !!regione_id || !!q || sezione !== "tutte";
  const reset_filtri = () => { set_area_id(null); set_regione_id(null); set_search(""); set_sezione("tutte"); };
  const nome_area = aree.find((a) => a.id === area_id)?.nome;
  const nome_regione = regioni_all.find((r) => r.id === regione_id)?.nome;


  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header premium */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent p-6 md:p-8">
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <BadgePercent className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Convenzioni</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Vantaggi esclusivi riservati ai soci del club
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold tabular-nums text-foreground leading-none">{convenzioni.length}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Partner attivi</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-3xl font-bold tabular-nums text-foreground leading-none">{gruppi_geo.reduce((n, g) => n + g.voci.length, 0)}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Destinazioni</p>
            </div>
          </div>
        </div>
      </header>

      {/* Sezioni tematiche + vista */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterPill attivo={sezione === "tutte"} onClick={() => set_sezione("tutte")} count={base_ricerca.length}>
            Tutte
          </FilterPill>
          <FilterPill attivo={sezione === "hotel"} onClick={() => set_sezione("hotel")} count={conteggi_sezioni.hotel}>
            Hotel & Viaggi
          </FilterPill>
          <FilterPill attivo={sezione === "ristoranti"} onClick={() => set_sezione("ristoranti")} count={conteggi_sezioni.ristoranti}>
            Ristoranti
          </FilterPill>
          <FilterPill attivo={sezione === "altro"} onClick={() => set_sezione("altro")} count={conteggi_sezioni.altro}>
            Altro
          </FilterPill>
        </div>
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => set_vista("lista")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-sm font-medium transition-colors ${vista === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            <List className="w-4 h-4" /> Lista
          </button>
          <button
            type="button"
            onClick={() => set_vista("mappa")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-sm font-medium transition-colors ${vista === "mappa" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            <MapIcon className="w-4 h-4" /> Mappa
          </button>
        </div>
      </div>

      {/* Barra filtri */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => set_search(e.target.value)}
            placeholder="Cerca partner, offerta o località…"
            className="pl-10 pr-10 h-12 rounded-xl text-base"
          />
          {search && (
            <button
              type="button"
              aria-label="Cancella ricerca"
              onClick={() => set_search("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {gruppi_geo.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              <Globe2 className="w-3.5 h-3.5" /> Area geografica
            </p>
            <div className="mb-3">
              <FilterPill attivo={regione_id === null} onClick={() => set_regione_id(null)} count={base.filter((c) => !area_id || c.area_id === area_id).length}>
                Tutte le destinazioni
              </FilterPill>
            </div>
            <div className="space-y-3">
              {gruppi_geo.map((g) => (
                <div key={g.nazione}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1.5">{g.nazione}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.voci.map((v) => (
                      <FilterPill
                        key={v.id}
                        attivo={regione_id === v.id}
                        onClick={() => set_regione_id(regione_id === v.id ? null : v.id)}
                        count={v.count}
                      >
                        {v.nome}
                      </FilterPill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {aree.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Categoria
            </p>
            <div className="flex flex-wrap gap-2">
              <FilterPill attivo={area_id === null} onClick={() => set_area_id(null)} count={base.filter((c) => !regione_id || c.regione_id === regione_id).length}>
                Tutte le categorie
              </FilterPill>
              {aree.map((a) => (
                <FilterPill
                  key={a.id}
                  attivo={area_id === a.id}
                  onClick={() => set_area_id(area_id === a.id ? null : a.id)}
                  count={conteggi_aree.get(a.id) ?? 0}
                >
                  {a.nome}
                </FilterPill>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Riepilogo risultati */}
      {!isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{lista_ordinata.length}</span>
            {lista_ordinata.length === 1 ? " convenzione" : " convenzioni"}
            {filtri_attivi && <> su <span className="tabular-nums">{convenzioni.length}</span></>}
            {nome_area && <> · categoria <span className="text-foreground font-medium">{nome_area}</span></>}
            {nome_regione && <> · area <span className="text-foreground font-medium">{nome_regione}</span></>}
          </p>

          {filtri_attivi && (
            <Button type="button" variant="ghost" size="sm" onClick={reset_filtri} className="gap-1.5">
              <X className="w-4 h-4" /> Azzera filtri
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
              <div className="aspect-[16/9] bg-muted" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-1/2 bg-muted rounded" />
                <div className="h-3 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/3 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : lista_ordinata.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <BadgePercent className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {filtri_attivi ? "Nessun risultato per questi filtri" : "Nessuna convenzione disponibile"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
            {filtri_attivi
              ? "Prova ad allargare la ricerca scegliendo un'altra area geografica o categoria."
              : "Stiamo lavorando a nuove partnership: torna presto a controllare."}
          </p>
          {filtri_attivi && (
            <Button type="button" variant="outline" className="mt-5 gap-1.5" onClick={reset_filtri}>
              <X className="w-4 h-4" /> Azzera filtri
            </Button>
          )}
        </div>
      ) : vista === "mappa" ? (
        <MappaConvenzioni
          elementi={lista_ordinata.map((c) => ({
            ...c,
            provincia: c.convenzioni_province?.nome ?? null,
            citta: c.geo_citta,
            regione: c.convenzioni_regioni?.nome ?? null,
            nazione: c.convenzioni_regioni?.convenzioni_nazioni?.nome ?? null,
          }))}
          on_open={(e) => {
            const trovata = lista_ordinata.find((c) => c.id === e.id) ?? null;
            set_selected(trovata);
          }}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 animate-in fade-in duration-300">
          {lista_ordinata.map((c) => (
            <ConvenzioneCard key={c.id} c={c} on_open={set_selected} />
          ))}
        </div>
      )}

      <DettaglioDialog c={selected} on_close={() => set_selected(null)} />
    </div>
  );
}
