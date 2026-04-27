import React, { useState, useEffect, useMemo } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ArrowLeft, Trash2, X, CheckCircle } from "lucide-react";
import {
  get_livello_gara,
  TEST_BASE_PASSAGGI,
  TEST_CARRIERA_PASSAGGI,
  get_passaggi_validi_per_atleta,
  apply_esito_propagation,
  type Disciplina,
  type Passaggio,
  type TestAtletaRow,
} from "@/lib/atleta-livello";

// ─── Tipi ───────────────────────────────────────────────────────────────
type TestLivello = {
  id: string;
  club_id: string;
  stagione_id: string | null;
  nome: string;
  data: string | null;
  ora: string | null;
  luogo: string | null;
  tipo: "base" | "in_gara" | string;
  gara_id: string | null;
  club_ospitante: string | null;
  costo_iscrizione: number | null;
  // legacy / deprecated
  livello_attuale: string | null;
  livello_accesso: string | null;
  note: string | null;
  created_at: string;
};

type TestAtleta = TestAtletaRow & {
  note_istruttore: string | null;
};

type Atleta = {
  id: string;
  nome: string;
  cognome: string;
  attivo: boolean | null;
  livello_attuale: string | null;
  carriera_artistica: string | null;
  carriera_stile: string | null;
  categoria: string | null;
  livello_amatori: string | null;
  livello_artistica: string | null;
  livello_stile: string | null;
};

type Gara = {
  id: string;
  nome: string;
  data: string | null;
  ora: string | null;
  luogo: string | null;
  club_ospitante: string | null;
};

const ESITO_OPTIONS: { value: TestAtleta["esito"]; label: string; cls: string }[] = [
  { value: "in_attesa",     label: "In attesa",     cls: "bg-muted text-muted-foreground" },
  { value: "superato",      label: "Superato",      cls: "bg-green-100 text-green-800" },
  { value: "non_superato",  label: "Non superato",  cls: "bg-destructive/10 text-destructive" },
  { value: "non_sostenuto", label: "Non sostenuto", cls: "bg-muted text-muted-foreground italic" },
];

// ─── Form state nuovo test ───────────────────────────────────────────────
type NuovoTestForm = {
  tipo: "base" | "in_gara";
  nome: string;
  data: string;
  ora: string;
  luogo: string;
  club_ospitante: string;
  costo_iscrizione: string;
  gara_id: string;
  note: string;
};

const empty_form: NuovoTestForm = {
  tipo: "base",
  nome: "",
  data: "",
  ora: "",
  luogo: "",
  club_ospitante: "",
  costo_iscrizione: "",
  gara_id: "",
  note: "",
};

// Riepilogo livelli convocate per la card di lista
function summarize_livelli(rows: { livello_target: string; disciplina: string | null }[]): string {
  if (rows.length === 0) return "0 atlete";
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.disciplina ? `${r.livello_target} ${r.disciplina === "artistica" ? "Artistica" : "Stile"}` : r.livello_target;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // unique atleti = rows distinte per ordine=1 idealmente; qui contiamo step totali
  const parts = Array.from(counts.entries()).map(([k, n]) => `${n} ${k}`);
  return parts.join(", ");
}

// ─── Componente principale ──────────────────────────────────────────────
export default function TestLivelloPage() {
  const club_id = get_current_club_id();
  const qc = useQueryClient();
  const route_params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [view, set_view] = useState<"list" | "detail" | "new">(route_params.id ? "detail" : "list");
  const [selected_test_id, set_selected_test_id] = useState<string | null>(route_params.id ?? null);
  const [form, set_form] = useState<NuovoTestForm>({ ...empty_form });

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

  // ─── Queries ────────────────────────────────────────────────────────
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
        .select("id, nome, cognome, attivo, livello_attuale, carriera_artistica, carriera_stile, categoria, livello_amatori, livello_artistica, livello_stile")
        .eq("club_id", club_id!)
        .eq("attivo", true)
        .order("cognome");
      if (error) throw error;
      return (data ?? []) as Atleta[];
    },
  });

  const { data: gare = [] } = useQuery({
    queryKey: ["gare_calendario_test", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("gare_calendario")
        .select("id, nome, data, ora, luogo, club_ospitante")
        .eq("club_id", club_id!)
        .gte("data", today)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Gara[];
    },
  });

  const { data: test_atleti = [], refetch: refetch_atleti } = useQuery({
    queryKey: ["test_livello_atleti", selected_test_id],
    enabled: !!selected_test_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_livello_atleti")
        .select("*")
        .eq("test_id", selected_test_id!)
        .order("ordine", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TestAtleta[];
    },
  });

  // Counters aggregati (totale step) per ogni test in lista
  const { data: counters = {} } = useQuery({
    queryKey: ["test_livello_counters", club_id],
    enabled: !!club_id && tests.length > 0,
    queryFn: async () => {
      const ids = tests.map((t) => t.id);
      if (ids.length === 0) return {} as Record<string, { livello_target: string; disciplina: string | null }[]>;
      const { data, error } = await supabase
        .from("test_livello_atleti")
        .select("test_id, livello_target, disciplina")
        .in("test_id", ids);
      if (error) throw error;
      const map: Record<string, { livello_target: string; disciplina: string | null }[]> = {};
      for (const r of data ?? []) {
        const key = (r as any).test_id as string;
        if (!map[key]) map[key] = [];
        map[key].push({ livello_target: (r as any).livello_target, disciplina: (r as any).disciplina });
      }
      return map;
    },
  });

  const selected_test = tests.find((t) => t.id === selected_test_id);

  // ─── Mutations ──────────────────────────────────────────────────────
  const create_test = useMutation({
    mutationFn: async () => {
      const gara = form.gara_id ? gare.find((g) => g.id === form.gara_id) : null;
      const payload: any = {
        club_id: club_id!,
        nome: form.nome,
        tipo: form.tipo,
        gara_id: form.tipo === "in_gara" ? (form.gara_id || null) : null,
        data: form.tipo === "in_gara" ? (gara?.data ?? null) : (form.data || null),
        ora: form.tipo === "in_gara" ? (gara?.ora ?? null) : (form.ora || null),
        luogo: form.tipo === "in_gara" ? (gara?.luogo ?? null) : (form.luogo || null),
        club_ospitante: form.tipo === "in_gara" ? (gara?.club_ospitante ?? null) : (form.club_ospitante || null),
        costo_iscrizione: form.costo_iscrizione ? Number(form.costo_iscrizione) : null,
        note: form.note || null,
      };
      const { data, error } = await supabase
        .from("test_livello")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["test_livello"] });
      set_selected_test_id(data.id);
      navigate(`/test/${data.id}`);
      toast.success("Test creato");
    },
    onError: (e: any) => toast.error("Errore creazione: " + (e?.message ?? "")),
  });

  const delete_test = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("test_livello_atleti").delete().eq("test_id", id);
      const { error } = await supabase.from("test_livello").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test_livello"] });
      navigate("/test");
      toast.success("Test eliminato");
    },
  });

  const remove_step = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("test_livello_atleti").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetch_atleti(); toast.success("Convocazione rimossa"); },
  });

  const update_field = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TestAtleta> }) => {
      const { error } = await supabase.from("test_livello_atleti").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch_atleti(),
  });

  const handle_change_esito = async (id: string, nuovo: "in_attesa" | "superato" | "non_superato" | "non_sostenuto") => {
    await update_field.mutateAsync({ id, patch: { esito: nuovo } as any });
    await apply_esito_propagation(supabase as any, id, nuovo, test_atleti as TestAtletaRow[]);
    refetch_atleti();
  };

  // ─── Add Athlete Dialog (multitest chain) ────────────────────────────
  const [show_add, set_show_add] = useState(false);
  const [add_atleta_id, set_add_atleta_id] = useState<string>("");
  const [chain, set_chain] = useState<{ accesso: string; target: string; richiede_disciplina: boolean; disciplina: Disciplina | "" }[]>([]);

  // Quando seleziono un atleta, pre-popolo la catena con il primo passaggio valido
  useEffect(() => {
    if (!add_atleta_id) { set_chain([]); return; }
    const atleta = atleti.find((a) => a.id === add_atleta_id);
    if (!atleta) return;
    const passaggi = get_passaggi_validi_per_atleta(atleta as any, "artistica");
    if (passaggi.length === 0) { set_chain([]); return; }
    const p = passaggi[0];
    set_chain([{ accesso: p.accesso, target: p.target, richiede_disciplina: p.richiede_disciplina, disciplina: p.richiede_disciplina ? "artistica" : "" }]);
  }, [add_atleta_id, atleti]);

  useEffect(() => {
    if (!show_add) { set_add_atleta_id(""); set_chain([]); }
  }, [show_add]);

  const all_passaggi = useMemo(() => [...TEST_BASE_PASSAGGI, ...TEST_CARRIERA_PASSAGGI], []);

  const next_passaggio_for_chain = (): Passaggio | null => {
    if (chain.length === 0) return null;
    const last_target = chain[chain.length - 1].target;
    // Per estendere la catena: il prossimo deve avere accesso == last_target.
    // Eccezione: dopo Stellina 4 → Interbronzo, il prossimo dipende dalla disciplina (carriera).
    return all_passaggi.find((p) => p.accesso === last_target) ?? null;
  };

  const add_chain_step = () => {
    const next = next_passaggio_for_chain();
    if (!next) { toast.info("Nessun passaggio successivo disponibile"); return; }
    // Se l'ultimo step aveva una disciplina (artistica/stile), il nuovo step la eredita
    const last_disc = chain[chain.length - 1]?.disciplina;
    set_chain([
      ...chain,
      {
        accesso: next.accesso,
        target: next.target,
        richiede_disciplina: next.richiede_disciplina,
        disciplina: next.richiede_disciplina ? (last_disc || "artistica") : "",
      },
    ]);
  };

  const remove_chain_step = (idx: number) => {
    set_chain(chain.slice(0, idx).concat(chain.slice(idx + 1)));
  };

  // Per il test in_gara, la disciplina è fissata a livello evento (derivata dalla gara o no)
  // Qui niente di automatico: il primo step propone artistica, l'utente può cambiare.

  const submit_add_chain = useMutation({
    mutationFn: async () => {
      if (!add_atleta_id || chain.length === 0 || !selected_test_id) return;
      const rows = chain.map((c, idx) => ({
        test_id: selected_test_id,
        atleta_id: add_atleta_id,
        ordine: idx + 1,
        livello_accesso: c.accesso,
        livello_target: c.target,
        disciplina: c.disciplina || null,
        esito: "in_attesa",
      }));
      const { error } = await supabase.from("test_livello_atleti").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch_atleti();
      set_show_add(false);
      toast.success("Atleta convocata");
    },
    onError: (e: any) => toast.error("Errore: " + (e?.message ?? "")),
  });

  // Atlete già convocate (almeno uno step) per evitare doppia selezione del primo step
  const convocate_ids = new Set(test_atleti.map((ta) => ta.atleta_id));
  const atleti_per_add = atleti.filter((a) => !convocate_ids.has(a.id));

  // Raggruppa per atleta nel dettaglio
  const grouped_chains = useMemo(() => {
    const map = new Map<string, TestAtleta[]>();
    for (const r of test_atleti) {
      const key = r.atleta_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Ordina ogni catena per ordine
    for (const arr of map.values()) arr.sort((a, b) => a.ordine - b.ordine);
    return Array.from(map.entries());
  }, [test_atleti]);

  // ─── LIST VIEW ──────────────────────────────────────────────────────
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
            {tests.map((t) => {
              const rows = counters[t.id] ?? [];
              const n_atleti = new Set(test_atleti.filter((x) => x.test_id === t.id).map((x) => x.atleta_id)).size;
              // se non ho ancora i test_atleti del test corrente, uso la lunghezza dei raw (step) per fallback
              const tipo_label = t.tipo === "in_gara"
                ? (gare.find((g) => g.id === t.gara_id)?.nome ? `Test in ${gare.find((g) => g.id === t.gara_id)?.nome}` : "Test in gara")
                : "Test base";
              return (
                <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/test/${t.id}`)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{t.nome || tipo_label}</span>
                      <Badge variant="outline" className="capitalize ml-2 shrink-0">{t.tipo === "in_gara" ? "in gara" : "base"}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    {t.data && <p>📅 {new Date(t.data).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>}
                    {t.luogo && <p>📍 {t.luogo}{t.club_ospitante ? ` · ${t.club_ospitante}` : ""}</p>}
                    <p className="text-xs">
                      {rows.length === 0
                        ? "Nessuna convocata"
                        : `${new Set(rows.map((_, i) => i)).size > 0 ? rows.length + " step" : ""} · ${summarize_livelli(rows)}`}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── NEW TEST FORM ──────────────────────────────────────────────────
  if (view === "new") {
    const gara_sel = form.gara_id ? gare.find((g) => g.id === form.gara_id) : null;
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
            {/* Step 1: tipo */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Tipo di test *</label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className={`border rounded-md p-3 cursor-pointer transition ${form.tipo === "base" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <input type="radio" name="tipo" className="mr-2" checked={form.tipo === "base"} onChange={() => set_form({ ...form, tipo: "base", gara_id: "" })} />
                  <span className="font-medium">Test base</span>
                  <p className="text-xs text-muted-foreground mt-1">Pulcini → Interbronzo. Organizzato dal club o presso altri club.</p>
                </label>
                <label className={`border rounded-md p-3 cursor-pointer transition ${form.tipo === "in_gara" ? "border-primary bg-primary/5" : "border-input"}`}>
                  <input type="radio" name="tipo" className="mr-2" checked={form.tipo === "in_gara"} onChange={() => set_form({ ...form, tipo: "in_gara" })} />
                  <span className="font-medium">Test in gara</span>
                  <p className="text-xs text-muted-foreground mt-1">Passaggi Artistica/Stile durante una gara ufficiale.</p>
                </label>
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="text-sm font-medium text-foreground">Nome *</label>
              <Input value={form.nome} onChange={(e) => set_form({ ...form, nome: e.target.value })} placeholder="es. Test Stelline marzo" />
            </div>

            {/* Step 2A: base */}
            {form.tipo === "base" && (
              <div className="grid gap-4 md:grid-cols-2">
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
                  <Input value={form.luogo} onChange={(e) => set_form({ ...form, luogo: e.target.value })} placeholder="es. Pista del Ghiaccio - Stella" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Club ospitante</label>
                  <Input value={form.club_ospitante} onChange={(e) => set_form({ ...form, club_ospitante: e.target.value })} placeholder="Stella del Ghiaccio" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Costo iscrizione (CHF)</label>
                  <Input type="number" step="0.01" value={form.costo_iscrizione} onChange={(e) => set_form({ ...form, costo_iscrizione: e.target.value })} />
                </div>
              </div>
            )}

            {/* Step 2B: in_gara */}
            {form.tipo === "in_gara" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground">Gara *</label>
                  <Select value={form.gara_id} onValueChange={(v) => set_form({ ...form, gara_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleziona una gara dal calendario" /></SelectTrigger>
                    <SelectContent>
                      {gare.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nessuna gara futura nel calendario</div>
                      ) : gare.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nome} {g.data ? `· ${new Date(g.data).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {gara_sel && (
                  <div className="md:col-span-2 grid gap-2 md:grid-cols-3 text-sm bg-muted/40 rounded-md p-3">
                    <div><span className="text-muted-foreground">Data:</span> {gara_sel.data ? new Date(gara_sel.data).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}</div>
                    <div><span className="text-muted-foreground">Ora:</span> {gara_sel.ora?.slice(0, 5) || "-"}</div>
                    <div><span className="text-muted-foreground">Luogo:</span> {gara_sel.luogo || "-"}</div>
                    {gara_sel.club_ospitante && <div className="md:col-span-3"><span className="text-muted-foreground">Club ospitante:</span> {gara_sel.club_ospitante}</div>}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground">Costo iscrizione (CHF)</label>
                  <Input type="number" step="0.01" value={form.costo_iscrizione} onChange={(e) => set_form({ ...form, costo_iscrizione: e.target.value })} />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">Note</label>
              <Textarea value={form.note} onChange={(e) => set_form({ ...form, note: e.target.value })} />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => set_view("list")}>Annulla</Button>
              <Button
                disabled={
                  !form.nome ||
                  (form.tipo === "in_gara" && !form.gara_id) ||
                  create_test.isPending
                }
                onClick={() => create_test.mutate()}
              >
                Crea Test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── DETAIL VIEW ────────────────────────────────────────────────────
  if (!selected_test) {
    return (
      <div className="py-12 text-center text-muted-foreground">Test non trovato.</div>
    );
  }

  const gara_link = selected_test.gara_id ? gare.find((g) => g.id === selected_test.gara_id) : null;
  const next_for_dialog = next_passaggio_for_chain();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/test")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">{selected_test.nome}</h1>
        <Badge variant="outline" className="capitalize">{selected_test.tipo === "in_gara" ? "in gara" : "base"}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="destructive" size="sm" onClick={() => {
            if (window.confirm("Eliminare definitivamente questo test e tutte le sue convocazioni?")) delete_test.mutate(selected_test.id);
          }}>
            <Trash2 className="w-4 h-4 mr-1" /> Elimina
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 grid gap-2 md:grid-cols-4 text-sm">
          <div><span className="text-muted-foreground">Data:</span> {selected_test.data ? new Date(selected_test.data).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}</div>
          <div><span className="text-muted-foreground">Ora:</span> {selected_test.ora?.slice(0, 5) || "-"}</div>
          <div><span className="text-muted-foreground">Luogo:</span> {selected_test.luogo || "-"}</div>
          <div><span className="text-muted-foreground">Club:</span> {selected_test.club_ospitante || "-"}</div>
          {gara_link && (
            <div className="md:col-span-4 text-xs text-muted-foreground">
              Test in gara: <strong>{gara_link.nome}</strong>
            </div>
          )}
          {selected_test.costo_iscrizione != null && (
            <div className="md:col-span-4"><span className="text-muted-foreground">Costo iscrizione:</span> CHF {Number(selected_test.costo_iscrizione).toFixed(2)}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Atlete convocate ({grouped_chains.length})</CardTitle>
            <Button size="sm" onClick={() => set_show_add(true)}>
              <Plus className="w-4 h-4 mr-1" /> Convoca Atleta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {grouped_chains.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nessuna atleta convocata</p>
          ) : grouped_chains.map(([atleta_id, chain_rows]) => {
            const atleta = atleti.find((a) => a.id === atleta_id);
            const display_liv = atleta ? get_livello_gara(atleta as any) : "—";
            return (
              <Card key={atleta_id} className="border-l-4 border-l-primary/40">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {atleta ? `${atleta.cognome} ${atleta.nome}` : "—"}
                      <span className="ml-2 text-xs text-muted-foreground">livello attuale: {display_liv}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {chain_rows.map((step, idx) => {
                      const is_first = idx === 0;
                      return (
                        <div key={step.id} className="grid gap-2 md:grid-cols-[auto_1fr_auto_auto_auto] items-center bg-muted/30 rounded-md px-3 py-2 text-sm">
                          <Badge variant="outline" className="font-mono">#{step.ordine}</Badge>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{step.livello_accesso}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{step.livello_target}</span>
                            {step.disciplina && (
                              <Badge variant="secondary" className="text-[10px]">
                                {step.disciplina === "artistica" ? "ART" : "STI"}
                              </Badge>
                            )}
                          </div>
                          <Select
                            value={step.esito}
                            onValueChange={(v) => handle_change_esito(step.id, v as "in_attesa" | "superato" | "non_superato" | "non_sostenuto")}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ESITO_OPTIONS.map((o) => (
                                <SelectItem
                                  key={o.value}
                                  value={o.value}
                                  disabled={o.value === "non_sostenuto" && is_first}
                                >
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-8 text-xs"
                            defaultValue={step.note_istruttore || ""}
                            onBlur={(e) => update_field.mutate({ id: step.id, patch: { note_istruttore: e.target.value } as any })}
                            placeholder="Note istruttore..."
                          />
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => {
                              if (window.confirm(`Rimuovere lo step #${step.ordine} (${step.livello_accesso} → ${step.livello_target})?`)) remove_step.mutate(step.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      {/* ─── Convoca Atleta Dialog ─────────────────────────────────── */}
      <Dialog open={show_add} onOpenChange={set_show_add}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convoca atleta a {selected_test.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Atleta *</label>
              <Select value={add_atleta_id} onValueChange={set_add_atleta_id}>
                <SelectTrigger><SelectValue placeholder="Seleziona un'atleta non convocata" /></SelectTrigger>
                <SelectContent>
                  {atleti_per_add.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Tutte le atlete sono già convocate</div>
                  ) : atleti_per_add.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.cognome} {a.nome} <span className="text-xs text-muted-foreground">· {get_livello_gara(a as any)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {chain.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Catena multitest</label>
                {chain.map((c, idx) => (
                  <div key={idx} className="grid gap-2 md:grid-cols-[auto_1fr_auto_auto] items-center bg-muted/30 rounded-md px-3 py-2 text-sm">
                    <Badge variant="outline" className="font-mono">#{idx + 1}</Badge>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.accesso}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{c.target}</span>
                    </div>
                    {c.richiede_disciplina ? (
                      <Select
                        value={c.disciplina || "artistica"}
                        onValueChange={(v) => {
                          // Aggiorna disciplina di questo step e propaga ai successivi che la richiedono
                          const next = [...chain];
                          for (let i = idx; i < next.length; i++) {
                            if (next[i].richiede_disciplina) next[i] = { ...next[i], disciplina: v as Disciplina };
                          }
                          set_chain(next);
                        }}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="artistica">Artistica</SelectItem>
                          <SelectItem value="stile">Stile</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : <div />}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove_chain_step(idx)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {next_for_dialog && (
                  <Button variant="outline" size="sm" onClick={add_chain_step}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Aggiungi step ({next_for_dialog.accesso} → {next_for_dialog.target})
                  </Button>
                )}
              </div>
            )}

            {add_atleta_id && chain.length === 0 && (
              <p className="text-sm text-muted-foreground">Nessun passaggio valido per questa atleta.</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => set_show_add(false)}>Annulla</Button>
              <Button
                disabled={!add_atleta_id || chain.length === 0 || submit_add_chain.isPending}
                onClick={() => submit_add_chain.mutate()}
              >
                <CheckCircle className="w-4 h-4 mr-1" /> Convoca
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
