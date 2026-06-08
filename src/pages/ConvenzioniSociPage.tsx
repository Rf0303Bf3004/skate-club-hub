import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgePercent, MapPin, Calendar, Ticket, Star, Loader2, Tag } from "lucide-react";
import QRCode from "qrcode";

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
  validita_da: string | null;
  validita_a: string | null;
  codice_sconto: string | null;
  qr_token: string;
  stato: string;
  in_evidenza: boolean;
  tipo_proposta_id: string | null;
  valore_proposta: string | null;
  convenzioni_aree?: Area | null;
  convenzioni_tipi_proposta?: Tipo | null;
}

function format_proposta(formato: string | null | undefined, valore: string | null | undefined): string | null {
  const v = (valore ?? "").trim();
  if (!v) return null;
  if (formato === "percentuale") return `-${v}%`;
  if (formato === "importo") return `-${v} CHF`;
  return v;
}

function in_validita(c: Convenzione): boolean {
  const oggi = new Date().toISOString().slice(0, 10);
  if (c.validita_da && oggi < c.validita_da) return false;
  if (c.validita_a && oggi > c.validita_a) return false;
  return true;
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

const ConvenzioneCard: React.FC<{ c: Convenzione; on_open: (c: Convenzione) => void }> = ({ c, on_open }) => {
  const logo = useSignedUrl(c.logo_url);
  const banner = useSignedUrl(c.immagine_url);
  const lbl = format_proposta(c.convenzioni_tipi_proposta?.formato, c.valore_proposta);
  return (
    <button
      type="button"
      onClick={() => on_open(c)}
      className="text-left bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
    >
      {banner && (
        <div className="aspect-video bg-muted">
          <img src={banner} alt={c.azienda} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4 flex gap-4">
        <div className="w-16 h-16 shrink-0 border border-border rounded-lg bg-muted/40 flex items-center justify-center overflow-hidden">
          {logo
            ? <img src={logo} alt={c.azienda} className="w-full h-full object-contain" />
            : <span className="text-xl font-bold text-muted-foreground">{c.azienda.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-bold text-foreground truncate">{c.azienda}</h3>
            {c.in_evidenza && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0 mt-1" />}
            {lbl && <Badge className="bg-primary text-primary-foreground hover:bg-primary">{lbl}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{c.titolo}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
            {c.convenzioni_aree?.nome && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted">
                <Tag className="w-3 h-3" />{c.convenzioni_aree.nome}
              </span>
            )}
            {(c.geo_citta || c.geo_cantone) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {[c.geo_citta, c.geo_cantone].filter(Boolean).join(" · ")}
              </span>
            )}
            {(c.validita_da || c.validita_a) && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {c.validita_da ?? "—"} → {c.validita_a ?? "—"}
              </span>
            )}
          </div>
        </div>
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
  const [selected, set_selected] = useState<Convenzione | null>(null);

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

  const { data: aree = [] } = useQuery({
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

  const { data: convenzioni = [], isLoading } = useQuery({
    queryKey: ["convenzioni_attive"],
    queryFn: async () => {
      const { data } = await supabase
        .from("convenzioni")
        .select("*, convenzioni_aree(id, nome, icona, ordine, attiva), convenzioni_tipi_proposta(id, nome, formato)")
        .eq("stato", "attiva");
      return ((data ?? []) as unknown as Convenzione[]).filter(in_validita);
    },
  });

  const lista_ordinata = useMemo(() => {
    const filtrate = area_id ? convenzioni.filter((c) => c.area_id === area_id) : convenzioni;
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
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (a.in_evidenza !== b.in_evidenza) return a.in_evidenza ? -1 : 1;
      return a.azienda.localeCompare(b.azienda);
    });
  }, [convenzioni, area_id, club?.citta, club?.cantone]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BadgePercent className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Convenzioni</h1>
          <p className="text-sm text-muted-foreground">Vantaggi riservati ai soci del club</p>
        </div>
      </div>

      {aree.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={area_id === null ? "default" : "outline"}
            onClick={() => set_area_id(null)}
          >
            Tutte
          </Button>
          {aree.map((a) => (
            <Button
              key={a.id}
              type="button"
              size="sm"
              variant={area_id === a.id ? "default" : "outline"}
              onClick={() => set_area_id(a.id)}
            >
              {a.nome}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : lista_ordinata.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <BadgePercent className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nessuna convenzione disponibile al momento.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista_ordinata.map((c) => (
            <ConvenzioneCard key={c.id} c={c} on_open={set_selected} />
          ))}
        </div>
      )}

      <DettaglioDialog c={selected} on_close={() => set_selected(null)} />
    </div>
  );
}
