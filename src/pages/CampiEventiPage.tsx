import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_atleti, use_istruttori, use_stagioni, use_corsi, use_gare } from "@/hooks/use-supabase-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tent, MapPin, Calendar as CalendarIcon, Users, Trash2, Plus, Send, FileText, Sparkles, Copy, ChevronRight, Trophy, Award, BookOpen, Mail } from "lucide-react";
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
  return new Date(d + "T00:00:00").toLocaleDateString("it-CH");
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
          Gestisci campi interni con planning dedicato, campi esterni con comunicazioni alle famiglie, report di fine stagione e setup pre-stagione.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
          <TabsTrigger value="interno" className="gap-2"><Tent className="w-4 h-4" /> Campo Interno</TabsTrigger>
          <TabsTrigger value="esterno" className="gap-2"><MapPin className="w-4 h-4" /> Campo Esterno</TabsTrigger>
          <TabsTrigger value="post" className="gap-2"><Award className="w-4 h-4" /> Post Season</TabsTrigger>
          <TabsTrigger value="pre" className="gap-2"><Sparkles className="w-4 h-4" /> Pre Season</TabsTrigger>
        </TabsList>

        <TabsContent value="interno">
          <CampoInternoSection eventi={eventi_interni} />
        </TabsContent>
        <TabsContent value="esterno">
          <CampoEsternoSection eventi={eventi_esterni} />
        </TabsContent>
        <TabsContent value="post">
          <PostSeasonSection />
        </TabsContent>
        <TabsContent value="pre">
          <PreSeasonSection />
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
// POST SEASON: report fine stagione
// ═══════════════════════════════════════════════════════════
const PostSeasonSection = () => {
  const club_id = get_current_club_id();
  const { data: stagioni = [] } = use_stagioni();
  const { data: atleti = [] } = use_atleti();
  const { data: gare = [] } = use_gare();
  const { data: corsi = [] } = use_corsi();
  const stagione_attiva = (stagioni as any[]).find((s) => s.attiva) ?? stagioni[0];
  const [stagione_id, setStagioneId] = useState<string>("");
  const sid = stagione_id || stagione_attiva?.id || "";

  const { data: medaglie = [] } = useQuery({
    queryKey: ["postseason_iscr", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase.from("iscrizioni_gare").select("*, gare_calendario(stagione_id, club_id)");
      return (data ?? []) as any[];
    },
  });

  const stats = useMemo(() => {
    const gare_stagione = (gare as any[]).filter((g) => g.stagione_id === sid);
    const corsi_stagione = (corsi as any[]).filter((c) => c.stagione_id === sid);
    const medaglie_stagione = medaglie.filter((m: any) => m.gare_calendario?.stagione_id === sid && m.gare_calendario?.club_id === club_id);
    const oro = medaglie_stagione.filter((m: any) => m.medaglia === "oro" || m.posizione === 1).length;
    const argento = medaglie_stagione.filter((m: any) => m.medaglia === "argento" || m.posizione === 2).length;
    const bronzo = medaglie_stagione.filter((m: any) => m.medaglia === "bronzo" || m.posizione === 3).length;
    return { atleti: atleti.length, gare: gare_stagione.length, corsi: corsi_stagione.length, oro, argento, bronzo };
  }, [gare, corsi, medaglie, atleti, sid, club_id]);

  const generaReportClub = () => {
    const stag = (stagioni as any[]).find((s) => s.id === sid);
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report Fine Stagione</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#1E2761}h1{color:#1E2761;border-bottom:3px solid #0077B6;padding-bottom:10px}h2{color:#0077B6;margin-top:30px}.kpi{display:inline-block;padding:20px;margin:10px;border:2px solid #0077B6;border-radius:8px;min-width:140px;text-align:center}.kpi .num{font-size:32px;font-weight:bold;color:#1E2761}.kpi .lbl{font-size:12px;color:#666;text-transform:uppercase}</style></head>
<body>
<h1>Report Fine Stagione — ${stag?.nome ?? "—"}</h1>
<p>Periodo: ${fmt_date(stag?.data_inizio)} → ${fmt_date(stag?.data_fine)}</p>
<h2>KPI Generali</h2>
<div class="kpi"><div class="num">${stats.atleti}</div><div class="lbl">Atleti</div></div>
<div class="kpi"><div class="num">${stats.corsi}</div><div class="lbl">Corsi</div></div>
<div class="kpi"><div class="num">${stats.gare}</div><div class="lbl">Gare</div></div>
<h2>Medagliere</h2>
<div class="kpi"><div class="num">🥇 ${stats.oro}</div><div class="lbl">Oro</div></div>
<div class="kpi"><div class="num">🥈 ${stats.argento}</div><div class="lbl">Argento</div></div>
<div class="kpi"><div class="num">🥉 ${stats.bronzo}</div><div class="lbl">Bronzo</div></div>
<p style="margin-top:40px;font-size:11px;color:#999">Generato il ${new Date().toLocaleDateString("it-CH")}</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  };

  const generaReportAtleta = (atleta: any) => {
    const med_atleta = medaglie.filter((m: any) => m.atleta_id === atleta.id && m.gare_calendario?.stagione_id === sid);
    const stag = (stagioni as any[]).find((s) => s.id === sid);
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report ${atleta.nome} ${atleta.cognome}</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#1E2761}h1{color:#1E2761;border-bottom:3px solid #0077B6;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{padding:8px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}</style></head>
<body>
<h1>Report Stagionale</h1>
<h2>${atleta.cognome} ${atleta.nome}</h2>
<p>Stagione: ${stag?.nome ?? "—"}</p>
<p>Livello: ${atleta.carriera_artistica || atleta.carriera_stile || atleta.percorso_amatori || "—"}</p>
<p>Ore pista: ${atleta.ore_pista_stagione ?? 0}</p>
<h3>Gare disputate (${med_atleta.length})</h3>
${med_atleta.length === 0 ? "<p>Nessuna gara</p>" : `<table><thead><tr><th>Gara</th><th>Posizione</th><th>Medaglia</th></tr></thead><tbody>
${med_atleta.map((m: any) => `<tr><td>${(gare as any[]).find((g) => g.id === m.gara_id)?.nome ?? "—"}</td><td>${m.posizione ?? "—"}</td><td>${m.medaglia ?? "—"}</td></tr>`).join("")}
</tbody></table>`}
<p style="margin-top:40px;font-size:11px;color:#999">Generato il ${new Date().toLocaleDateString("it-CH")}</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Report Fine Stagione</CardTitle>
          <CardDescription>Genera report club generali e schede individuali per atleta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label>Stagione:</Label>
            <Select value={sid} onValueChange={setStagioneId}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(stagioni as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4 text-center"><Users className="w-5 h-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{stats.atleti}</p><p className="text-xs text-muted-foreground">Atleti</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><BookOpen className="w-5 h-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{stats.corsi}</p><p className="text-xs text-muted-foreground">Corsi</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><Trophy className="w-5 h-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{stats.gare}</p><p className="text-xs text-muted-foreground">Gare</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl">🥇</p><p className="text-2xl font-bold">{stats.oro}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl">🥈</p><p className="text-2xl font-bold">{stats.argento}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl">🥉</p><p className="text-2xl font-bold">{stats.bronzo}</p></CardContent></Card>
          </div>

          <Button onClick={generaReportClub}><FileText className="w-4 h-4 mr-2" /> Genera Report Club (PDF)</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report individuali</CardTitle>
          <CardDescription>Genera una scheda PDF per ciascun atleta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {(atleti as any[]).map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                <span className="text-sm">{a.cognome} {a.nome}</span>
                <Button size="sm" variant="outline" onClick={() => generaReportAtleta(a)}>
                  <FileText className="w-3 h-3 mr-1" /> PDF
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// PRE SEASON: wizard nuova stagione con copia struttura corsi
// ═══════════════════════════════════════════════════════════
const PreSeasonSection = () => {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const { data: stagioni = [] } = use_stagioni();
  const { data: corsi = [] } = use_corsi();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nome: "", data_inizio: "", data_fine: "", tipo: "Regolare", stagione_origine: "" });
  const [corsi_selezionati, setCorsiSelezionati] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const corsi_origine = (corsi as any[]).filter((c) => c.stagione_id === form.stagione_origine);

  React.useEffect(() => {
    setCorsiSelezionati(new Set(corsi_origine.map((c) => c.id)));
  }, [form.stagione_origine]);

  const esegui = async () => {
    if (!form.nome || !form.data_inizio || !form.data_fine) {
      toast.error("Compila tutti i campi della stagione");
      return;
    }
    setCreating(true);
    try {
      // 1. Crea stagione
      const { data: nuovaStag, error: e1 } = await supabase.from("stagioni").insert({
        club_id, nome: form.nome, data_inizio: form.data_inizio, data_fine: form.data_fine, tipo: form.tipo, attiva: false,
      } as any).select().single();
      if (e1) throw e1;

      // 2. Copia corsi selezionati
      if (corsi_selezionati.size > 0) {
        const da_copiare = corsi_origine.filter((c) => corsi_selezionati.has(c.id));
        const nuovi = da_copiare.map((c) => ({
          club_id,
          stagione_id: nuovaStag.id,
          nome: c.nome,
          tipo: c.tipo,
          categoria: c.categoria,
          giorno: c.giorno,
          ora_inizio: c.ora_inizio,
          ora_fine: c.ora_fine,
          costo_mensile: c.costo_mensile,
          costo_annuale: c.costo_annuale,
          livello_richiesto: c.livello_richiesto,
          usa_ghiaccio: c.usa_ghiaccio,
          attivo: true,
          note: c.note,
        }));
        const { error: e2 } = await supabase.from("corsi").insert(nuovi as any);
        if (e2) throw e2;
      }

      qc.invalidateQueries({ queryKey: ["stagioni"] });
      qc.invalidateQueries({ queryKey: ["corsi"] });
      toast.success(`Pre-stagione creata: ${form.nome} con ${corsi_selezionati.size} corsi copiati`);
      setStep(1);
      setForm({ nome: "", data_inizio: "", data_fine: "", tipo: "Regolare", stagione_origine: "" });
      setCorsiSelezionati(new Set());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre Season — Wizard Nuova Stagione</CardTitle>
        <CardDescription>Configura la prossima stagione copiando la struttura dei corsi dalla stagione precedente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={step >= 1 ? "default" : "outline"}>1. Stagione</Badge>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <Badge variant={step >= 2 ? "default" : "outline"}>2. Copia Corsi</Badge>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <Badge variant={step >= 3 ? "default" : "outline"}>3. Conferma</Badge>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div><Label>Nome stagione</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Es: Stagione 2026/2027" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data inizio</Label><Input type="date" value={form.data_inizio} onChange={(e) => setForm({ ...form, data_inizio: e.target.value })} /></div>
              <div><Label>Data fine</Label><Input type="date" value={form.data_fine} onChange={(e) => setForm({ ...form, data_fine: e.target.value })} /></div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Regolare">Regolare</SelectItem>
                  <SelectItem value="Estiva">Estiva</SelectItem>
                  <SelectItem value="Invernale">Invernale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setStep(2)} disabled={!form.nome || !form.data_inizio || !form.data_fine}>Avanti →</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <Label>Stagione origine (da cui copiare i corsi)</Label>
              <Select value={form.stagione_origine} onValueChange={(v) => setForm({ ...form, stagione_origine: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona stagione" /></SelectTrigger>
                <SelectContent>
                  {(stagioni as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.stagione_origine && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">{corsi_origine.length} corsi disponibili — seleziona quelli da copiare:</p>
                <div className="max-h-72 overflow-y-auto border rounded-md p-2 space-y-1">
                  {corsi_origine.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={corsi_selezionati.has(c.id)}
                        onChange={(e) => {
                          const next = new Set(corsi_selezionati);
                          if (e.target.checked) next.add(c.id); else next.delete(c.id);
                          setCorsiSelezionati(next);
                        }}
                      />
                      <span className="text-sm">{c.nome} {c.giorno && `• ${c.giorno}`} {c.ora_inizio && `• ${c.ora_inizio.slice(0, 5)}`}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Indietro</Button>
              <Button onClick={() => setStep(3)}>Avanti →</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="bg-muted/50 p-4 rounded-md space-y-1 text-sm">
              <p><strong>Nome:</strong> {form.nome}</p>
              <p><strong>Periodo:</strong> {fmt_date(form.data_inizio)} → {fmt_date(form.data_fine)}</p>
              <p><strong>Tipo:</strong> {form.tipo}</p>
              <p><strong>Corsi da copiare:</strong> {corsi_selezionati.size}</p>
            </div>
            <p className="text-xs text-muted-foreground">La stagione sarà creata in stato non attivo. Potrai attivarla dalla pagina Stagioni.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>← Indietro</Button>
              <Button onClick={esegui} disabled={creating}><Copy className="w-4 h-4 mr-2" /> {creating ? "Creazione..." : "Crea pre-stagione"}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CampiEventiPage;
