import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { use_stagioni } from "@/hooks/use-supabase-data";
import { use_upsert_stagione, use_elimina_stagione } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const TIPI_STAGIONE = [
  { value: "Regolare", label: "Regolare" },
  { value: "Pre-Season", label: "Pre-Season" },
  { value: "Post-Season", label: "Post-Season" },
  { value: "Campo", label: "Campo" },
];

const input_cls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const StagioneModal: React.FC<{
  stagione?: any;
  on_close: () => void;
}> = ({ stagione, on_close }) => {
  const qc = useQueryClient();
  const elimina = use_elimina_stagione();
  const [form, set_form] = useState({
    nome: stagione?.nome || "",
    tipo: stagione?.tipo || "Regolare",
    data_inizio: stagione?.data_inizio || "",
    data_fine: stagione?.data_fine || "",
    attiva: stagione?.attiva ?? true,
  });
  const [saving, set_saving] = useState(false);
  const [confirm_delete, set_confirm_delete] = useState(false);

  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));

  const handle_save = async () => {
    if (!form.nome.trim() || !form.data_inizio || !form.data_fine) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Nome, data inizio e data fine sono obbligatori.",
        variant: "destructive",
      });
      return;
    }
    if (form.data_fine < form.data_inizio) {
      toast({
        title: "Date non valide",
        description: "La data fine deve essere successiva alla data inizio.",
        variant: "destructive",
      });
      return;
    }
    set_saving(true);
    try {
      const payload = {
        club_id: get_current_club_id(), // ← FIX: dinamico
        nome: form.nome.trim(),
        tipo: form.tipo,
        data_inizio: form.data_inizio,
        data_fine: form.data_fine,
        attiva: form.attiva,
      };
      if (stagione?.id) {
        const { error } = await supabase.from("stagioni").update(payload).eq("id", stagione.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stagioni").insert(payload);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["stagioni"] });
      toast({ title: stagione?.id ? "✅ Stagione aggiornata" : "✅ Stagione creata" });
      on_close();
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const handle_delete = async () => {
    try {
      await elimina.mutateAsync(stagione.id);
      toast({ title: "🗑️ Stagione eliminata" });
      on_close();
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground">
            {stagione?.id ? "Modifica stagione" : "Nuova stagione"}
          </h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <Field label="Nome *">
            <input
              value={form.nome}
              onChange={(e) => set_val("nome", e.target.value)}
              placeholder="es. Stagione 2025-2026"
              className={input_cls}
            />
          </Field>
          <Field label="Tipo">
            <select value={form.tipo} onChange={(e) => set_val("tipo", e.target.value)} className={input_cls}>
              {TIPI_STAGIONE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data inizio *">
              <input
                type="date"
                value={form.data_inizio}
                onChange={(e) => set_val("data_inizio", e.target.value)}
                className={input_cls}
              />
            </Field>
            <Field label="Data fine *">
              <input
                type="date"
                value={form.data_fine}
                onChange={(e) => set_val("data_fine", e.target.value)}
                className={input_cls}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
            <input
              type="checkbox"
              id="attiva"
              checked={form.attiva}
              onChange={(e) => set_val("attiva", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="attiva" className="text-sm font-medium text-foreground cursor-pointer">
              Stagione attiva
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border space-y-2 flex-shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" onClick={on_close} disabled={saving} className="flex-1">
              Annulla
            </Button>
            <Button onClick={handle_save} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
              {saving ? "..." : "💾 Salva"}
            </Button>
          </div>
          {stagione?.id && !confirm_delete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set_confirm_delete(true)}
              className="w-full text-destructive hover:bg-destructive/10"
            >
              🗑️ Elimina stagione
            </Button>
          )}
          {confirm_delete && (
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
                {elimina.isPending ? "..." : "Elimina definitivamente"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SeasonsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: stagioni = [], isLoading } = use_stagioni();
  const [modal_open, set_modal_open] = useState(false);
  const [selected, set_selected] = useState<any>(null);

  const open_new = () => {
    set_selected(null);
    set_modal_open(true);
  };
  const open_edit = (s: any) => {
    set_selected(s);
    set_modal_open(true);
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <>
      {modal_open && <StagioneModal stagione={selected} on_close={() => set_modal_open(false)} />}
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("stagioni")}</h1>
          <Button className="bg-primary hover:bg-primary/90" onClick={open_new}>
            <Plus className="w-4 h-4 mr-2" /> {t("nuova_stagione")}
          </Button>
        </div>

        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("nome")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("tipo")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  {t("data_inizio")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  {t("data_fine")}
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("stato")}
                </th>
              </tr>
            </thead>
            <tbody>
              {stagioni.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    Nessuna stagione. Clicca "Nuova stagione" per aggiungerne una.
                  </td>
                </tr>
              ) : (
                stagioni.map((s: any) => (
                  <tr
                    key={s.id}
                    onClick={() => open_edit(s)}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{s.nome}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {s.tipo}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                      {new Date(s.data_inizio + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                      {new Date(s.data_fine + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={s.attiva ? "default" : "secondary"} className="text-xs">
                        {s.attiva ? "Attiva" : "Inattiva"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default SeasonsPage;
