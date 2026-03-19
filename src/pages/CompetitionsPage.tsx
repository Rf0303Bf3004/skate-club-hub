import React, { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { use_gare, use_atleti, get_atleta_name_from_list } from "@/hooks/use-supabase-data";
import { days_until } from "@/lib/mock-data";
import { use_elimina_gara } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  ArrowLeft,
  MapPin,
  Calendar,
  X,
  Trash2,
  AlertTriangle,
  UserPlus,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const CLUB_ID = "00000000-0000-0000-0000-000000000002";
const LIVELLI = [
  "Pulcini",
  "Stellina 1",
  "Stellina 2",
  "Stellina 3",
  "Stellina 4",
  "Interbronzo",
  "Bronzo",
  "Interargento",
  "Argento",
  "Interoro",
  "Oro",
];
const CARRIERE = ["Artistica", "Stile", "Entrambe"];
const MEDAGLIE = ["", "Oro", "Argento", "Bronzo"];

interface GaraFormData {
  nome: string;
  data: string;
  ora: string;
  localita: string;
  indirizzo: string;
  club_ospitante: string;
  livello_minimo: string;
  carriera: string;
  costo_iscrizione: string;
  costo_accompagnamento: string;
  note: string;
}

const empty_form = (): GaraFormData => ({
  nome: "",
  data: "",
  ora: "",
  localita: "",
  indirizzo: "",
  club_ospitante: "",
  livello_minimo: "Pulcini",
  carriera: "Artistica",
  costo_iscrizione: "0",
  costo_accompagnamento: "0",
  note: "",
});

// ─── Field helper ──────────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);

const MedalBadge: React.FC<{ tipo: string }> = ({ tipo }) => {
  const colors: Record<string, string> = {
    oro: "bg-yellow-100 text-yellow-700",
    argento: "bg-slate-100 text-slate-600",
    bronzo: "bg-orange-100 text-orange-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[tipo] || ""}`}>{tipo}</span>;
};

// ─── Modal nuova gara ──────────────────────────────────────────────────────────
const GaraModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, set_form] = useState<GaraFormData>(empty_form());
  const [saving, set_saving] = useState(false);

  const handle_change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    set_form((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handle_submit = async () => {
    if (!form.nome.trim() || !form.data || !form.localita.trim()) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Nome, data e località sono obbligatori.",
        variant: "destructive",
      });
      return;
    }
    set_saving(true);
    try {
      const { error } = await supabase
        .from("gare_calendario")
        .insert({
          club_id: CLUB_ID,
          nome: form.nome.trim(),
          data: form.data,
          ora: form.ora || null,
          localita: form.localita.trim(),
          indirizzo: form.indirizzo.trim() || null,
          club_ospitante: form.club_ospitante.trim() || null,
          livello_minimo: form.livello_minimo,
          carriera: form.carriera,
          costo_iscrizione: parseFloat(form.costo_iscrizione) || 0,
          costo_accompagnamento: parseFloat(form.costo_accompagnamento) || 0,
          note: form.note.trim() || null,
        })
        .select();
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["gare"] });
      toast({ title: "Gara creata con successo!" });
      onClose();
    } catch (err: any) {
      toast({
        title: "Errore durante il salvataggio",
        description: err?.message ?? "Controlla la console.",
        variant: "destructive",
      });
    } finally {
      set_saving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{t("nuova_gara")}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label={`${t("nome")} *`}>
            <input
              name="nome"
              value={form.nome}
              onChange={handle_change}
              placeholder="es. Trofeo Invernale 2025"
              className="form-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={`${t("data")} *`}>
              <input name="data" type="date" value={form.data} onChange={handle_change} className="form-input" />
            </Field>
            <Field label={t("ora")}>
              <input name="ora" type="time" value={form.ora} onChange={handle_change} className="form-input" />
            </Field>
          </div>
          <Field label={`${t("luogo")} *`}>
            <input
              name="localita"
              value={form.localita}
              onChange={handle_change}
              placeholder="es. Lugano"
              className="form-input"
            />
          </Field>
          <Field label={t("indirizzo")}>
            <input
              name="indirizzo"
              value={form.indirizzo}
              onChange={handle_change}
              placeholder="es. Via Trevano 12, Lugano"
              className="form-input"
            />
          </Field>
          <Field label={t("club_ospitante")}>
            <input
              name="club_ospitante"
              value={form.club_ospitante}
              onChange={handle_change}
              placeholder="es. ASD Ghiaccio Milano"
              className="form-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("livello_minimo")}>
              <select name="livello_minimo" value={form.livello_minimo} onChange={handle_change} className="form-input">
                {LIVELLI.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("carriera")}>
              <select name="carriera" value={form.carriera} onChange={handle_change} className="form-input">
                {CARRIERE.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("costo_iscrizione")}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">CHF </span>
                <input
                  name="costo_iscrizione"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costo_iscrizione}
                  onChange={handle_change}
                  className="form-input pl-7"
                />
              </div>
            </Field>
            <Field label={t("costo_accompagnamento")}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">CHF </span>
                <input
                  name="costo_accompagnamento"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costo_accompagnamento}
                  onChange={handle_change}
                  className="form-input pl-7"
                />
              </div>
            </Field>
          </div>
          <Field label={t("note")}>
            <textarea
              name="note"
              value={form.note}
              onChange={handle_change}
              rows={3}
              placeholder="Note aggiuntive..."
              className="form-input resize-none"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("annulla")}
          </Button>
          <Button onClick={handle_submit} disabled={saving} className="bg-primary hover:bg-primary/90 min-w-[100px]">
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                {t("salvataggio")}…
              </span>
            ) : (
              t("salva")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal iscrizione atleta ───────────────────────────────────────────────────
const IscrizioneModal: React.FC<{
  gara: any;
  atleti: any[];
  atleti_gia_iscritti: string[];
  on_close: () => void;
}> = ({ gara, atleti, atleti_gia_iscritti, on_close }) => {
  const queryClient = useQueryClient();
  const [atleta_id, set_atleta_id] = useState("");
  const [carriera, set_carriera] = useState("Artistica");
  const [saving, set_saving] = useState(false);

  const atleti_disponibili = atleti.filter((a: any) => !atleti_gia_iscritti.includes(a.id) && a.stato === "attivo");

  const handle_submit = async () => {
    if (!atleta_id) {
      toast({ title: "Seleziona un atleta", variant: "destructive" });
      return;
    }
    set_saving(true);
    try {
      const { error } = await supabase.from("iscrizioni_gare").insert({
        atleta_id,
        gara_id: gara.id,
        carriera,
        costo_iscrizione: gara.costo_iscrizione || 0,
        costo_accompagnamento: gara.costo_accompagnamento || 0,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["gare"] });
      toast({ title: "✅ Atleta iscritto alla gara" });
      on_close();
    } catch (err: any) {
      toast({ title: "Errore iscrizione", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Iscrivi atleta</h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label="Atleta *">
            <select
              value={atleta_id}
              onChange={(e) => set_atleta_id(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Seleziona atleta...</option>
              {atleti_disponibili.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.nome} {a.cognome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Carriera">
            <select
              value={carriera}
              onChange={(e) => set_carriera(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {CARRIERE.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={on_close} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={handle_submit} disabled={saving || !atleta_id} className="bg-primary hover:bg-primary/90">
            {saving ? "..." : "Iscrivi"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal risultato atleta ────────────────────────────────────────────────────
const RisultatoModal: React.FC<{
  iscrizione: any;
  atleta_nome: string;
  on_close: () => void;
}> = ({ iscrizione, atleta_nome, on_close }) => {
  const queryClient = useQueryClient();
  const [form, set_form] = useState({
    posizione: iscrizione.posizione ?? "",
    punteggio_tecnico: iscrizione.punteggio_tecnico ?? "",
    punteggio_artistico: iscrizione.punteggio_artistico ?? "",
    voto_giudici: iscrizione.voto_giudici ?? "",
    medaglia: iscrizione.medaglia ?? "",
    note: iscrizione.note ?? "",
  });
  const [saving, set_saving] = useState(false);

  const handle_save = async () => {
    set_saving(true);
    try {
      const { error } = await supabase
        .from("iscrizioni_gare")
        .update({
          posizione: form.posizione !== "" ? Number(form.posizione) : null,
          punteggio_tecnico: form.punteggio_tecnico !== "" ? Number(form.punteggio_tecnico) : null,
          punteggio_artistico: form.punteggio_artistico !== "" ? Number(form.punteggio_artistico) : null,
          voto_giudici: form.voto_giudici !== "" ? Number(form.voto_giudici) : null,
          medaglia: form.medaglia || null,
          note: form.note || null,
        })
        .eq("id", iscrizione.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["gare"] });
      toast({ title: "✅ Risultato salvato" });
      on_close();
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Risultato gara</h2>
            <p className="text-xs text-muted-foreground">{atleta_nome}</p>
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Posizione finale">
              <input
                type="number"
                min="1"
                value={form.posizione}
                onChange={(e) => set_val("posizione", e.target.value)}
                placeholder="es. 3"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
            <Field label="Medaglia">
              <select
                value={form.medaglia}
                onChange={(e) => set_val("medaglia", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Nessuna</option>
                {MEDAGLIE.filter((m) => m).map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Punt. tecnico">
              <input
                type="number"
                step="0.01"
                value={form.punteggio_tecnico}
                onChange={(e) => set_val("punteggio_tecnico", e.target.value)}
                placeholder="es. 24.50"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
            <Field label="Punt. artistico">
              <input
                type="number"
                step="0.01"
                value={form.punteggio_artistico}
                onChange={(e) => set_val("punteggio_artistico", e.target.value)}
                placeholder="es. 26.80"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
          </div>
          <Field label="Voto giudici">
            <input
              type="number"
              step="0.01"
              value={form.voto_giudici}
              onChange={(e) => set_val("voto_giudici", e.target.value)}
              placeholder="es. 5.8"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Note prestazione">
            <textarea
              value={form.note}
              onChange={(e) => set_val("note", e.target.value)}
              rows={2}
              placeholder="Note sulla prestazione..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={on_close} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={handle_save} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? "..." : "💾 Salva risultato"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Grafico andamento atleta ──────────────────────────────────────────────────
const GraficoAndamento: React.FC<{
  atleta_id: string;
  atleta_nome: string;
  gare: any[];
  on_close: () => void;
}> = ({ atleta_id, atleta_nome, gare, on_close }) => {
  const dati = useMemo(() => {
    return gare
      .filter((g) => g.atleti_iscritti?.some((ai: any) => ai.atleta_id === atleta_id))
      .map((g) => {
        const ai = g.atleti_iscritti.find((x: any) => x.atleta_id === atleta_id);
        const pt = ai?.punteggio_tecnico ?? null;
        const pa = ai?.punteggio_artistico ?? null;
        const totale = pt !== null && pa !== null ? pt + pa : (ai?.punteggio ?? null);
        return {
          gara: new Date(g.data + "T00:00:00").toLocaleDateString("it-CH", { day: "2-digit", month: "short" }),
          nome_gara: g.nome,
          punteggio: totale,
          posizione: ai?.posizione ?? null,
          tecnico: pt,
          artistico: pa,
        };
      })
      .filter((d) => d.punteggio !== null || d.posizione !== null)
      .sort((a, b) => a.gara.localeCompare(b.gara));
  }, [atleta_id, gare]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Andamento gare</h2>
            <p className="text-xs text-muted-foreground">{atleta_nome}</p>
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {dati.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Servono almeno 2 gare con risultati per mostrare il grafico.</p>
            </div>
          ) : (
            <>
              {/* Grafico punteggio */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                  📊 Andamento punteggio
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dati}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="gara" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                      labelFormatter={(l, p) => p?.[0]?.payload?.nome_gara || l}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="punteggio"
                      name="Totale"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="tecnico"
                      name="Tecnico"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      strokeDasharray="4 2"
                    />
                    <Line
                      type="monotone"
                      dataKey="artistico"
                      name="Artistico"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      strokeDasharray="4 2"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Grafico posizione */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                  🏆 Andamento posizione (più basso = meglio)
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dati.filter((d) => d.posizione !== null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="gara" tick={{ fontSize: 11 }} />
                    <YAxis reversed tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                      labelFormatter={(l, p) => p?.[0]?.payload?.nome_gara || l}
                      formatter={(v: any) => [`${v}° posto`, "Posizione"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="posizione"
                      name="Posizione"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Tabella riepilogo */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                  Riepilogo risultati
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-3 py-2 font-bold text-muted-foreground">Gara</th>
                        <th className="text-center px-3 py-2 font-bold text-muted-foreground">Pos.</th>
                        <th className="text-center px-3 py-2 font-bold text-muted-foreground">Tecnico</th>
                        <th className="text-center px-3 py-2 font-bold text-muted-foreground">Artistico</th>
                        <th className="text-center px-3 py-2 font-bold text-muted-foreground">Totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dati.map((d, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="px-3 py-2 font-medium text-foreground">{d.nome_gara}</td>
                          <td className="px-3 py-2 text-center">{d.posizione ? `${d.posizione}°` : "—"}</td>
                          <td className="px-3 py-2 text-center">{d.tecnico ?? "—"}</td>
                          <td className="px-3 py-2 text-center">{d.artistico ?? "—"}</td>
                          <td className="px-3 py-2 text-center font-semibold">{d.punteggio ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const CompetitionsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: gare = [], isLoading } = use_gare();
  const { data: atleti = [] } = use_atleti();
  const elimina = use_elimina_gara();
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [show_modal, set_show_modal] = useState(false);
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [show_iscrizione, set_show_iscrizione] = useState(false);
  const [risultato_iscrizione, set_risultato_iscrizione] = useState<any>(null);
  const [grafico_atleta, set_grafico_atleta] = useState<any>(null);

  const selected = gare.find((g: any) => g.id === selected_id);

  const handle_delete = async () => {
    if (!selected_id) return;
    try {
      await elimina.mutateAsync(selected_id);
      set_selected_id(null);
      set_confirm_delete(false);
      toast({ title: "🗑️ Gara eliminata correttamente" });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (selected) {
    return (
      <>
        {show_iscrizione && (
          <IscrizioneModal
            gara={selected}
            atleti={atleti}
            atleti_gia_iscritti={selected.atleti_iscritti?.map((ai: any) => ai.atleta_id) || []}
            on_close={() => set_show_iscrizione(false)}
          />
        )}
        {risultato_iscrizione && (
          <RisultatoModal
            iscrizione={risultato_iscrizione}
            atleta_nome={get_atleta_name_from_list(atleti, risultato_iscrizione.atleta_id)}
            on_close={() => set_risultato_iscrizione(null)}
          />
        )}
        {grafico_atleta && (
          <GraficoAndamento
            atleta_id={grafico_atleta.atleta_id}
            atleta_nome={get_atleta_name_from_list(atleti, grafico_atleta.atleta_id)}
            gare={gare}
            on_close={() => set_grafico_atleta(null)}
          />
        )}

        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                set_selected_id(null);
                set_confirm_delete(false);
              }}
              className="text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> {t("gare")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set_confirm_delete(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Elimina gara
            </Button>
          </div>

          {confirm_delete && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm font-semibold text-destructive">Conferma eliminazione</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Stai per eliminare <strong>{selected.nome}</strong> e tutte le iscrizioni collegate. Operazione
                irreversibile.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => set_confirm_delete(false)} className="flex-1">
                  Annulla
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handle_delete}
                  disabled={elimina.isPending}
                  className="flex-1"
                >
                  {elimina.isPending ? "..." : "🗑️ Elimina definitivamente"}
                </Button>
              </div>
            </div>
          )}

          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{selected.nome}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {new Date(selected.data + "T00:00:00").toLocaleDateString("it-CH")}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {selected.localita}
              </span>
            </div>
          </div>

          <Tabs defaultValue="atleti">
            <TabsList>
              <TabsTrigger value="atleti">
                {t("atleti_iscritti")} ({selected.atleti_iscritti?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="dettagli">{t("dettagli")}</TabsTrigger>
            </TabsList>

            <TabsContent value="atleti" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => set_show_iscrizione(true)} className="bg-primary hover:bg-primary/90 gap-2">
                  <UserPlus className="w-4 h-4" /> Iscrivi atleta
                </Button>
              </div>

              {selected.atleti_iscritti?.length === 0 ? (
                <div className="bg-card rounded-xl shadow-card p-8 text-center text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nessun atleta iscritto. Clicca "Iscrivi atleta" per aggiungere.</p>
                </div>
              ) : (
                <div className="bg-card rounded-xl shadow-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Nome
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                          Pos.
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                          Tecnico
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                          Artistico
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                          Voto
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Medaglia
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.atleti_iscritti.map((ai: any) => (
                        <tr
                          key={ai.atleta_id}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {get_atleta_name_from_list(atleti, ai.atleta_id)}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-muted-foreground hidden sm:table-cell">
                            {ai.posizione ? `${ai.posizione}°` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-muted-foreground hidden md:table-cell">
                            {ai.punteggio_tecnico ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-muted-foreground hidden md:table-cell">
                            {ai.punteggio_artistico ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-muted-foreground hidden sm:table-cell">
                            {ai.voto_giudici ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {ai.medaglia ? <MedalBadge tipo={ai.medaglia} /> : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => set_risultato_iscrizione(ai)}
                                className="h-7 text-xs"
                              >
                                ✏️ Risultato
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => set_grafico_atleta(ai)}
                                className="h-7 text-xs text-primary"
                              >
                                📈 Trend
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="dettagli" className="mt-6">
              <div className="bg-card rounded-xl shadow-card p-6 space-y-3 max-w-lg">
                <InfoRow label={t("club_ospitante")} value={selected.club_ospitante || "—"} />
                <InfoRow label={t("livello_minimo")} value={t(selected.livello_minimo)} />
                <InfoRow label={t("carriera")} value={selected.carriera} />
                <InfoRow label={t("costo_iscrizione")} value={`CHF ${selected.costo_iscrizione}`} />
                <InfoRow label={t("costo_accompagnamento")} value={`CHF ${selected.costo_accompagnamento}`} />
                {selected.note && <InfoRow label={t("note")} value={selected.note} />}
              </div>
              {selected.indirizzo && (
                <div className="mt-6 max-w-lg space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {t("indirizzo")}
                  </p>
                  <p className="text-sm text-foreground mb-3">{selected.indirizzo}</p>
                  <div className="rounded-xl overflow-hidden border border-border shadow-card" style={{ height: 260 }}>
                    <iframe
                      title="mappa"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(selected.indirizzo)}&output=embed`}
                    />
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.indirizzo)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    Apri in Google Maps →
                  </a>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </>
    );
  }

  return (
    <>
      {show_modal && <GaraModal onClose={() => set_show_modal(false)} />}
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("gare")}</h1>
          <Button onClick={() => set_show_modal(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" /> {t("nuova_gara")}
          </Button>
        </div>
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("nome")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("data")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t("luogo")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    {t("livello_minimo")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("iscritti")}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    {t("costo_iscrizione")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {gare.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Nessuna gara ancora. Clicca "Nuova Gara" per aggiungerne una.
                    </td>
                  </tr>
                ) : (
                  gare.map((g: any) => {
                    const d = days_until(g.data);
                    return (
                      <tr
                        key={g.id}
                        onClick={() => set_selected_id(g.id)}
                        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{g.nome}</p>
                          {d > 0 && <p className="text-xs text-accent">{t("countdown_giorni", String(d))}</p>}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {new Date(g.data + "T00:00:00").toLocaleDateString("it-CH")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{g.localita}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Badge variant="secondary" className="text-xs">
                            {t(g.livello_minimo)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums font-medium text-foreground">
                          {g.atleti_iscritti?.length ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                          CHF {g.costo_iscrizione}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default CompetitionsPage;
