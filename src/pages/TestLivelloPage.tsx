import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, CheckCircle, ArrowLeft, Trash2 } from "lucide-react";

type TestLivello = {
  id: string; club_id: string; stagione_id: string | null; nome: string;
  data: string | null; ora: string | null; luogo: string | null;
  tipo: string; livello_attuale: string | null; livello_accesso: string | null;
  note: string | null; created_at: string;
};

type TestAtleta = {
  id: string; test_id: string; atleta_id: string;
  esito: string; note_istruttore: string | null;
};

type Atleta = {
  id: string; nome: string; cognome: string; attivo: boolean | null;
  livello_attuale: string | null;
  carriera_artistica: string | null; carriera_stile: string | null;
};

const ESITO_OPTIONS = [
  { value: "in_attesa", label: "In attesa", color: "bg-muted text-muted-foreground" },
  { value: "superato", label: "Promosso", color: "bg-green-100 text-green-800" },
  { value: "non_superato", label: "Non promosso", color: "bg-destructive/10 text-destructive" },
];

function next_livello(current: string | null | undefined): string | null {
  if (!current) return null;
  const idx = LIVELLI_PROGRESSIONE.indexOf(current);
  if (idx < 0 || idx >= LIVELLI_PROGRESSIONE.length - 1) return null;
  return LIVELLI_PROGRESSIONE[idx + 1];
}

const TIPO_OPTIONS = [
  { value: "artistica", label: "Artistica" },
  { value: "stile", label: "Stile" },
  { value: "amatori", label: "Amatori" },
];

const LIVELLI_PROGRESSIONE = [
  "Pulcini", "Stellina 1", "Stellina 2", "Stellina 3", "Stellina 4",
  "Interbronzo", "Bronzo", "Interargento", "Argento", "Interoro", "Oro",
];

const empty_form = {
  nome: "", data: "", ora: "", luogo: "", tipo: "artistica",
  livello_attuale: "", livello_accesso: "", note: "",
};

export default function TestLivelloPage() {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const route_params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [view, set_view] = useState<"list" | "detail" | "new">(route_params.id ? "detail" : "list");
  const [selected_test_id, set_selected_test_id] = useState<string | null>(route_params.id ?? null);
  const [form, set_form] = useState({ ...empty_form });

  // Sync URL → state
  useEffect(() => {
    if (route_params.id && route_params.id !== selected_test_id) {
      set_selected_test_id(route_params.id);
      set_view("detail");
    }
    if (!route_params.id && view === "detail") {
      set_view("list");
      set_selected_test_id(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route_params.id]);

  // ─── Queries ──────────────────────────────────────────
  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["test_livello", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_livello")
        .select("*")
        .eq("club_id", club_id!)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TestLivello[];
    },
  });

  const { data: atleti = [] } = useQuery({
    queryKey: ["atleti_test", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atleti")
        .select("id, nome, cognome, attivo, livello_attuale, carriera_artistica, carriera_stile")
        .eq("club_id", club_id!)
        .eq("attivo", true)
        .order("cognome");
      if (error) throw error;
      return (data ?? []) as Atleta[];
    },
  });

  const { data: test_atleti = [], refetch: refetch_atleti } = useQuery({
    queryKey: ["test_livello_atleti", selected_test_id],
    enabled: !!selected_test_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_livello_atleti")
        .select("*")
        .eq("test_id", selected_test_id!);
      if (error) throw error;
      return (data ?? []) as TestAtleta[];
    },
  });

  const selected_test = tests.find((t) => t.id === selected_test_id);

  // ─── Mutations ────────────────────────────────────────
  const create_test = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("test_livello")
        .insert({
          club_id: club_id!,
          nome: form.nome,
          data: form.data || null,
          ora: form.ora || null,
          luogo: form.luogo || null,
          tipo: form.tipo,
          livello_attuale: form.livello_attuale || null,
          livello_accesso: form.livello_accesso || null,
          note: form.note || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["test_livello"] });
      set_selected_test_id(data.id);
      set_view("detail");
      toast.success("Test creato");
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  const delete_test = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("test_livello").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test_livello"] });
      set_view("list");
      toast.success("Test eliminato");
    },
  });

  const add_atleta = useMutation({
    mutationFn: async (atleta_id: string) => {
      const { error } = await supabase
        .from("test_livello_atleti")
        .insert({ test_id: selected_test_id!, atleta_id, esito: "in_attesa" } as any);
      if (error) throw error;
    },
    onSuccess: () => refetch_atleti(),
  });

  const remove_atleta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("test_livello_atleti").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch_atleti(),
  });

  const update_esito = useMutation({
    mutationFn: async ({ id, esito, note_istruttore }: { id: string; esito?: string; note_istruttore?: string }) => {
      const upd: any = {};
      if (esito !== undefined) upd.esito = esito;
      if (note_istruttore !== undefined) upd.note_istruttore = note_istruttore;
      const { error } = await supabase.from("test_livello_atleti").update(upd).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch_atleti(),
  });

  const conferma_esiti = useMutation({
    mutationFn: async () => {
      if (!selected_test) return { promossi: [] as string[] };
      const promossi = test_atleti.filter((ta) => ta.esito === "superato");
      const field =
        selected_test.tipo === "artistica" ? "carriera_artistica" :
        selected_test.tipo === "stile" ? "carriera_stile" : "livello_attuale";
      const carriera_label =
        selected_test.tipo === "amatori" ? "Amatori" :
        selected_test.tipo === "artistica" ? "Artistica" : "Stile";
      const data_test = selected_test.data || new Date().toISOString().split("T")[0];
      const promossi_nomi: string[] = [];

      for (const ta of promossi) {
        const atleta = atleti.find((a) => a.id === ta.atleta_id);
        if (!atleta) continue;
        const livello_attuale =
          selected_test.tipo === "artistica" ? atleta.carriera_artistica :
          selected_test.tipo === "stile" ? atleta.carriera_stile : atleta.livello_attuale;
        // priorità: livello_accesso esplicito del test, altrimenti next nella progressione
        const livello_target = selected_test.livello_accesso || next_livello(livello_attuale);
        if (!livello_target) continue;

        await supabase
          .from("atleti")
          .update({ [field]: livello_target } as any)
          .eq("id", ta.atleta_id);
        await supabase.from("storico_livelli_atleta").insert({
          atleta_id: ta.atleta_id,
          livello: livello_target,
          carriera: carriera_label,
          data_inizio: data_test,
          note: `Promosso al test "${selected_test.nome}"`,
        } as any);
        promossi_nomi.push(`${atleta.cognome} ${atleta.nome} → ${livello_target}`);
      }
      return { promossi: promossi_nomi };
    },
    onSuccess: ({ promossi }) => {
      qc.invalidateQueries({ queryKey: ["atleti_test"] });
      qc.invalidateQueries({ queryKey: ["storico_livelli_atleta"] });
      if (promossi.length === 0) {
        toast.info("Nessuna promozione applicata");
      } else {
        toast.success(`${promossi.length} ${promossi.length === 1 ? "atleta promosso" : "atlete promosse"}`, {
          description: promossi.join(" • "),
          duration: 6000,
        });
      }
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  // ─── Helpers ──────────────────────────────────────────
  const convocati_ids = new Set(test_atleti.map((ta) => ta.atleta_id));
  const atleti_disponibili = atleti.filter((a) => !convocati_ids.has(a.id));

  const get_livello_attuale = (atleta: Atleta) => {
    if (!selected_test) return "";
    if (selected_test.tipo === "artistica") return atleta.carriera_artistica || "-";
    if (selected_test.tipo === "stile") return atleta.carriera_stile || "-";
    return atleta.livello_attuale || "-";
  };

  // ─── Add Athletes Dialog ─────────────────────────────
  const [show_add, set_show_add] = useState(false);

  // ─── LIST VIEW ────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Test di Livello</h1>
          <Button onClick={() => { set_form({ ...empty_form }); set_view("new"); }}>
            <Plus className="w-4 h-4 mr-2" /> Nuovo Test
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : tests.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun test di livello creato</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tests.map((t) => (
              <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/test/${t.id}`)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    {t.nome || "Test senza nome"}
                    <Badge variant="outline" className="capitalize">{t.tipo}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {t.data && <p>📅 {new Date(t.data).toLocaleDateString("it-CH")}</p>}
                  {t.luogo && <p>📍 {t.luogo}</p>}
                  <p>Livello: {t.livello_attuale || "-"} → {t.livello_accesso || "-"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── NEW TEST FORM ────────────────────────────────────
  if (view === "new") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => set_view("list")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Nuovo Test di Livello</h1>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">Nome *</label>
                <Input value={form.nome} onChange={(e) => set_form({ ...form, nome: e.target.value })} placeholder="es. Test Stellina 2" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Tipo *</label>
                <Select value={form.tipo} onValueChange={(v) => set_form({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Data</label>
                <Input type="date" value={form.data} onChange={(e) => set_form({ ...form, data: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Ora</label>
                <Input type="time" value={form.ora} onChange={(e) => set_form({ ...form, ora: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Luogo</label>
                <Input value={form.luogo} onChange={(e) => set_form({ ...form, luogo: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Attuale livello atleta</label>
                <Select value={form.livello_attuale || ""} onValueChange={(v) => set_form({ ...form, livello_attuale: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona livello" /></SelectTrigger>
                  <SelectContent>
                    {LIVELLI_PROGRESSIONE.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Test per accedere al livello</label>
                <Select value={form.livello_accesso || ""} onValueChange={(v) => set_form({ ...form, livello_accesso: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona livello" /></SelectTrigger>
                  <SelectContent>
                    {LIVELLI_PROGRESSIONE.filter((l) => l !== form.livello_attuale).map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Note</label>
              <Textarea value={form.note} onChange={(e) => set_form({ ...form, note: e.target.value })} />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => set_view("list")}>Annulla</Button>
              <Button disabled={!form.nome || create_test.isPending} onClick={() => create_test.mutate()}>
                Crea Test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── DETAIL VIEW ──────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/test")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">{selected_test?.nome}</h1>
        <Badge variant="outline" className="capitalize">{selected_test?.tipo}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="destructive" size="sm" onClick={() => {
            if (window.confirm("Eliminare definitivamente questo test?")) delete_test.mutate(selected_test_id!);
          }}>
            <Trash2 className="w-4 h-4 mr-1" /> Elimina
          </Button>
        </div>
      </div>

      {selected_test && (
        <Card>
          <CardContent className="pt-4 grid gap-2 md:grid-cols-4 text-sm">
            <div><span className="text-muted-foreground">Data:</span> {selected_test.data ? new Date(selected_test.data).toLocaleDateString("it-CH") : "-"}</div>
            <div><span className="text-muted-foreground">Ora:</span> {selected_test.ora?.slice(0, 5) || "-"}</div>
            <div><span className="text-muted-foreground">Luogo:</span> {selected_test.luogo || "-"}</div>
            <div><span className="text-muted-foreground">Livello:</span> {selected_test.livello_attuale} → {selected_test.livello_accesso}</div>
          </CardContent>
        </Card>
      )}

      {/* Athletes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Atleti convocati ({test_atleti.length})</CardTitle>
            <Button size="sm" onClick={() => set_show_add(true)}>
              <Plus className="w-4 h-4 mr-1" /> Aggiungi Atleti
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {test_atleti.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nessun atleta convocato</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atleta</TableHead>
                  <TableHead>Livello attuale</TableHead>
                  <TableHead>Esito</TableHead>
                  <TableHead>Note istruttore</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {test_atleti.map((ta) => {
                  const atleta = atleti.find((a) => a.id === ta.atleta_id);
                  return (
                    <TableRow key={ta.id}>
                      <TableCell className="font-medium">{atleta ? `${atleta.cognome} ${atleta.nome}` : "—"}</TableCell>
                      <TableCell>{atleta ? get_livello_attuale(atleta) : "-"}</TableCell>
                      <TableCell>
                        <Select value={ta.esito} onValueChange={(v) => update_esito.mutate({ id: ta.id, esito: v })}>
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ESITO_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 text-xs"
                          defaultValue={ta.note_istruttore || ""}
                          onBlur={(e) => update_esito.mutate({ id: ta.id, note_istruttore: e.target.value })}
                          placeholder="Note..."
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove_atleta.mutate(ta.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {test_atleti.some((ta) => ta.esito === "superato") && (
            <div className="flex justify-end mt-4">
              <Button onClick={() => conferma_esiti.mutate()} disabled={conferma_esiti.isPending}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Conferma promozioni e aggiorna livelli
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Athletes Dialog */}
      <Dialog open={show_add} onOpenChange={set_show_add}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aggiungi atleti al test</DialogTitle>
          </DialogHeader>
          {atleti_disponibili.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Tutti gli atleti sono già convocati</p>
          ) : (
            <div className="space-y-1">
              {atleti_disponibili.map((a) => (
                <button
                  key={a.id}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted text-sm transition-colors"
                  onClick={() => add_atleta.mutate(a.id)}
                >
                  <span className="font-medium">{a.cognome} {a.nome}</span>
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
