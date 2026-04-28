import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_atleti, use_istruttori, use_stagioni } from "@/hooks/use-supabase-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tent, MapPin, Calendar as CalendarIcon, Trash2, Plus, Send, ChevronRight, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";

type EventoCampo = {
  id: string;
  club_id: string;
  stagione_id: string | null;
  nome: string;
  modalita: string;
  data_inizio: string | null;
  data_fine: string | null;
  luogo: string | null;
  descrizione: string | null;
  costo: number | null;
  contatti: string | null;
  note: string | null;
};

type SessioneCampo = {
  id: string;
  evento_campo_id: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  titolo: string;
  istruttore_id: string | null;
  note: string | null;
};

type IscrizioneEvento = {
  id: string;
  evento_campo_id: string;
  atleta_id: string;
  stato: string;
};

const fmt_date = (d: string | null) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const CampiEventiPage = () => {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const [tab, setTab] = useState("interno");

  const { data: eventi = [] } = useQuery({
    queryKey: ["eventi_campi", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventi_campi" as any)
        .select("*")
        .eq("club_id", club_id)
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventoCampo[];
    },
  });

  const eventi_interni = eventi.filter((e) => e.modalita === "interno");
  const eventi_esterni = eventi.filter((e) => e.modalita === "esterno");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <Tent className="w-8 h-8" /> Campi ed Eventi
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestisci campi interni con planning dedicato e campi esterni con comunicazioni alle famiglie.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="interno" className="gap-2"><Tent className="w-4 h-4" /> Campo Interno</TabsTrigger>
          <TabsTrigger value="esterno" className="gap-2"><MapPin className="w-4 h-4" /> Campo Esterno</TabsTrigger>
          <TabsTrigger value="gala" className="gap-2"><Sparkles className="w-4 h-4" /> Galà & Spettacoli</TabsTrigger>
        </TabsList>

        <TabsContent value="interno">
          <CampoInternoSection eventi={eventi_interni} />
        </TabsContent>
        <TabsContent value="esterno">
          <CampoEsternoSection eventi={eventi_esterni} />
        </TabsContent>
        <TabsContent value="gala">
          <GalaSpettacoliSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// CAMPO INTERNO: mini-stagione con planning dedicato
// ═══════════════════════════════════════════════════════════
const CampoInternoSection: React.FC<{ eventi: EventoCampo[] }> = ({ eventi }) => {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const { data: stagioni = [] } = use_stagioni();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EventoCampo | null>(null);
  const [form, setForm] = useState({ nome: "", data_inizio: "", data_fine: "", luogo: "", descrizione: "", costo: "0", stagione_id: "" });

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        club_id,
        nome: form.nome.trim() || "Campo interno",
        modalita: "interno",
        data_inizio: form.data_inizio || null,
        data_fine: form.data_fine || null,
        luogo: form.luogo,
        descrizione: form.descrizione,
        costo: parseFloat(form.costo) || 0,
        stagione_id: form.stagione_id || null,
      };
      const { data, error } = await supabase.from("eventi_campi" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_campi"] });
      toast.success("Campo interno creato");
      setOpen(false);
      setForm({ nome: "", data_inizio: "", data_fine: "", luogo: "", descrizione: "", costo: "0", stagione_id: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventi_campi" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_campi"] });
      toast.success("Eliminato");
      setSelected(null);
    },
  });

  if (selected) {
    return <CampoInternoDettaglio evento={selected} onBack={() => setSelected(null)} onDelete={() => remove.mutate(selected.id)} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Campi Interni</CardTitle>
          <CardDescription>Mini-stagioni temporanee con planning, sessioni, istruttori e iscrizioni atleti.</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nuovo Campo Interno</Button>
      </CardHeader>
      <CardContent>
        {eventi.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nessun campo interno creato.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventi.map((e) => (
              <Card key={e.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelected(e)}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {e.nome}
                    <Badge variant="secondary">Interno</Badge>
                  </CardTitle>
                  <CardDescription>
                    {fmt_date(e.data_inizio)} → {fmt_date(e.data_fine)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {e.luogo && <p className="text-muted-foreground"><MapPin className="w-3 h-3 inline mr-1" />{e.luogo}</p>}
                  {e.costo ? <p className="font-medium">CHF {Number(e.costo).toFixed(2)}</p> : null}
                  <Button variant="ghost" size="sm" className="mt-2 -mx-2"><ChevronRight className="w-4 h-4 ml-auto" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo Campo Interno</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Es: Camp Estivo 2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data inizio</Label><Input type="date" value={form.data_inizio} onChange={(e) => setForm({ ...form, data_inizio: e.target.value })} /></div>
              <div><Label>Data fine</Label><Input type="date" value={form.data_fine} onChange={(e) => setForm({ ...form, data_fine: e.target.value })} /></div>
            </div>
            <div><Label>Luogo</Label><Input value={form.luogo} onChange={(e) => setForm({ ...form, luogo: e.target.value })} /></div>
            <div><Label>Costo (CHF)</Label><Input type="number" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} /></div>
            <div>
              <Label>Stagione di riferimento</Label>
              <Select value={form.stagione_id} onValueChange={(v) => setForm({ ...form, stagione_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  {stagioni.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrizione</Label><Textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Crea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// Dettaglio Campo Interno: planning, iscrizioni
const CampoInternoDettaglio: React.FC<{ evento: EventoCampo; onBack: () => void; onDelete: () => void }> = ({ evento, onBack, onDelete }) => {
  const qc = useQueryClient();
  const { data: istruttori = [] } = use_istruttori();
  const { data: atleti = [] } = use_atleti();

  const { data: sessioni = [] } = useQuery({
    queryKey: ["sessioni_campo", evento.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessioni_campo" as any).select("*").eq("evento_campo_id", evento.id).order("data").order("ora_inizio");
      if (error) throw error;
      return (data ?? []) as SessioneCampo[];
    },
  });

  const { data: iscrizioni = [] } = useQuery({
    queryKey: ["iscrizioni_eventi_campi", evento.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("iscrizioni_eventi_campi" as any).select("*").eq("evento_campo_id", evento.id);
      if (error) throw error;
      return (data ?? []) as IscrizioneEvento[];
    },
  });

  const [openSess, setOpenSess] = useState(false);
  const [sessForm, setSessForm] = useState({ data: "", ora_inizio: "09:00", ora_fine: "11:00", titolo: "", istruttore_id: "", note: "" });

  const addSess = useMutation({
    mutationFn: async () => {
      const payload: any = { ...sessForm, evento_campo_id: evento.id, istruttore_id: sessForm.istruttore_id || null };
      const { error } = await supabase.from("sessioni_campo" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessioni_campo", evento.id] });
      toast.success("Sessione aggiunta");
      setOpenSess(false);
      setSessForm({ data: "", ora_inizio: "09:00", ora_fine: "11:00", titolo: "", istruttore_id: "", note: "" });
    },
  });

  const delSess = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sessioni_campo" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessioni_campo", evento.id] }),
  });

  const toggleIscr = useMutation({
    mutationFn: async ({ atleta_id, iscritto }: { atleta_id: string; iscritto: boolean }) => {
      if (iscritto) {
        const { error } = await supabase.from("iscrizioni_eventi_campi" as any).delete().eq("evento_campo_id", evento.id).eq("atleta_id", atleta_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("iscrizioni_eventi_campi" as any).insert({ evento_campo_id: evento.id, atleta_id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iscrizioni_eventi_campi", evento.id] }),
  });

  const iscritti_ids = new Set(iscrizioni.map((i) => i.atleta_id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={onBack}>← Torna</Button>
          <h2 className="text-2xl font-bold mt-2">{evento.nome}</h2>
          <p className="text-sm text-muted-foreground">{fmt_date(evento.data_inizio)} → {fmt_date(evento.data_fine)} {evento.luogo && `• ${evento.luogo}`}</p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => { if (confirm("Eliminare il campo?")) onDelete(); }}>
          <Trash2 className="w-4 h-4 mr-2" /> Elimina
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Planning sessioni */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle className="text-base">Planning Sessioni</CardTitle><CardDescription>{sessioni.length} sessioni programmate</CardDescription></div>
            <Button size="sm" onClick={() => setOpenSess(true)}><Plus className="w-4 h-4 mr-1" /> Sessione</Button>
          </CardHeader>
          <CardContent>
            {sessioni.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessuna sessione</p>
            ) : (
              <div className="space-y-2">
                {sessioni.map((s) => {
                  const istr = istruttori.find((i: any) => i.id === s.istruttore_id);
                  return (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                      <div className="text-sm">
                        <p className="font-medium">{s.titolo || "Sessione"} • {fmt_date(s.data)}</p>
                        <p className="text-xs text-muted-foreground">{s.ora_inizio?.slice(0, 5)}–{s.ora_fine?.slice(0, 5)} {istr && `• ${istr.nome} ${istr.cognome}`}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => delSess.mutate(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Iscrizioni atleti */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Iscrizioni Atleti</CardTitle>
            <CardDescription>{iscritti_ids.size} iscritti su {atleti.length} atleti</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-1">
              {atleti.map((a: any) => {
                const isc = iscritti_ids.has(a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                    <span className="text-sm">{a.cognome} {a.nome}</span>
                    <Button size="sm" variant={isc ? "default" : "outline"} onClick={() => toggleIscr.mutate({ atleta_id: a.id, iscritto: isc })}>
                      {isc ? "Iscritto" : "Iscrivi"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openSess} onOpenChange={setOpenSess}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuova Sessione</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titolo</Label><Input value={sessForm.titolo} onChange={(e) => setSessForm({ ...sessForm, titolo: e.target.value })} placeholder="Es: Allenamento mattina" /></div>
            <div><Label>Data</Label><Input type="date" value={sessForm.data} onChange={(e) => setSessForm({ ...sessForm, data: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Inizio</Label><Input type="time" value={sessForm.ora_inizio} onChange={(e) => setSessForm({ ...sessForm, ora_inizio: e.target.value })} /></div>
              <div><Label>Fine</Label><Input type="time" value={sessForm.ora_fine} onChange={(e) => setSessForm({ ...sessForm, ora_fine: e.target.value })} /></div>
            </div>
            <div>
              <Label>Istruttore</Label>
              <Select value={sessForm.istruttore_id} onValueChange={(v) => setSessForm({ ...sessForm, istruttore_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent>
                  {istruttori.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nome} {i.cognome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Note</Label><Textarea value={sessForm.note} onChange={(e) => setSessForm({ ...sessForm, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSess(false)}>Annulla</Button>
            <Button onClick={() => addSess.mutate()} disabled={!sessForm.data || addSess.isPending}>Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// CAMPO ESTERNO: scheda info + comunicazione famiglie
// ═══════════════════════════════════════════════════════════
const CampoEsternoSection: React.FC<{ eventi: EventoCampo[] }> = ({ eventi }) => {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", data_inizio: "", data_fine: "", luogo: "", descrizione: "", costo: "0", contatti: "" });

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        club_id,
        nome: form.nome.trim() || "Campo esterno",
        modalita: "esterno",
        data_inizio: form.data_inizio || null,
        data_fine: form.data_fine || null,
        luogo: form.luogo,
        descrizione: form.descrizione,
        costo: parseFloat(form.costo) || 0,
        contatti: form.contatti,
      };
      const { error } = await supabase.from("eventi_campi" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_campi"] });
      toast.success("Campo esterno creato");
      setOpen(false);
      setForm({ nome: "", data_inizio: "", data_fine: "", luogo: "", descrizione: "", costo: "0", contatti: "" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventi_campi" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eventi_campi"] }),
  });

  const inviaComunicazione = useMutation({
    mutationFn: async (e: EventoCampo) => {
      const titolo = `Campo esterno: ${e.nome}`;
      const testo = [
        `Vi informiamo del seguente campo esterno organizzato esternamente al club:`,
        ``,
        `📍 Luogo: ${e.luogo || "—"}`,
        `📅 Date: ${fmt_date(e.data_inizio)} → ${fmt_date(e.data_fine)}`,
        e.costo ? `💰 Costo: CHF ${Number(e.costo).toFixed(2)}` : ``,
        e.contatti ? `📞 Contatti: ${e.contatti}` : ``,
        ``,
        e.descrizione || ``,
      ].filter(Boolean).join("\n");

      const { error } = await supabase.from("comunicazioni").insert({
        club_id,
        titolo,
        testo,
        corpo: testo,
        tipo: "evento",
        tipo_destinatari: "tutti",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Comunicazione creata e inviata a tutte le famiglie"),
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Campi Esterni</CardTitle>
          <CardDescription>Schede informative su campi organizzati da terzi, con comunicazione manuale alle famiglie.</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nuovo Campo Esterno</Button>
      </CardHeader>
      <CardContent>
        {eventi.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nessun campo esterno.</p>
        ) : (
          <div className="space-y-3">
            {eventi.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{e.nome}</h3>
                      <Badge variant="outline">Esterno</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <CalendarIcon className="w-3 h-3 inline mr-1" />{fmt_date(e.data_inizio)} → {fmt_date(e.data_fine)}
                      {e.luogo && <> • <MapPin className="w-3 h-3 inline" /> {e.luogo}</>}
                    </p>
                    {e.descrizione && <p className="text-sm">{e.descrizione}</p>}
                    {e.costo ? <p className="text-sm font-medium">CHF {Number(e.costo).toFixed(2)}</p> : null}
                    {e.contatti && <p className="text-xs text-muted-foreground">📞 {e.contatti}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => inviaComunicazione.mutate(e)}>
                      <Send className="w-4 h-4 mr-1" /> Invia comunicazione famiglie
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Eliminare?")) remove.mutate(e.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo Campo Esterno</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Es: Camp internazionale Milano" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data inizio</Label><Input type="date" value={form.data_inizio} onChange={(e) => setForm({ ...form, data_inizio: e.target.value })} /></div>
              <div><Label>Data fine</Label><Input type="date" value={form.data_fine} onChange={(e) => setForm({ ...form, data_fine: e.target.value })} /></div>
            </div>
            <div><Label>Luogo</Label><Input value={form.luogo} onChange={(e) => setForm({ ...form, luogo: e.target.value })} /></div>
            <div><Label>Costo (CHF)</Label><Input type="number" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} /></div>
            <div><Label>Contatti organizzatore</Label><Input value={form.contatti} onChange={(e) => setForm({ ...form, contatti: e.target.value })} placeholder="Email, telefono o sito" /></div>
            <div><Label>Descrizione</Label><Textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Crea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════
// GALÀ & SPETTACOLI: eventi_straordinari (tipo='gala') + workflow unificato
// ═══════════════════════════════════════════════════════════
type EventoStraordinario = {
  id: string;
  club_id: string;
  stagione_id: string | null;
  titolo: string;
  tipo: string;
  data: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string | null;
  descrizione: string | null;
};

const TIPI_EVENTO = ["gala", "saggio", "spettacolo", "festa", "altro"] as const;
const TIPI_EVENTO_LABEL: Record<string, string> = {
  gala: "Galà",
  saggio: "Saggio",
  spettacolo: "Spettacolo",
  festa: "Festa",
  altro: "Altro",
};

const GalaSpettacoliSection: React.FC = () => {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const { data: stagioni = [] } = use_stagioni();
  const { data: atleti_lista = [] } = use_atleti();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titolo: "",
    tipo_evento: "gala" as string,
    tipo_evento_altro: "",
    data: "",
    ora_inizio: "",
    ora_fine: "",
    luogo: "",
    descrizione: "",
    stagione_id: "",
  });
  const [com_state, set_com_state] = useState<ComunicazioneFormState>(() => empty_comunicazione_state());
  const [com_touched, set_com_touched] = useState(false);

  const corsi_lista_q = useQuery({
    queryKey: ["corsi_attivi_per_com", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corsi")
        .select("id, nome")
        .eq("club_id", club_id)
        .eq("attivo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: eventi = [] } = useQuery({
    queryKey: ["eventi_straordinari_gala", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventi_straordinari")
        .select("*")
        .eq("club_id", club_id)
        .in("tipo", ["gala", "saggio", "spettacolo", "festa", "altro"])
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventoStraordinario[];
    },
  });

  // Auto-sync comunicazione precompilata
  React.useEffect(() => {
    if (com_touched) return;
    set_com_state((p) => ({
      ...p,
      titolo: default_titolo_gala(form.titolo),
      testo: default_testo_gala(form.titolo, form.data, form.ora_inizio || null, form.luogo || null),
    }));
  }, [form.titolo, form.data, form.ora_inizio, form.luogo, com_touched]);

  const handle_com_change = (next: ComunicazioneFormState) => {
    if (next.titolo !== com_state.titolo || next.testo !== com_state.testo) set_com_touched(true);
    set_com_state(next);
  };

  const reset_form = () => {
    setForm({
      titolo: "", tipo_evento: "gala", tipo_evento_altro: "",
      data: "", ora_inizio: "", ora_fine: "", luogo: "", descrizione: "",
      stagione_id: "",
    });
    set_com_state(empty_comunicazione_state());
    set_com_touched(false);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!form.titolo.trim() || !form.data) throw new Error("Titolo e data sono obbligatori");
      const tipo_finale = form.tipo_evento === "altro" && form.tipo_evento_altro.trim()
        ? form.tipo_evento_altro.trim()
        : form.tipo_evento;

      const payload: any = {
        club_id,
        titolo: form.titolo.trim(),
        tipo: tipo_finale,
        data: form.data,
        ora_inizio: form.ora_inizio || null,
        ora_fine: form.ora_fine || null,
        luogo: form.luogo,
        descrizione: form.descrizione,
        stagione_id: form.stagione_id || null,
      };
      const { data: nuovo, error } = await supabase
        .from("eventi_straordinari")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      if (com_state.invia && nuovo) {
        await invia_comunicazione_evento(supabase, {
          club_id: club_id!,
          state: com_state,
          fk: { evento_straordinario_id: (nuovo as any).id },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_straordinari_gala"] });
      qc.invalidateQueries({ queryKey: ["comunicazioni"] });
      toast.success(com_state.invia ? "Evento creato e comunicazione inviata" : "Evento creato");
      setOpen(false);
      reset_form();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventi_straordinari").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_straordinari_gala"] });
      toast.success("Evento eliminato");
    },
  });

  const componi_testo_post = (e: EventoStraordinario) => ({
    titolo: default_titolo_gala(e.titolo),
    testo: default_testo_gala(e.titolo, e.data, e.ora_inizio, e.luogo),
  });

  const invia_comunicazione_post = useMutation({
    mutationFn: async (e: EventoStraordinario) => {
      const { titolo, testo } = componi_testo_post(e);
      const { error } = await supabase.from("comunicazioni").insert({
        club_id,
        titolo,
        testo,
        corpo: testo,
        tipo: "evento",
        tipo_destinatari: "tutti",
        evento_straordinario_id: e.id,
        stato: "inviata",
        inviata_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comunicazioni"] });
      toast.success("Comunicazione inviata alle famiglie");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Galà & Spettacoli</CardTitle>
          <CardDescription>Crea galà, saggi, spettacoli e feste; opzionalmente invia subito una comunicazione collegata alle famiglie.</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nuovo Evento</Button>
      </CardHeader>
      <CardContent>
        {eventi.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nessun evento creato.</p>
        ) : (
          <div className="space-y-3">
            {eventi.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{e.titolo}</h3>
                      <Badge variant="secondary"><Sparkles className="w-3 h-3 mr-1" /> {TIPI_EVENTO_LABEL[e.tipo] ?? e.tipo}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <CalendarIcon className="w-3 h-3 inline mr-1" />{fmt_date(e.data)}
                      {e.ora_inizio && <> • <Clock className="w-3 h-3 inline" /> {e.ora_inizio.slice(0, 5)}{e.ora_fine ? `–${e.ora_fine.slice(0, 5)}` : ""}</>}
                      {e.luogo && <> • <MapPin className="w-3 h-3 inline" /> {e.luogo}</>}
                    </p>
                    {e.descrizione && <p className="text-sm">{e.descrizione}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => invia_comunicazione_post.mutate(e)} disabled={invia_comunicazione_post.isPending}>
                      <Send className="w-4 h-4 mr-1" /> Comunica
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Eliminare l'evento?")) remove.mutate(e.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset_form(); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-xl">
          <DialogHeader><DialogTitle>Nuovo Galà / Spettacolo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titolo *</Label><Input value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} placeholder="Es: Galà di Natale 2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo evento *</Label>
                <Select value={form.tipo_evento} onValueChange={(v) => setForm({ ...form, tipo_evento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPI_EVENTO.map((t) => (
                      <SelectItem key={t} value={t}>{TIPI_EVENTO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.tipo_evento === "altro" && (
                <div>
                  <Label>Specifica tipo *</Label>
                  <Input value={form.tipo_evento_altro} onChange={(e) => setForm({ ...form, tipo_evento_altro: e.target.value })} placeholder="Es: Open day" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Data *</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              <div><Label>Ora inizio</Label><Input type="time" value={form.ora_inizio} onChange={(e) => setForm({ ...form, ora_inizio: e.target.value })} /></div>
              <div><Label>Ora fine</Label><Input type="time" value={form.ora_fine} onChange={(e) => setForm({ ...form, ora_fine: e.target.value })} /></div>
            </div>
            <div><Label>Luogo</Label><Input value={form.luogo} onChange={(e) => setForm({ ...form, luogo: e.target.value })} placeholder="Es: Pista del Resega" /></div>
            <div>
              <Label>Stagione di riferimento</Label>
              <Select value={form.stagione_id} onValueChange={(v) => setForm({ ...form, stagione_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  {stagioni.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrizione</Label><Textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} placeholder="Programma, dress code, info aggiuntive…" /></div>

            <ComunicazioneFormSection
              state={com_state}
              onChange={handle_com_change}
              corsi={(corsi_lista_q.data ?? []).map((c: any) => ({ id: c.id, label: c.nome }))}
              atleti={atleti_lista.map((a: any) => ({
                id: a.id,
                label: `${a.cognome} ${a.nome}`,
                livello: a.carriera_artistica || a.carriera_stile || a.livello_attuale || "Pulcini",
              }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.titolo.trim() || !form.data || (form.tipo_evento === "altro" && !form.tipo_evento_altro.trim())}
            >
              {com_state.invia ? <><Send className="w-4 h-4 mr-1" /> Crea e comunica</> : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CampiEventiPage;

