import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { use_campi, use_atleti, get_atleta_name_from_list } from "@/hooks/use-supabase-data";
import { use_upsert_campo, use_iscrivi_atleta_campo, use_elimina_campo } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Calendar, X, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

// ─── Modal iscrizione atleta ───────────────────────────────
const IscrizioneModal: React.FC<{
  campo: any;
  atleti: any[];
  on_close: () => void;
}> = ({ campo, atleti, on_close }) => {
  const iscrivi = use_iscrivi_atleta_campo();
  const [atleta_id, set_atleta_id] = useState("");
  const [tipo, set_tipo] = useState<"diurno" | "completo">("diurno");
  const [costo, set_costo] = useState<number>(campo.costo_diurno || 0);
  const [saving, set_saving] = useState(false);

  // Aggiorna costo automaticamente quando cambia il tipo
  useEffect(() => {
    if (tipo === "diurno") set_costo(campo.costo_diurno || 0);
    else set_costo(campo.costo_completo || 0);
  }, [tipo, campo]);

  const atleti_non_iscritti = atleti.filter(
    (a: any) => a.stato === "attivo" && !campo.iscrizioni?.find((i: any) => i.atleta_id === a.id),
  );

  const handle_submit = async () => {
    if (!atleta_id) {
      toast({ title: "Seleziona un atleta", variant: "destructive" });
      return;
    }
    set_saving(true);
    try {
      await iscrivi.mutateAsync({ campo_id: campo.id, atleta_id, tipo, costo_totale: costo });
      toast({ title: "✅ Atleta iscritto al campo" });
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
          <div>
            <h2 className="text-base font-bold text-foreground">Iscrivi atleta</h2>
            <p className="text-xs text-muted-foreground">{campo.nome}</p>
          </div>
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
              {atleti_non_iscritti.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.nome} {a.cognome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo partecipazione">
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: "diurno", label: "Diurno", costo: campo.costo_diurno },
                { val: "completo", label: "Completo", costo: campo.costo_completo },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => set_tipo(opt.val as any)}
                  className={`p-3 rounded-xl border-2 text-left transition-all
                    ${tipo === opt.val ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">CHF {opt.costo || 0}</p>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Importo (modificabile)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costo}
                onChange={(e) => set_costo(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-background pl-11 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <p className="text-xs text-muted-foreground">Precompilato dal costo del campo, modificabile manualmente</p>
          </Field>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={on_close} disabled={saving} className="flex-1">
            Annulla
          </Button>
          <Button
            onClick={handle_submit}
            disabled={saving || !atleta_id}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {saving ? "..." : "Iscrivi"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal campo ───────────────────────────────────────────
const CampoModal: React.FC<{
  campo?: any;
  on_close: () => void;
}> = ({ campo, on_close }) => {
  const upsert = use_upsert_campo();
  const elimina = use_elimina_campo();
  const [form, set_form] = useState({
    nome: campo?.nome || "",
    data_inizio: campo?.data_inizio || "",
    data_fine: campo?.data_fine || "",
    luogo: campo?.luogo || "",
    club_ospitante: campo?.club_ospitante || "",
    costo_diurno: campo?.costo_diurno ?? 0,
    costo_completo: campo?.costo_completo ?? 0,
    note: campo?.note || "",
  });
  const [saving, set_saving] = useState(false);
  const [confirm_delete, set_confirm_delete] = useState(false);

  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));

  const handle_save = async () => {
    if (!form.nome.trim() || !form.data_inizio || !form.data_fine) {
      toast({ title: "Campi obbligatori mancanti", variant: "destructive" });
      return;
    }
    set_saving(true);
    try {
      await upsert.mutateAsync({ ...form, id: campo?.id });
      toast({ title: campo?.id ? "✅ Campo aggiornato" : "✅ Campo creato" });
      on_close();
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const handle_delete = async () => {
    try {
      await elimina.mutateAsync(campo.id);
      toast({ title: "🗑️ Campo eliminato" });
      on_close();
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{campo?.id ? "Modifica campo" : "Nuovo campo"}</h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label="Nome *">
            <input
              value={form.nome}
              onChange={(e) => set_val("nome", e.target.value)}
              placeholder="es. Campo estivo 2025"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data inizio *">
              <input
                type="date"
                value={form.data_inizio}
                onChange={(e) => set_val("data_inizio", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
            <Field label="Data fine *">
              <input
                type="date"
                value={form.data_fine}
                onChange={(e) => set_val("data_fine", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
          </div>
          <Field label="Luogo">
            <input
              value={form.luogo}
              onChange={(e) => set_val("luogo", e.target.value)}
              placeholder="es. Lugano"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Club ospitante">
            <input
              value={form.club_ospitante}
              onChange={(e) => set_val("club_ospitante", e.target.value)}
              placeholder="es. Hockey Club Lugano"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Costo diurno">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costo_diurno}
                  onChange={(e) => set_val("costo_diurno", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background pl-11 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </Field>
            <Field label="Costo completo">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costo_completo}
                  onChange={(e) => set_val("costo_completo", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background pl-11 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </Field>
          </div>
          <Field label="Note">
            <textarea
              value={form.note}
              onChange={(e) => set_val("note", e.target.value)}
              rows={2}
              placeholder="Note aggiuntive..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-border space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={on_close} disabled={saving} className="flex-1">
              Annulla
            </Button>
            <Button onClick={handle_save} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
              {saving ? "..." : "💾 Salva"}
            </Button>
          </div>
          {campo?.id && !confirm_delete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set_confirm_delete(true)}
              className="w-full text-destructive hover:bg-destructive/10"
            >
              🗑️ Elimina campo
            </Button>
          )}
          {confirm_delete && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-xs font-semibold">Elimina anche tutte le iscrizioni collegate?</p>
              </div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────
const TrainingCampsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: campi = [], isLoading } = use_campi();
  const { data: atleti = [] } = use_atleti();
  const [campo_modal, set_campo_modal] = useState<any>(null); // null=chiuso, {}=nuovo, campo=modifica
  const [isc_campo, set_isc_campo] = useState<any>(null);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <>
      {campo_modal !== null && (
        <CampoModal campo={campo_modal?.id ? campo_modal : undefined} on_close={() => set_campo_modal(null)} />
      )}
      {isc_campo && <IscrizioneModal campo={isc_campo} atleti={atleti} on_close={() => set_isc_campo(null)} />}

      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("campi")}</h1>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => set_campo_modal({})}>
            <Plus className="w-4 h-4 mr-2" /> {t("nuovo_campo")}
          </Button>
        </div>

        {campi.length === 0 ? (
          <div className="bg-card rounded-xl shadow-card p-12 text-center text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nessun campo di allenamento. Clicca "Nuovo campo" per aggiungerne uno.</p>
          </div>
        ) : (
          campi.map((camp: any) => (
            <div key={camp.id} className="bg-card rounded-xl shadow-card p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{camp.nome}</h2>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(camp.data_inizio + "T00:00:00").toLocaleDateString("it-CH")} —{" "}
                      {new Date(camp.data_fine + "T00:00:00").toLocaleDateString("it-CH")}
                    </span>
                    {camp.luogo && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {camp.luogo}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => set_campo_modal(camp)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Modifica
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{t("club_ospitante")}</p>
                  <p className="font-medium text-foreground">{camp.club_ospitante || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("costo_diurno")}</p>
                  <p className="font-medium text-foreground tabular-nums">CHF {camp.costo_diurno}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("costo_completo")}</p>
                  <p className="font-medium text-foreground tabular-nums">CHF {camp.costo_completo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("iscrizioni")}</p>
                  <p className="font-medium text-foreground tabular-nums">{camp.iscrizioni.length}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    {t("iscrizioni")}
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => set_isc_campo(camp)}>
                    <Plus className="w-3 h-3 mr-1" /> Iscrivi
                  </Button>
                </div>
                {camp.iscrizioni.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nessun atleta iscritto.</p>
                ) : (
                  <div className="space-y-2">
                    {camp.iscrizioni.map((isc: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <span className="text-sm font-medium text-foreground">
                          {get_atleta_name_from_list(atleti, isc.atleta_id)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {isc.tipo}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default TrainingCampsPage;
