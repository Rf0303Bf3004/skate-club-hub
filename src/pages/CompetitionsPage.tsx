import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { use_gare, use_atleti, get_atleta_name_from_list } from "@/hooks/use-supabase-data";
import { days_until } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ArrowLeft, MapPin, Calendar, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const CLUB_ID = "00000000-0000-0000-0000-000000000002";

const LIVELLI = ["Pulcini", "Stellina 1", "Stellina 2", "Interbronzo", "Bronzo", "Argento", "Oro"];
const CARRIERE = ["Artistica", "Stile", "Entrambe"];

interface GaraFormData {
  nome: string;
  data: string;
  localita: string;
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
  localita: "",
  club_ospitante: "",
  livello_minimo: "Pulcini",
  carriera: "Artistica",
  costo_iscrizione: "0",
  costo_accompagnamento: "0",
  note: "",
});

// ─── Modal Form ────────────────────────────────────────────────────────────────
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
          localita: form.localita.trim(),
          club_ospitante: form.club_ospitante.trim() || null,
          livello_minimo: form.livello_minimo,
          carriera: form.carriera.trim() || null,
          costo_iscrizione: parseFloat(form.costo_iscrizione) || 0,
          costo_accompagnamento: parseFloat(form.costo_accompagnamento) || 0,
          note: form.note.trim() || null,
        })
        .select();

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["gare_calendario"] });
      toast({ title: "Gara creata con successo!" });
      onClose();
    } catch (err: any) {
      console.error("Errore salvataggio gara:", err);
      toast({
        title: "Errore durante il salvataggio",
        description: err?.message ?? "Controlla la console per i dettagli.",
        variant: "destructive",
      });
    } finally {
      set_saving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{t("nuova_gara")}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
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
            <Field label={`${t("luogo")} *`}>
              <input
                name="localita"
                value={form.localita}
                onChange={handle_change}
                placeholder="es. Milano"
                className="form-input"
              />
            </Field>
          </div>

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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
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

        {/* Footer */}
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

// ─── Helper components ─────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
const CompetitionsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: gare = [], isLoading } = use_gare();
  const { data: atleti = [] } = use_atleti();
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [show_modal, set_show_modal] = useState(false);

  const selected = gare.find((g: any) => g.id === selected_id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => set_selected_id(null)} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("gare")}
        </Button>
        <div className="flex items-start gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{selected.nome}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {new Date(selected.data).toLocaleDateString("it-CH")}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {selected.localita}
              </span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="dettagli">
          <TabsList>
            <TabsTrigger value="dettagli">{t("dettagli")}</TabsTrigger>
            <TabsTrigger value="atleti">{t("atleti_iscritti")}</TabsTrigger>
          </TabsList>
          <TabsContent value="dettagli" className="mt-6">
            <div className="bg-card rounded-xl shadow-card p-6 space-y-3 max-w-lg">
              <InfoRow label={t("club_ospitante")} value={selected.club_ospitante} />
              <InfoRow label={t("livello_minimo")} value={t(selected.livello_minimo)} />
              <InfoRow label={t("carriera")} value={selected.carriera} />
              <InfoRow label={t("costo_iscrizione")} value={`€${selected.costo_iscrizione}`} />
              <InfoRow label={t("costo_accompagnamento")} value={`€${selected.costo_accompagnamento}`} />
              {selected.note && <InfoRow label={t("note")} value={selected.note} />}
            </div>
          </TabsContent>
          <TabsContent value="atleti" className="mt-6">
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("nome")}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("punteggio")}
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("posizione")}
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("medaglia")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.atleti_iscritti.map((ai: any) => (
                    <tr key={ai.atleta_id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {get_atleta_name_from_list(atleti, ai.atleta_id)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{ai.punteggio ?? "—"}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        {ai.posizione ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">{ai.medaglia ? <MedalBadge tipo={ai.medaglia} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
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
                          {new Date(g.data).toLocaleDateString("it-CH")}
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
                          €{g.costo_iscrizione}
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

// ─── Sub-components ────────────────────────────────────────────────────────────
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

export default CompetitionsPage;
