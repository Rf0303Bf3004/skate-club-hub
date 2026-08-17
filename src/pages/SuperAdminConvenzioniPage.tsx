import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CANTONI_CH } from "@/lib/territori";
import {
  Plus, Pencil, Trash2, ScanLine, Star, Tag, Download,
  Dumbbell, Car, Utensils, HeartPulse, Shirt, Home, Ticket, Plane,
  Coffee, Gift, Briefcase, Sparkles, Music,
} from "lucide-react";
import QRCode from "qrcode";
import { stato_pubblicazione, label_pubblicazione, colore_pubblicazione, stato_validita } from "@/lib/convenzioni-date";
import {
  use_nazioni, use_regioni, use_province,
  crea_nazione, crea_regione, crea_provincia,
} from "@/lib/convenzioni-territori";
import { TerritorioCombobox, StelleSelector } from "@/components/convenzioni/TerritorioCombobox";
import { e_area_alloggio, e_area_ristorazione, TIPI_CUCINA, FASCE_PREZZO } from "@/lib/convenzioni-tipologie";



// ============== Helpers icone lucide dinamiche ==============
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  dumbbell: Dumbbell, car: Car, utensils: Utensils, "heart-pulse": HeartPulse,
  shirt: Shirt, home: Home, ticket: Ticket, plane: Plane,
  coffee: Coffee, gift: Gift, briefcase: Briefcase, sparkles: Sparkles, music: Music,
  tag: Tag,
};
function get_icon(name: string | null | undefined) {
  if (!name) return Tag;
  return ICON_MAP[name.toLowerCase()] ?? Tag;
}

// ============== Tipi ==============
interface Area {
  id: string;
  nome: string;
  icona: string | null;
  ordine: number;
  attiva: boolean;
}
interface TipoProposta {
  id: string;
  nome: string;
  formato: "percentuale" | "importo" | "testo" | null;
  ordine: number;
  attiva: boolean;
}
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

  in_evidenza: boolean;
  stato: string;
  qr_token: string;
  created_at: string;
  tipo_proposta_id: string | null;
  valore_proposta: string | null;
  convenzioni_aree?: { nome: string; icona: string | null } | null;
  convenzioni_tipi_proposta?: { nome: string; formato: string | null } | null;
  convenzioni_regioni?: { id: string; nome: string; nazione_id: string; convenzioni_nazioni?: { nome: string } | null } | null;
  convenzioni_province?: { id: string; nome: string } | null;
}


function format_proposta(formato: string | null | undefined, valore: string | null | undefined): string | null {
  const v = (valore ?? "").trim();
  if (!v) return null;
  if (formato === "percentuale") return `-${v}%`;
  if (formato === "importo") return `-${v} CHF`;
  return v;
}


// ============== Storage helpers (bucket privato → signed URL) ==============
async function upload_file(file: File, prefix: "logos" | "immagini"): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("convenzioni").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

function SignedImage({ path, className, alt }: { path: string | null; className?: string; alt: string }) {
  const [url, set_url] = useState<string | null>(null);
  useEffect(() => {
    let attivo = true;
    if (!path) { set_url(null); return; }
    supabase.storage.from("convenzioni").createSignedUrl(path, 3600).then(({ data }) => {
      if (attivo) set_url(data?.signedUrl ?? null);
    });
    return () => { attivo = false; };
  }, [path]);
  if (!path) return null;
  if (!url) return <div className={`${className} bg-slate-100 animate-pulse`} />;
  return <img src={url} alt={alt} className={className} />;
}

// ============== QR convenzione ==============
function QrConvenzione({ token, azienda }: { token: string; azienda: string }) {
  const [url, set_url] = useState<string | null>(null);
  const target = typeof window !== "undefined" ? `${window.location.origin}/c/${token}` : "";
  useEffect(() => {
    let attivo = true;
    QRCode.toDataURL(target, { width: 256, margin: 1 }).then(u => { if (attivo) set_url(u); });
    return () => { attivo = false; };
  }, [target]);
  const handle_download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${azienda.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "convenzione"}.png`;
    a.click();
  };
  return (
    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
      {url
        ? <img src={url} alt={`QR ${azienda}`} className="w-20 h-20 border border-slate-200 rounded bg-white" />
        : <div className="w-20 h-20 bg-slate-100 animate-pulse rounded" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">Scansiona o condividi il link:</p>
        <p className="text-xs font-mono text-slate-700 truncate">{target}</p>
        <Button size="sm" variant="outline" className="mt-1.5 h-7 text-xs" onClick={handle_download} disabled={!url}>
          <Download className="w-3 h-3 mr-1" /> Scarica QR
        </Button>
      </div>
    </div>
  );
}


// ============== Pagina ==============
export default function SuperAdminConvenzioniPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Convenzioni soci</h1>
        <p className="text-sm text-slate-500 mt-1">Gestione delle convenzioni valide per tutti i club e delle aree di mercato.</p>
      </div>
      <Tabs defaultValue="convenzioni">
        <TabsList>
          <TabsTrigger value="convenzioni">Convenzioni</TabsTrigger>
          <TabsTrigger value="aree">Aree di mercato</TabsTrigger>
          <TabsTrigger value="tipi">Tipi di proposta</TabsTrigger>
          <TabsTrigger value="territori">Nazioni e regioni</TabsTrigger>
        </TabsList>
        <TabsContent value="convenzioni" className="mt-4">
          <TabConvenzioni />
        </TabsContent>
        <TabsContent value="aree" className="mt-4">
          <TabAree />
        </TabsContent>
        <TabsContent value="tipi" className="mt-4">
          <TabTipi />
        </TabsContent>
        <TabsContent value="territori" className="mt-4">
          <TabTerritori />
        </TabsContent>
      </Tabs>


    </div>
  );
}

// ============== Tab Convenzioni ==============
function TabConvenzioni() {
  const qc = useQueryClient();
  const [filtro_search, set_filtro_search] = useState("");
  const [filtro_area, set_filtro_area] = useState<string>("tutte");
  const [filtro_stato, set_filtro_stato] = useState<string>("tutti");
  const [solo_evidenza, set_solo_evidenza] = useState(false);
  const [modal_open, set_modal_open] = useState(false);
  const [editing, set_editing] = useState<Convenzione | null>(null);
  const [delete_target, set_delete_target] = useState<Convenzione | null>(null);
  const [delete_typed, set_delete_typed] = useState("");

  const { data: aree = [] } = useQuery({
    queryKey: ["convenzioni_aree_attive"],
    queryFn: async () => {
      const { data, error } = await supabase.from("convenzioni_aree").select("*").order("ordine");
      if (error) throw error;
      return (data ?? []) as Area[];
    },
  });

  const { data: tipi = [] } = useQuery({
    queryKey: ["convenzioni_tipi_proposta_attivi"],
    queryFn: async () => {
      const { data, error } = await supabase.from("convenzioni_tipi_proposta").select("*").order("ordine");
      if (error) throw error;
      return (data ?? []) as TipoProposta[];
    },
  });

  const { data: convenzioni = [], isLoading } = useQuery({
    queryKey: ["convenzioni_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenzioni")
        .select("*, convenzioni_aree(nome, icona), convenzioni_tipi_proposta(nome, formato), convenzioni_regioni(id, nome, nazione_id, convenzioni_nazioni(nome)), convenzioni_province(id, nome)")
        .order("in_evidenza", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Convenzione[];
    },
  });


  const { data: scan_map = {} } = useQuery({
    queryKey: ["convenzioni_scansioni_count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenzioni_scansioni")
        .select("convenzione_id, atleta_id");
      if (error) throw error;
      const map: Record<string, { aperture: number; soci: number; _set: Set<string> }> = {};
      (data ?? []).forEach((r: any) => {
        if (!r.convenzione_id) return;
        const entry = map[r.convenzione_id] ?? { aperture: 0, soci: 0, _set: new Set<string>() };
        entry.aperture += 1;
        if (r.atleta_id) entry._set.add(r.atleta_id);
        entry.soci = entry._set.size;
        map[r.convenzione_id] = entry;
      });
      return map;
    },
  });

  const mut_delete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("convenzioni").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convenzione eliminata");
      qc.invalidateQueries({ queryKey: ["convenzioni_admin"] });
      set_delete_target(null);
      set_delete_typed("");
    },
    onError: (e: any) => toast.error("Errore eliminazione: " + (e?.message ?? "")),
  });

  const mut_cambio_stato = useMutation({
    mutationFn: async ({ id, stato }: { id: string; stato: string }) => {
      const { error } = await supabase.from("convenzioni").update({ stato }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stato aggiornato");
      qc.invalidateQueries({ queryKey: ["convenzioni_admin"] });
    },
    onError: (e: any) => toast.error("Errore aggiornamento stato: " + (e?.message ?? "")),
  });

  const filtered = useMemo(() => {
    const s = filtro_search.trim().toLowerCase();
    return convenzioni.filter(c => {
      if (s && !((c.azienda ?? "").toLowerCase().includes(s) || (c.titolo ?? "").toLowerCase().includes(s))) return false;
      if (filtro_area !== "tutte" && c.area_id !== filtro_area) return false;
      if (filtro_stato !== "tutti" && c.stato !== filtro_stato) return false;
      if (solo_evidenza && !c.in_evidenza) return false;
      return true;
    });
  }, [convenzioni, filtro_search, filtro_area, filtro_stato, solo_evidenza]);

  const aree_attive = aree.filter(a => a.attiva);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1">
          <Label className="text-xs">Cerca</Label>
          <Input placeholder="Azienda o titolo" value={filtro_search} onChange={e => set_filtro_search(e.target.value)} />
        </div>
        <div className="w-full md:w-48">
          <Label className="text-xs">Area</Label>
          <Select value={filtro_area} onValueChange={set_filtro_area}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutte">Tutte le aree</SelectItem>
              {aree.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-40">
          <Label className="text-xs">Stato</Label>
          <Select value={filtro_stato} onValueChange={set_filtro_stato}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti</SelectItem>
              <SelectItem value="attiva">Attiva</SelectItem>
              <SelectItem value="sospesa">Sospesa</SelectItem>
              <SelectItem value="scaduta">Scaduta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch checked={solo_evidenza} onCheckedChange={set_solo_evidenza} id="ev" />
          <Label htmlFor="ev" className="text-sm">In evidenza</Label>
        </div>
        <Button onClick={() => { set_editing(null); set_modal_open(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nuova convenzione
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-sm text-slate-500">Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-slate-500 p-8 text-center border border-dashed rounded-lg">Nessuna convenzione.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const Icona = get_icon(c.convenzioni_aree?.icona);
            const stato_color =
              c.stato === "attiva" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : c.stato === "sospesa" ? "bg-amber-100 text-amber-700 border-amber-200"
              : "bg-slate-100 text-slate-600 border-slate-200";
            const st_pub = stato_pubblicazione(c);
            const st_val = stato_validita(c);

            return (
              <div key={c.id} className="border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition p-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="w-20 h-20 shrink-0 border border-slate-200 rounded bg-slate-50 flex items-center justify-center overflow-hidden">
                    {c.logo_url
                      ? <SignedImage path={c.logo_url} alt={c.azienda} className="w-full h-full object-contain" />
                      : <span className="text-xl font-bold text-slate-400">{c.azienda.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">{c.azienda}</h3>
                          {(() => {
                            const lbl = format_proposta(c.convenzioni_tipi_proposta?.formato, c.valore_proposta);
                            return lbl ? <Badge className="bg-blue-600 text-white hover:bg-blue-600 shrink-0">{lbl}</Badge> : null;
                          })()}
                        </div>
                        <p className="text-sm text-slate-600 truncate">{c.titolo}</p>
                      </div>
                      {c.in_evidenza && <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {c.convenzioni_aree?.nome && (
                        <Badge variant="outline" className="gap-1">
                          <Icona className="w-3 h-3" />{c.convenzioni_aree.nome}
                        </Badge>
                      )}
                      <Badge variant="outline" className={stato_color}>{c.stato}</Badge>
                      <Badge variant="outline" className={colore_pubblicazione[st_pub]}>
                        {label_pubblicazione[st_pub]}
                      </Badge>
                      {st_val.label && (
                        <Badge variant="outline" className={st_val.tipo === "scaduta"
                          ? "bg-slate-100 text-slate-600 border-slate-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"}>
                          {st_val.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  {(c.geo_citta || c.convenzioni_regioni?.nome || c.geo_cantone) && (
                    <div>{[c.geo_citta, c.convenzioni_regioni?.nome ?? c.geo_cantone, c.convenzioni_regioni?.convenzioni_nazioni?.nome].filter(Boolean).join(" — ")}</div>
                  )}

                  {(c.validita_da || c.validita_a) && (
                    <div>Validità: {c.validita_da ?? "—"} → {c.validita_a ?? "—"}</div>
                  )}
                  {(c.pubblicazione_da || c.pubblicazione_a) && (
                    <div>Pubblicazione: {c.pubblicazione_da ?? "—"} → {c.pubblicazione_a ?? "—"}</div>
                  )}

                  <div className="flex items-center gap-1 pt-1">
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>
                      {(scan_map[c.id]?.aperture ?? 0)} aperture · {(scan_map[c.id]?.soci ?? 0)} soci
                    </span>
                  </div>
                </div>
                <QrConvenzione token={c.qr_token} azienda={c.azienda} />
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" variant="outline" onClick={() => { set_editing(c); set_modal_open(true); }}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Modifica
                  </Button>
                  <Select value={c.stato} onValueChange={(v) => mut_cambio_stato.mutate({ id: c.id, stato: v })}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="attiva">attiva</SelectItem>
                      <SelectItem value="sospesa">sospesa</SelectItem>
                      <SelectItem value="scaduta">scaduta</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="ml-auto text-red-600 hover:text-red-700" onClick={() => { set_delete_target(c); set_delete_typed(""); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConvenzioneFormModal
        open={modal_open}
        onClose={() => set_modal_open(false)}
        editing={editing}
        aree={aree_attive}
        tipi={tipi.filter(t => t.attiva)}

        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["convenzioni_admin"] });
          set_modal_open(false);
        }}
      />

      <Dialog open={!!delete_target} onOpenChange={(o) => { if (!o) { set_delete_target(null); set_delete_typed(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Elimina convenzione</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            Stai per eliminare <strong>{delete_target?.azienda}</strong>. Digita <code>ELIMINA</code> per confermare.
          </p>
          <Input value={delete_typed} onChange={e => set_delete_typed(e.target.value)} placeholder="ELIMINA" />
          <DialogFooter>
            <Button variant="outline" onClick={() => set_delete_target(null)}>Annulla</Button>
            <Button
              variant="destructive"
              disabled={delete_typed !== "ELIMINA" || mut_delete.isPending}
              onClick={() => delete_target && mut_delete.mutate(delete_target.id)}
            >Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============== Modale form convenzione ==============
function ConvenzioneFormModal({
  open, onClose, editing, aree, tipi, onSaved,
}: {
  open: boolean; onClose: () => void; editing: Convenzione | null; aree: Area[]; tipi: TipoProposta[]; onSaved: () => void;
}) {
  const [form, set_form] = useState<Partial<Convenzione>>({});
  const [logo_file, set_logo_file] = useState<File | null>(null);
  const [imm_file, set_imm_file] = useState<File | null>(null);
  const [saving, set_saving] = useState(false);
  const [nazione_sel, set_nazione_sel] = useState<string | null>(null);
  const qc_form = useQueryClient();
  const { data: nazioni = [] } = use_nazioni();
  const { data: regioni = [] } = use_regioni();
  const { data: province = [] } = use_province();

  useEffect(() => {
    if (open) {
      set_form(editing ?? { stato: "attiva", in_evidenza: false });
      set_logo_file(null);
      set_imm_file(null);
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const reg = form.regione_id ? regioni.find(r => r.id === form.regione_id) : null;
    if (reg) set_nazione_sel(reg.nazione_id);
    else if (!form.regione_id && !nazione_sel) set_nazione_sel(null);
  }, [open, form.regione_id, regioni]);

  const handle_crea_nazione = async (nome: string) => {
    try {
      const n = await crea_nazione(nome, nazioni.length + 1);
      await qc_form.invalidateQueries({ queryKey: ["convenzioni_nazioni"] });
      set_nazione_sel(n.id);
      set_form(prev => ({ ...prev, regione_id: null, provincia_id: null }));
      toast.success(`Nazione «${n.nome}» creata`);
      return n.id;
    } catch (e: any) {
      toast.error("Errore creazione nazione: " + (e?.message ?? ""));
      throw e;
    }
  };

  const handle_crea_regione = async (nome: string) => {
    if (!nazione_sel) throw new Error("nazione mancante");
    try {
      const conteggio = regioni.filter(r => r.nazione_id === nazione_sel).length;
      const r = await crea_regione(nazione_sel, nome, conteggio + 1);
      await qc_form.invalidateQueries({ queryKey: ["convenzioni_regioni"] });
      set_form(prev => ({ ...prev, provincia_id: null }));
      toast.success(`Regione «${r.nome}» creata`);
      return r.id;
    } catch (e: any) {
      toast.error("Errore creazione regione: " + (e?.message ?? ""));
      throw e;
    }
  };

  const handle_crea_provincia = async (nome: string) => {
    if (!form.regione_id) throw new Error("regione mancante");
    try {
      const conteggio = province.filter(p => p.regione_id === form.regione_id).length;
      const p = await crea_provincia(form.regione_id, nome, conteggio + 1);
      await qc_form.invalidateQueries({ queryKey: ["convenzioni_province"] });
      toast.success(`Provincia «${p.nome}» creata`);
      return p.id;
    } catch (e: any) {
      toast.error("Errore creazione provincia: " + (e?.message ?? ""));
      throw e;
    }
  };



  const update = (k: keyof Convenzione, v: any) => set_form(prev => ({ ...prev, [k]: v }));

  const area_sel = aree.find(a => a.id === form.area_id) ?? null;
  const mostra_stelle = e_area_alloggio(area_sel?.nome);
  const mostra_ristorante = e_area_ristorazione(area_sel?.nome);

  const tipo_sel = tipi.find(t => t.id === form.tipo_proposta_id) ?? null;
  const formato = tipo_sel?.formato ?? null;
  const valore_placeholder =
    formato === "percentuale" ? "es. 15"
    : formato === "importo" ? "es. 20"
    : "es. Caffè omaggio";
  const valore_suffix =
    formato === "percentuale" ? "%"
    : formato === "importo" ? "CHF"
    : null;

  const handle_save = async () => {
    if (!form.azienda || !form.titolo || !form.area_id) {
      toast.error("Compila azienda, area e titolo");
      return;
    }
    if (form.validita_da && form.validita_a && form.validita_a < form.validita_da) {
      toast.error("La data di fine validità non può precedere quella di inizio");
      return;
    }
    if (form.pubblicazione_da && form.pubblicazione_a && form.pubblicazione_a < form.pubblicazione_da) {
      toast.error("La data di fine pubblicazione non può precedere quella di inizio");
      return;
    }

    set_saving(true);
    try {
      let logo_path = form.logo_url ?? null;
      let imm_path = form.immagine_url ?? null;
      if (logo_file) logo_path = await upload_file(logo_file, "logos");
      if (imm_file) imm_path = await upload_file(imm_file, "immagini");

      const payload = {
        azienda: form.azienda,
        area_id: form.area_id,
        titolo: form.titolo,
        descrizione: form.descrizione ?? null,
        logo_url: logo_path,
        immagine_url: imm_path,
        indirizzo: form.indirizzo ?? null,
        geo_cantone: form.geo_cantone ?? null,
        geo_citta: form.geo_citta ?? null,
        regione_id: form.regione_id ?? null,
        provincia_id: form.provincia_id ?? null,
        stelle: mostra_stelle ? (form.stelle ?? null) : null,
        tipo_cucina: mostra_ristorante ? (form.tipo_cucina || null) : null,
        fascia_prezzo: mostra_ristorante ? (form.fascia_prezzo || null) : null,

        validita_da: form.validita_da || null,
        validita_a: form.validita_a || null,
        pubblicazione_da: form.pubblicazione_da || null,
        pubblicazione_a: form.pubblicazione_a || null,

        codice_sconto: form.codice_sconto ?? null,
        in_evidenza: !!form.in_evidenza,
        stato: form.stato ?? "attiva",
        tipo_proposta_id: form.tipo_proposta_id ?? null,
        valore_proposta: (form.valore_proposta ?? "").toString().trim() || null,
      };


      if (editing) {
        const { error } = await supabase.from("convenzioni").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Convenzione aggiornata");
      } else {
        const { error } = await supabase.from("convenzioni").insert(payload);
        if (error) throw error;
        toast.success("Convenzione creata");
      }
      onSaved();
    } catch (e: any) {
      toast.error("Errore: " + (e?.message ?? ""));
    } finally {
      set_saving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Modifica convenzione" : "Nuova convenzione"}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Azienda *</Label>
            <Input value={form.azienda ?? ""} onChange={e => update("azienda", e.target.value)} />
          </div>
          <div>
            <Label>Area di mercato *</Label>
            <Select value={form.area_id ?? ""} onValueChange={v => update("area_id", v)}>
              <SelectTrigger><SelectValue placeholder="Seleziona area" /></SelectTrigger>
              <SelectContent>
                {aree.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Titolo offerta *</Label>
            <Input value={form.titolo ?? ""} onChange={e => update("titolo", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Descrizione</Label>
            <Textarea rows={3} value={form.descrizione ?? ""} onChange={e => update("descrizione", e.target.value)} />
          </div>

          {/* Logo */}
          <div>
            <Label>Logo</Label>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-20 h-20 border border-slate-200 rounded bg-slate-50 flex items-center justify-center overflow-hidden">
                {logo_file ? (
                  <img src={URL.createObjectURL(logo_file)} alt="" className="w-full h-full object-contain" />
                ) : form.logo_url ? (
                  <SignedImage path={form.logo_url} alt="logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-400">80×80</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Input type="file" accept="image/*" onChange={e => set_logo_file(e.target.files?.[0] ?? null)} />
                {(form.logo_url || logo_file) && (
                  <Button size="sm" variant="ghost" type="button"
                    onClick={() => { set_logo_file(null); update("logo_url", null); }}>
                    Rimuovi
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Immagine banner */}
          <div>
            <Label>Immagine (banner 16:9)</Label>
            <div className="flex flex-col gap-2 mt-1">
              <div className="aspect-video border border-slate-200 rounded bg-slate-50 overflow-hidden">
                {imm_file ? (
                  <img src={URL.createObjectURL(imm_file)} alt="" className="w-full h-full object-cover" />
                ) : form.immagine_url ? (
                  <SignedImage path={form.immagine_url} alt="immagine" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Nessuna immagine</div>
                )}
              </div>
              <Input type="file" accept="image/*" onChange={e => set_imm_file(e.target.files?.[0] ?? null)} />
              {(form.immagine_url || imm_file) && (
                <Button size="sm" variant="ghost" type="button"
                  onClick={() => { set_imm_file(null); update("immagine_url", null); }}>
                  Rimuovi
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label>Tipo di proposta</Label>
            <Select
              value={form.tipo_proposta_id ?? "__none__"}
              onValueChange={v => update("tipo_proposta_id", v === "__none__" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nessuno —</SelectItem>
                {tipi.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valore</Label>
            <div className="relative">
              <Input
                value={form.valore_proposta ?? ""}
                onChange={e => update("valore_proposta", e.target.value)}
                placeholder={valore_placeholder}
                className={valore_suffix ? "pr-12" : ""}
              />
              {valore_suffix && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">{valore_suffix}</span>
              )}
            </div>
          </div>

          {mostra_stelle && (
            <div className="md:col-span-2">
              <Label>Stelle (categoria alberghiera)</Label>
              <StelleSelector value={form.stelle ?? null} on_change={v => update("stelle", v)} />
            </div>
          )}

          {mostra_ristorante && (
            <>
              <div>
                <Label>Tipo di cucina</Label>
                <Select
                  value={form.tipo_cucina ?? "__none__"}
                  onValueChange={v => update("tipo_cucina", v === "__none__" ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nessuno —</SelectItem>
                    {TIPI_CUCINA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fascia di prezzo</Label>
                <Select
                  value={form.fascia_prezzo ?? "__none__"}
                  onValueChange={v => update("fascia_prezzo", v === "__none__" ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nessuna —</SelectItem>
                    {FASCE_PREZZO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <Label>Indirizzo</Label>
            <Input value={form.indirizzo ?? ""} onChange={e => update("indirizzo", e.target.value)} />
          </div>
          <div>
            <Label>Nazione</Label>
            <TerritorioCombobox
              value={nazione_sel}
              options={nazioni.map(n => ({ id: n.id, nome: n.nome }))}
              placeholder="Seleziona o crea nazione"
              on_select={(id) => {
                set_nazione_sel(id);
                set_form(prev => ({ ...prev, regione_id: null, provincia_id: null }));
              }}
              on_create={handle_crea_nazione}
            />
          </div>
          <div>
            <Label>Regione</Label>
            <TerritorioCombobox
              value={form.regione_id ?? null}
              options={regioni.filter(r => r.nazione_id === nazione_sel).map(r => ({ id: r.id, nome: r.nome }))}
              placeholder={nazione_sel ? "Seleziona o crea regione" : "Scegli prima la nazione"}
              disabled={!nazione_sel}
              on_select={(id) => set_form(prev => ({ ...prev, regione_id: id, provincia_id: null }))}
              on_create={handle_crea_regione}
            />
          </div>
          <div>
            <Label>Provincia</Label>
            <TerritorioCombobox
              value={form.provincia_id ?? null}
              options={province.filter(p => p.regione_id === form.regione_id).map(p => ({ id: p.id, nome: p.nome }))}
              placeholder={form.regione_id ? "Seleziona o crea provincia" : "Scegli prima la regione"}
              disabled={!form.regione_id}
              on_select={(id) => update("provincia_id", id)}
              on_create={handle_crea_provincia}
            />
          </div>
          <div>
            <Label>Città</Label>
            <Input value={form.geo_citta ?? ""} onChange={e => update("geo_citta", e.target.value)} />
          </div>
          <div>
            <Label>Cantone (facoltativo)</Label>
            <Select value={form.geo_cantone ?? ""} onValueChange={v => update("geo_cantone", v)}>
              <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
              <SelectContent>
                {CANTONI_CH.map(c => <SelectItem key={c.sigla} value={c.sigla}>{c.sigla} — {c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>


          <div>
            <Label>Validità da</Label>
            <Input type="date" value={form.validita_da ?? ""} onChange={e => update("validita_da", e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">Periodo in cui l'offerta è effettivamente valida (vuoto = sempre valida)</p>
          </div>
          <div>
            <Label>Validità a</Label>
            <Input type="date" value={form.validita_a ?? ""} onChange={e => update("validita_a", e.target.value)} />
          </div>
          <div>
            <Label>Pubblicazione da</Label>
            <Input type="date" value={form.pubblicazione_da ?? ""} onChange={e => update("pubblicazione_da", e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">Periodo in cui la convenzione è visibile ai soci (vuoto = sempre pubblicata)</p>
          </div>
          <div>
            <Label>Pubblicazione a</Label>
            <Input type="date" value={form.pubblicazione_a ?? ""} onChange={e => update("pubblicazione_a", e.target.value)} />
          </div>

          <div>
            <Label>Codice sconto</Label>
            <Input value={form.codice_sconto ?? ""} onChange={e => update("codice_sconto", e.target.value)} />
          </div>
          <div>
            <Label>Stato</Label>
            <Select value={form.stato ?? "attiva"} onValueChange={v => update("stato", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="attiva">attiva</SelectItem>
                <SelectItem value="sospesa">sospesa</SelectItem>
                <SelectItem value="scaduta">scaduta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <Switch checked={!!form.in_evidenza} onCheckedChange={v => update("in_evidenza", v)} id="ev2" />
            <Label htmlFor="ev2">In evidenza</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button onClick={handle_save} disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Tab Aree ==============
function TabAree() {
  const qc = useQueryClient();
  const [modal_open, set_modal_open] = useState(false);
  const [editing, set_editing] = useState<Area | null>(null);

  const { data: aree = [], isLoading } = useQuery({
    queryKey: ["convenzioni_aree_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("convenzioni_aree").select("*").order("ordine");
      if (error) throw error;
      return (data ?? []) as Area[];
    },
  });

  const mut_toggle = useMutation({
    mutationFn: async ({ id, attiva }: { id: string; attiva: boolean }) => {
      const { error } = await supabase.from("convenzioni_aree").update({ attiva }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["convenzioni_aree_all"] }),
    onError: (e: any) => toast.error("Errore: " + (e?.message ?? "")),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { set_editing(null); set_modal_open(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nuova area
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-slate-500">Caricamento…</div>
      ) : (
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Ordine</th>
                <th className="text-left p-3">Icona</th>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Attiva</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {aree.map(a => {
                const Icona = get_icon(a.icona);
                return (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 w-16">{a.ordine}</td>
                    <td className="p-3 w-16"><Icona className="w-4 h-4 text-slate-600" /></td>
                    <td className="p-3 font-medium">{a.nome}</td>
                    <td className="p-3 w-24">
                      <Switch checked={a.attiva} onCheckedChange={(v) => mut_toggle.mutate({ id: a.id, attiva: v })} />
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => { set_editing(a); set_modal_open(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <AreaFormModal
        open={modal_open}
        editing={editing}
        onClose={() => set_modal_open(false)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["convenzioni_aree_all"] }); set_modal_open(false); }}
      />
    </div>
  );
}

function AreaFormModal({
  open, onClose, editing, onSaved,
}: { open: boolean; onClose: () => void; editing: Area | null; onSaved: () => void }) {
  const [form, set_form] = useState<Partial<Area>>({});
  const [saving, set_saving] = useState(false);
  useEffect(() => {
    if (open) set_form(editing ?? { ordine: 0, attiva: true, icona: "tag" });
  }, [open, editing]);

  const update = (k: keyof Area, v: any) => set_form(p => ({ ...p, [k]: v }));
  const Anteprima = get_icon(form.icona ?? "");

  const handle_save = async () => {
    if (!form.nome) { toast.error("Il nome è obbligatorio"); return; }
    set_saving(true);
    try {
      const payload = {
        nome: form.nome,
        icona: form.icona ?? null,
        ordine: form.ordine ?? 0,
        attiva: form.attiva ?? true,
      };
      if (editing) {
        const { error } = await supabase.from("convenzioni_aree").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Area aggiornata");
      } else {
        const { error } = await supabase.from("convenzioni_aree").insert(payload);
        if (error) throw error;
        toast.success("Area creata");
      }
      onSaved();
    } catch (e: any) {
      toast.error("Errore: " + (e?.message ?? ""));
    } finally { set_saving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Modifica area" : "Nuova area"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome ?? ""} onChange={e => update("nome", e.target.value)} />
          </div>
          <div>
            <Label>Icona (lucide)</Label>
            <div className="flex items-center gap-2">
              <Input value={form.icona ?? ""} onChange={e => update("icona", e.target.value)} placeholder="es. dumbbell, car, utensils…" />
              <div className="w-9 h-9 border rounded flex items-center justify-center bg-slate-50">
                <Anteprima className="w-4 h-4 text-slate-700" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Disponibili: dumbbell, car, utensils, heart-pulse, shirt, home, ticket, plane, coffee, gift, briefcase, sparkles, music, tag.
            </p>
          </div>
          <div>
            <Label>Ordine</Label>
            <Input type="number" value={form.ordine ?? 0} onChange={e => update("ordine", parseInt(e.target.value || "0", 10))} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.attiva ?? true} onCheckedChange={v => update("attiva", v)} id="atta" />
            <Label htmlFor="atta">Attiva</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button onClick={handle_save} disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Tab Tipi di proposta ==============
function TabTipi() {
  const qc = useQueryClient();
  const [modal_open, set_modal_open] = useState(false);
  const [editing, set_editing] = useState<TipoProposta | null>(null);

  const { data: tipi = [], isLoading } = useQuery({
    queryKey: ["convenzioni_tipi_proposta_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("convenzioni_tipi_proposta").select("*").order("ordine");
      if (error) throw error;
      return (data ?? []) as TipoProposta[];
    },
  });

  const mut_toggle = useMutation({
    mutationFn: async ({ id, attiva }: { id: string; attiva: boolean }) => {
      const { error } = await supabase.from("convenzioni_tipi_proposta").update({ attiva }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["convenzioni_tipi_proposta_all"] }),
    onError: (e: any) => toast.error("Errore: " + (e?.message ?? "")),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { set_editing(null); set_modal_open(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nuovo tipo
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-slate-500">Caricamento…</div>
      ) : (
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Ordine</th>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Formato</th>
                <th className="text-left p-3">Attiva</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {tipi.map(t => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 w-16">{t.ordine}</td>
                  <td className="p-3 font-medium">{t.nome}</td>
                  <td className="p-3 w-32">
                    <Badge variant="outline">{t.formato ?? "—"}</Badge>
                  </td>
                  <td className="p-3 w-24">
                    <Switch checked={t.attiva} onCheckedChange={(v) => mut_toggle.mutate({ id: t.id, attiva: v })} />
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => { set_editing(t); set_modal_open(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TipoFormModal
        open={modal_open}
        editing={editing}
        onClose={() => set_modal_open(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["convenzioni_tipi_proposta_all"] });
          qc.invalidateQueries({ queryKey: ["convenzioni_tipi_proposta_attivi"] });
          set_modal_open(false);
        }}
      />
    </div>
  );
}

function TipoFormModal({
  open, onClose, editing, onSaved,
}: { open: boolean; onClose: () => void; editing: TipoProposta | null; onSaved: () => void }) {
  const [form, set_form] = useState<Partial<TipoProposta>>({});
  const [saving, set_saving] = useState(false);
  useEffect(() => {
    if (open) set_form(editing ?? { ordine: 0, attiva: true, formato: "testo" });
  }, [open, editing]);

  const update = (k: keyof TipoProposta, v: any) => set_form(p => ({ ...p, [k]: v }));

  const handle_save = async () => {
    if (!form.nome) { toast.error("Il nome è obbligatorio"); return; }
    set_saving(true);
    try {
      const payload = {
        nome: form.nome,
        formato: form.formato ?? null,
        ordine: form.ordine ?? 0,
        attiva: form.attiva ?? true,
      };
      if (editing) {
        const { error } = await supabase.from("convenzioni_tipi_proposta").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Tipo aggiornato");
      } else {
        const { error } = await supabase.from("convenzioni_tipi_proposta").insert(payload);
        if (error) throw error;
        toast.success("Tipo creato");
      }
      onSaved();
    } catch (e: any) {
      toast.error("Errore: " + (e?.message ?? ""));
    } finally { set_saving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Modifica tipo" : "Nuovo tipo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome ?? ""} onChange={e => update("nome", e.target.value)} />
          </div>
          <div>
            <Label>Formato</Label>
            <Select value={form.formato ?? "testo"} onValueChange={v => update("formato", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentuale">percentuale</SelectItem>
                <SelectItem value="importo">importo</SelectItem>
                <SelectItem value="testo">testo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500 mt-1">
              Determina come viene formattato il valore: "-15%", "-20 CHF" oppure testo libero.
            </p>
          </div>
          <div>
            <Label>Ordine</Label>
            <Input type="number" value={form.ordine ?? 0} onChange={e => update("ordine", parseInt(e.target.value || "0", 10))} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.attiva ?? true} onCheckedChange={v => update("attiva", v)} id="attt" />
            <Label htmlFor="attt">Attiva</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button onClick={handle_save} disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============== Tab Territori (nazioni + regioni) ==============
function TabTerritori() {
  const qc = useQueryClient();
  const { data: nazioni = [] } = use_nazioni();
  const { data: regioni = [] } = use_regioni();
  const [nuova_nazione, set_nuova_nazione] = useState("");
  const [nuova_regione, set_nuova_regione] = useState<Record<string, string>>({});

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["convenzioni_nazioni"] });
    qc.invalidateQueries({ queryKey: ["convenzioni_regioni"] });
  };

  const mut_add_nazione = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase
        .from("convenzioni_nazioni")
        .insert({ nome: nome.trim(), ordine: nazioni.length + 1 });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Nazione aggiunta"); set_nuova_nazione(""); refresh(); },
    onError: (e: any) => toast.error("Errore: " + (e?.message ?? "")),
  });

  const mut_add_regione = useMutation({
    mutationFn: async ({ nazione_id, nome }: { nazione_id: string; nome: string }) => {
      const conteggio = regioni.filter(r => r.nazione_id === nazione_id).length;
      const { error } = await supabase
        .from("convenzioni_regioni")
        .insert({ nazione_id, nome: nome.trim(), ordine: conteggio + 1 });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success("Regione aggiunta"); set_nuova_regione(p => ({ ...p, [v.nazione_id]: "" })); refresh(); },
    onError: (e: any) => toast.error("Errore: " + (e?.message ?? "")),
  });

  const mut_del_regione = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("convenzioni_regioni").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regione eliminata"); refresh(); },
    onError: (e: any) => toast.error("Errore: " + (e?.message ?? "")),
  });

  const mut_del_nazione = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("convenzioni_nazioni").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Nazione eliminata"); refresh(); },
    onError: (e: any) => toast.error("Errore: " + (e?.message ?? "")),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-end">
        <div className="flex-1">
          <Label className="text-xs">Nuova nazione</Label>
          <Input
            placeholder="es. Francia"
            value={nuova_nazione}
            onChange={e => set_nuova_nazione(e.target.value)}
          />
        </div>
        <Button
          onClick={() => nuova_nazione.trim() && mut_add_nazione.mutate(nuova_nazione)}
          disabled={!nuova_nazione.trim() || mut_add_nazione.isPending}
        >
          <Plus className="w-4 h-4 mr-1" /> Aggiungi nazione
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nazioni.map(n => {
          const figlie = regioni.filter(r => r.nazione_id === n.id);
          return (
            <div key={n.id} className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{n.nome}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => mut_del_nazione.mutate(n.id)}
                  title="Elimina nazione (rimuove anche le sue regioni)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {figlie.length === 0 && <span className="text-xs text-slate-400">Nessuna regione</span>}
                {figlie.map(r => (
                  <Badge key={r.id} variant="outline" className="gap-1 pr-1">
                    {r.nome}
                    <button
                      type="button"
                      className="p-0.5 rounded hover:bg-red-50 text-red-600"
                      onClick={() => mut_del_regione.mutate(r.id)}
                      aria-label={`Elimina ${r.nome}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  className="h-9"
                  placeholder="Nuova regione"
                  value={nuova_regione[n.id] ?? ""}
                  onChange={e => set_nuova_regione(p => ({ ...p, [n.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const nome = (nuova_regione[n.id] ?? "").trim();
                    if (nome) mut_add_regione.mutate({ nazione_id: n.id, nome });
                  }}
                  disabled={!(nuova_regione[n.id] ?? "").trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
