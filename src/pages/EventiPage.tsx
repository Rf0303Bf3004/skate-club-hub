import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ArrowLeft, Trash2, Sparkles, MapPin, Calendar as CalendarIcon, Clock, Users as UsersIcon, Pencil } from "lucide-react";

type Evento = {
  id: string;
  club_id: string;
  stagione_id: string | null;
  titolo: string;
  descrizione: string | null;
  data: string | null;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string | null;
  tipo: string | null;
  creato_at: string;
};

type Iscrizione = { id: string; evento_id: string; atleta_id: string; stato: string | null; note: string | null };
type Atleta = { id: string; nome: string; cognome: string };

const TIPI = ["Galà", "Saggio", "Esibizione", "Altro"] as const;

const empty_form = {
  titolo: "",
  descrizione: "",
  data: "",
  ora_inizio: "",
  ora_fine: "",
  luogo: "",
  tipo: "Galà" as string,
};

const fmt_date = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("it-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function EventiPage() {
  const club_id = get_current_club_id();
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [show_form, set_show_form] = useState(false);
  const [editing_id, set_editing_id] = useState<string | null>(null);
  const [form, set_form] = useState({ ...empty_form });

  const { data: stagione_corrente } = useQuery({
    queryKey: ["stagione_attiva", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("stagioni")
        .select("id, nome")
        .eq("club_id", club_id!)
        .eq("attiva", true)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: eventi = [], isLoading } = useQuery({
    queryKey: ["eventi_straordinari", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventi_straordinari" as any)
        .select("*")
        .eq("club_id", club_id!)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Evento[];
    },
  });

  const { data: iscrizioni_all = [] } = useQuery({
    queryKey: ["iscrizioni_eventi_all", club_id],
    enabled: !!club_id && eventi.length > 0,
    queryFn: async () => {
      const ids = eventi.map((e) => e.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("iscrizioni_eventi" as any)
        .select("*")
        .in("evento_id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as Iscrizione[];
    },
  });

  const { data: atleti = [] } = useQuery({
    queryKey: ["atleti_eventi", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti")
        .select("id, nome, cognome")
        .eq("club_id", club_id!)
        .order("cognome");
      if (error) throw error;
      return (data ?? []) as Atleta[];
    },
  });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of iscrizioni_all) m.set(i.evento_id, (m.get(i.evento_id) ?? 0) + 1);
    return m;
  }, [iscrizioni_all]);

  const open_new = () => {
    set_editing_id(null);
    set_form({ ...empty_form });
    set_show_form(true);
  };

  const open_edit = (e: Evento) => {
    set_editing_id(e.id);
    set_form({
      titolo: e.titolo ?? "",
      descrizione: e.descrizione ?? "",
      data: e.data ?? "",
      ora_inizio: e.ora_inizio?.slice(0, 5) ?? "",
      ora_fine: e.ora_fine?.slice(0, 5) ?? "",
      luogo: e.luogo ?? "",
      tipo: e.tipo ?? "Galà",
    });
    set_show_form(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        club_id,
        stagione_id: stagione_corrente?.id ?? null,
        titolo: form.titolo,
        descrizione: form.descrizione || null,
        data: form.data || null,
        ora_inizio: form.ora_inizio || null,
        ora_fine: form.ora_fine || null,
        luogo: form.luogo || null,
        tipo: form.tipo || null,
      };
      if (editing_id) {
        const { error } = await supabase.from("eventi_straordinari" as any).update(payload).eq("id", editing_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eventi_straordinari" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_straordinari"] });
      set_show_form(false);
      toast.success(editing_id ? "Evento aggiornato" : "Evento creato");
    },
    onError: (e: any) => toast.error("Errore: " + (e?.message ?? "")),
  });

  const delete_evento = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("iscrizioni_eventi" as any).delete().eq("evento_id", id);
      const { error } = await supabase.from("eventi_straordinari" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventi_straordinari"] });
      navigate("/eventi");
      toast.success("Evento eliminato");
    },
  });

  // ─── DETAIL VIEW ──
  if (params.id) {
    const evento = eventi.find((e) => e.id === params.id);
    const iscrizioni_evento = iscrizioni_all.filter((i) => i.evento_id === params.id);
    const get_atleta = (id: string) => atleti.find((a) => a.id === id);

    if (!evento) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/eventi")}><ArrowLeft className="w-4 h-4 mr-1" /> Torna agli eventi</Button>
          <div className="py-12 text-center text-muted-foreground">Evento non trovato.</div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/eventi")}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-2xl font-bold text-foreground">{evento.titolo}</h1>
          {evento.tipo && <Badge variant="outline">{evento.tipo}</Badge>}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => open_edit(evento)}><Pencil className="w-4 h-4 mr-1" /> Modifica</Button>
            <Button size="sm" variant="destructive" onClick={() => {
              if (window.confirm("Eliminare definitivamente questo evento e tutte le sue iscrizioni?")) delete_evento.mutate(evento.id);
            }}><Trash2 className="w-4 h-4 mr-1" /> Elimina</Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-4 grid gap-3 md:grid-cols-4 text-sm">
            <div><span className="text-muted-foreground">Data:</span> {fmt_date(evento.data)}</div>
            <div><span className="text-muted-foreground">Orario:</span> {evento.ora_inizio?.slice(0, 5) || "—"}{evento.ora_fine ? ` – ${evento.ora_fine.slice(0, 5)}` : ""}</div>
            <div className="md:col-span-2"><span className="text-muted-foreground">Luogo:</span> {evento.luogo || "—"}</div>
            {evento.descrizione && <div className="md:col-span-4 text-muted-foreground whitespace-pre-wrap">{evento.descrizione}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Iscritti ({iscrizioni_evento.length})</CardTitle></CardHeader>
          <CardContent>
            {iscrizioni_evento.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Nessun atleta iscritto a questo evento.</p>
            ) : (
              <div className="divide-y">
                {iscrizioni_evento.map((i) => {
                  const a = get_atleta(i.atleta_id);
                  return (
                    <div key={i.id} className="py-2 flex items-center justify-between text-sm">
                      <span className="font-medium">{a ? `${a.cognome} ${a.nome}` : i.atleta_id.slice(0, 8)}</span>
                      {i.stato && <Badge variant="outline" className="text-[10px]">{i.stato}</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {render_form_dialog()}
      </div>
    );
  }

  // ─── LIST VIEW ──
  function render_form_dialog() {
    return (
      <Dialog open={show_form} onOpenChange={set_show_form}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing_id ? "Modifica evento" : "Nuovo evento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Titolo *</label>
              <Input value={form.titolo} onChange={(e) => set_form({ ...form, titolo: e.target.value })} placeholder="es. Galà di Natale" />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={form.tipo} onValueChange={(v) => set_form({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPI.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Data</label>
                <Input type="date" value={form.data} onChange={(e) => set_form({ ...form, data: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Ora inizio</label>
                <Input type="time" value={form.ora_inizio} onChange={(e) => set_form({ ...form, ora_inizio: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Ora fine</label>
                <Input type="time" value={form.ora_fine} onChange={(e) => set_form({ ...form, ora_fine: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Luogo</label>
              <Input value={form.luogo} onChange={(e) => set_form({ ...form, luogo: e.target.value })} placeholder="es. Pista del Ghiaccio" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrizione</label>
              <Textarea value={form.descrizione} onChange={(e) => set_form({ ...form, descrizione: e.target.value })} rows={3} />
            </div>
            {stagione_corrente && (
              <p className="text-xs text-muted-foreground">Stagione: <strong>{stagione_corrente.nome}</strong></p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_show_form(false)}>Annulla</Button>
            <Button disabled={!form.titolo || save.isPending} onClick={() => save.mutate()}>{editing_id ? "Salva" : "Crea evento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary" /> Eventi e Galà</h1>
          <p className="text-sm text-muted-foreground">Galà, saggi, esibizioni e altri eventi straordinari del club.</p>
        </div>
        <Button onClick={open_new}><Plus className="w-4 h-4 mr-2" /> Nuovo Evento</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>
      ) : eventi.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nessun evento creato</p>
          <p className="text-xs mt-1">Crea il primo evento del club per iniziare.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {eventi.map((e) => (
            <Card key={e.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/eventi/${e.id}`)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">{e.titolo}</span>
                  {e.tipo && <Badge variant="outline" className="shrink-0">{e.tipo}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5" /> {fmt_date(e.data)}</p>
                {(e.ora_inizio || e.ora_fine) && (
                  <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {e.ora_inizio?.slice(0, 5) || "—"}{e.ora_fine ? ` – ${e.ora_fine.slice(0, 5)}` : ""}</p>
                )}
                {e.luogo && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {e.luogo}</p>}
                {e.descrizione && <p className="text-xs line-clamp-2 pt-1">{e.descrizione}</p>}
                <p className="flex items-center gap-1.5 pt-1 text-xs"><UsersIcon className="w-3.5 h-3.5" /> {counts.get(e.id) ?? 0} iscritti</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {render_form_dialog()}
    </div>
  );
}
