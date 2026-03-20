import React, { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { use_corsi, use_istruttori, get_istruttore_name_from_list } from "@/hooks/use-supabase-data";
import { use_upsert_corso, use_elimina_corso } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const GIORNI_DB = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function is_istruttore_disponibile(istruttore: any, giorno: string, ora_inizio: string, ora_fine: string): boolean {
  const slots = istruttore.disponibilita?.[giorno] || [];
  if (slots.length === 0) return false;
  const corso_start = time_to_min(ora_inizio);
  const corso_end = time_to_min(ora_fine);
  return slots.some((s: any) => time_to_min(s.ora_inizio) <= corso_start && time_to_min(s.ora_fine) >= corso_end);
}

// ─── Field helper ──────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode; required?: boolean }> = ({
  label,
  children,
  required,
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {label}
      {required && " *"}
    </label>
    {children}
  </div>
);

// ─── Modal corso ───────────────────────────────────────────
const CorsoModal: React.FC<{
  corso?: any;
  istruttori: any[];
  corsi: any[];
  on_close: () => void;
  on_save: (data: any) => Promise<void>;
  on_delete?: () => Promise<void>;
  saving: boolean;
  deleting: boolean;
}> = ({ corso, istruttori, corsi, on_close, on_save, on_delete, saving, deleting }) => {
  const [form, set_form] = useState({
    nome: corso?.nome || "",
    tipo: corso?.tipo || "",
    giorno: corso?.giorno || "Lunedì",
    ora_inizio: corso?.ora_inizio?.slice(0, 5) || "08:00",
    ora_fine: corso?.ora_fine?.slice(0, 5) || "09:00",
    costo_mensile: corso?.costo_mensile ?? 0,
    costo_annuale: corso?.costo_annuale ?? 0,
    istruttori_ids: corso?.istruttori_ids || [],
    attivo: corso?.stato === "attivo" || corso?.attivo !== false,
    note: corso?.note || "",
    stagione_id: corso?.stagione_id || null,
  });
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [avviso_istruttori, set_avviso_istruttori] = useState<string[]>([]);
  const [confirm_forzatura, set_confirm_forzatura] = useState(false);

  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));

  const toggle_istruttore = (id: string) => {
    set_form((p) => ({
      ...p,
      istruttori_ids: p.istruttori_ids.includes(id)
        ? p.istruttori_ids.filter((x: string) => x !== id)
        : [...p.istruttori_ids, id],
    }));
  };

  // Calcola avvisi disponibilità in tempo reale
  const istruttori_non_disponibili = useMemo(() => {
    return form.istruttori_ids
      .map((id: string) => istruttori.find((i: any) => i.id === id))
      .filter((i: any) => i && !is_istruttore_disponibile(i, form.giorno, form.ora_inizio, form.ora_fine))
      .map((i: any) => `${i.nome} ${i.cognome}`);
  }, [form.istruttori_ids, form.giorno, form.ora_inizio, form.ora_fine, istruttori]);

  // Controlla conflitti con altri corsi
  const conflitti_corsi = useMemo(() => {
    return form.istruttori_ids.flatMap((id: string) => {
      return corsi
        .filter(
          (c: any) =>
            c.id !== corso?.id &&
            c.istruttori_ids?.includes(id) &&
            c.giorno === form.giorno &&
            c.attivo !== false &&
            time_to_min(c.ora_inizio?.slice(0, 5)) < time_to_min(form.ora_fine) &&
            time_to_min(c.ora_fine?.slice(0, 5)) > time_to_min(form.ora_inizio),
        )
        .map((c: any) => {
          const istr = istruttori.find((i: any) => i.id === id);
          return `${istr?.nome} ${istr?.cognome} — conflitto con "${c.nome}" (${c.ora_inizio?.slice(0, 5)}–${c.ora_fine?.slice(0, 5)})`;
        });
    });
  }, [form.istruttori_ids, form.giorno, form.ora_inizio, form.ora_fine, corsi, corso, istruttori]);

  const tutti_avvisi = [
    ...new Set([
      ...istruttori_non_disponibili.map((n: string) => `${n} non è disponibile in questo orario`),
      ...conflitti_corsi,
    ]),
  ];

  const handle_save_click = () => {
    if (!form.nome.trim()) {
      toast({ title: "Il nome del corso è obbligatorio", variant: "destructive" });
      return;
    }
    if (tutti_avvisi.length > 0) {
      set_avviso_istruttori(tutti_avvisi);
      set_confirm_forzatura(true);
      return;
    }
    on_save({ ...form, id: corso?.id });
  };

  const handle_forza_salva = () => {
    set_confirm_forzatura(false);
    on_save({ ...form, id: corso?.id });
  };

  const istruttori_attivi = istruttori.filter((i: any) => i.attivo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{corso?.id ? "Modifica corso" : "Nuovo corso"}</h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avviso forzatura */}
        {confirm_forzatura && (
          <div className="mx-6 mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-orange-700">Attenzione — Problemi di disponibilità</p>
                {avviso_istruttori.map((msg, i) => (
                  <p key={i} className="text-xs text-orange-600">
                    • {msg}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => set_confirm_forzatura(false)} className="flex-1">
                ← Correggi
              </Button>
              <Button
                size="sm"
                onClick={handle_forza_salva}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? "..." : "Salva comunque"}
              </Button>
            </div>
          </div>
        )}

        <div className="px-6 py-5 space-y-4">
          <Field label="Nome" required>
            <input
              value={form.nome}
              onChange={(e) => set_val("nome", e.target.value)}
              placeholder="es. Corso Avanzato"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          <Field label="Tipo">
            <input
              value={form.tipo}
              onChange={(e) => set_val("tipo", e.target.value)}
              placeholder="es. Artistica, Stile..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Giorno">
              <select
                value={form.giorno}
                onChange={(e) => set_val("giorno", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {GIORNI_DB.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ora inizio">
              <input
                type="time"
                value={form.ora_inizio}
                onChange={(e) => set_val("ora_inizio", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
            <Field label="Ora fine">
              <input
                type="time"
                value={form.ora_fine}
                onChange={(e) => set_val("ora_fine", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Costo mensile">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costo_mensile}
                  onChange={(e) => set_val("costo_mensile", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background pl-11 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </Field>
            <Field label="Costo annuale">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costo_annuale}
                  onChange={(e) => set_val("costo_annuale", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-background pl-11 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </Field>
          </div>

          {/* Selezione istruttori con feedback disponibilità */}
          <Field label="Istruttori">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {istruttori_attivi.map((i: any) => {
                const selected = form.istruttori_ids.includes(i.id);
                const disponibile = is_istruttore_disponibile(i, form.giorno, form.ora_inizio, form.ora_fine);
                const ha_conflitto = corsi.some(
                  (c: any) =>
                    c.id !== corso?.id &&
                    c.istruttori_ids?.includes(i.id) &&
                    c.giorno === form.giorno &&
                    c.attivo !== false &&
                    time_to_min(c.ora_inizio?.slice(0, 5)) < time_to_min(form.ora_fine) &&
                    time_to_min(c.ora_fine?.slice(0, 5)) > time_to_min(form.ora_inizio),
                );

                return (
                  <div
                    key={i.id}
                    onClick={() => toggle_istruttore(i.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all
                      ${
                        selected
                          ? ha_conflitto
                            ? "border-destructive bg-destructive/5"
                            : !disponibile
                              ? "border-orange-400 bg-orange-50"
                              : "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 bg-background"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                        ${selected ? (ha_conflitto ? "border-destructive bg-destructive" : "border-primary bg-primary") : "border-muted-foreground"}`}
                      >
                        {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {i.nome} {i.cognome}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {selected && ha_conflitto && (
                        <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                          Conflitto
                        </span>
                      )}
                      {selected && !ha_conflitto && !disponibile && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                          Non disponibile
                        </span>
                      )}
                      {!selected && (
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full
                          ${disponibile ? "text-success bg-success/10" : "text-muted-foreground bg-muted/50"}`}
                        >
                          {disponibile ? "✓ Disponibile" : "Non disp."}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>

          <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
            <input
              type="checkbox"
              id="attivo_corso"
              checked={form.attivo}
              onChange={(e) => set_val("attivo", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="attivo_corso" className="text-sm font-medium text-foreground cursor-pointer">
              Corso attivo
            </label>
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
            <Button
              onClick={handle_save_click}
              disabled={saving || confirm_forzatura}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {saving ? "..." : "💾 Salva"}
            </Button>
          </div>
          {corso?.id && !confirm_delete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set_confirm_delete(true)}
              className="w-full text-destructive hover:bg-destructive/10"
            >
              🗑️ Elimina corso
            </Button>
          )}
          {confirm_delete && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => set_confirm_delete(false)} className="flex-1">
                Annulla
              </Button>
              <Button variant="destructive" size="sm" onClick={on_delete} disabled={deleting} className="flex-1">
                {deleting ? "..." : "Elimina definitivamente"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────
const CoursesPage: React.FC = () => {
  const { t } = useI18n();
  const { data: corsi = [], isLoading } = use_corsi();
  const { data: istruttori = [] } = use_istruttori();
  const upsert = use_upsert_corso();
  const elimina = use_elimina_corso();
  const [modal_open, set_modal_open] = useState(false);
  const [selected_corso, set_selected_corso] = useState<any>(null);

  const handle_save = async (data: any) => {
    try {
      await upsert.mutateAsync({ ...data, istruttori_ids: Array.from(new Set(data.istruttori_ids || [])) });
      set_modal_open(false);
      toast({ title: data.id ? "✅ Corso aggiornato" : "✅ Corso creato" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    }
  };

  const handle_delete = async () => {
    try {
      await elimina.mutateAsync(selected_corso.id);
      set_modal_open(false);
      toast({ title: "🗑️ Corso eliminato correttamente" });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <>
      {modal_open && (
        <CorsoModal
          corso={selected_corso}
          istruttori={istruttori}
          corsi={corsi}
          on_close={() => set_modal_open(false)}
          on_save={handle_save}
          on_delete={selected_corso?.id ? handle_delete : undefined}
          saving={upsert.isPending}
          deleting={elimina.isPending}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("corsi")}</h1>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => {
              set_selected_corso(null);
              set_modal_open(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> {t("nuovo_corso")}
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
                    {t("tipo")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t("giorno")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t("ora_inizio")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    {t("istruttori")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("iscritti")}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    {t("costo_mensile")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("stato")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {corsi.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Nessun corso. Clicca "Nuovo corso" per aggiungerne uno.
                    </td>
                  </tr>
                ) : (
                  corsi.map((c: any) => (
                    <tr
                      key={c.id}
                      onClick={() => {
                        set_selected_corso(c);
                        set_modal_open(true);
                      }}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {c.tipo?.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.giorno}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                        {c.ora_inizio?.slice(0, 5)} - {c.ora_fine?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {(c.istruttori_ids || [])
                          .map((id: string) => get_istruttore_name_from_list(istruttori, id))
                          .join(", ")}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums font-medium text-foreground">
                        {(c.atleti_ids || []).length}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                        CHF {c.costo_mensile}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${c.stato === "attivo" ? "bg-success" : "bg-muted-foreground"}`}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default CoursesPage;
