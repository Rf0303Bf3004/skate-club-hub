import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  use_istruttori,
  use_atleti_monitori,
  use_lezioni_private,
  use_corsi,
  use_campi,
} from "@/hooks/use-supabase-data";
import { use_upsert_istruttore, use_save_disponibilita, use_elimina_istruttore } from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowLeft, Euro, Clock, TrendingUp, Download, Upload, X, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const TIPI_CONTRATTO = [
  { value: "orario", label: "A ore (costo al minuto)" },
  { value: "fisso_mensile", label: "Fisso mensile" },
  { value: "fisso_corsi", label: "Fisso corsi + variabile lezioni private" },
  { value: "misto", label: "Fisso mensile + variabile lezioni private" },
];

function get_mese_label(anno: number, mese: number) {
  return new Date(anno, mese - 1, 1).toLocaleDateString("it-CH", { month: "long", year: "numeric" });
}

function time_to_min(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function ore_fmt(ore: number): string {
  const h = Math.floor(ore);
  const m = Math.round((ore - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function to_num(v: string | number): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const cleaned = String(v).replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const input_cls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

// ─── NumInput corretto ─────────────────────────────────────
const NumInput: React.FC<{
  value: string | number;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}> = ({ value, onChange, className = "", placeholder = "0" }) => {
  const [local, set_local] = useState(() => {
    const n = to_num(String(value));
    return n === 0 ? "" : String(n);
  });
  const [focused, set_focused] = useState(false);

  useEffect(() => {
    if (!focused) {
      const n = to_num(String(value));
      set_local(n === 0 ? "" : String(n));
    }
  }, [value, focused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      placeholder={placeholder}
      onFocus={() => set_focused(true)}
      onKeyDown={(e) => {
        const allowed = [
          "Backspace",
          "Delete",
          "Tab",
          "Escape",
          "Enter",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ];
        if (allowed.includes(e.key)) return;
        if ((e.key === "." || e.key === ",") && !local.includes(".")) return;
        if (/^\d$/.test(e.key)) return;
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
      }}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".");
        set_local(v);
        onChange(v);
      }}
      onBlur={() => {
        set_focused(false);
        const n = to_num(local);
        const display = n === 0 ? "" : String(n);
        set_local(display);
        onChange(String(n));
      }}
      className={`${input_cls} ${className}`}
    />
  );
};

// ─── Modal istruttore ──────────────────────────────────────
const IstruttoreModal: React.FC<{
  istruttore?: any;
  on_close: () => void;
  on_save: (data: any) => Promise<void>;
  on_delete?: () => Promise<void>;
  saving: boolean;
  deleting: boolean;
}> = ({ istruttore, on_close, on_save, on_delete, saving, deleting }) => {
  const [form, set_form] = useState({
    nome: istruttore?.nome || "",
    cognome: istruttore?.cognome || "",
    email: istruttore?.email || "",
    telefono: istruttore?.telefono || "",
    costo_minuto_lezione_privata: String(istruttore?.costo_minuto || istruttore?.costo_minuto_lezione_privata || ""),
    attivo: istruttore?.attivo !== false && istruttore?.stato !== "inattivo",
    note: istruttore?.note || "",
    foto_url: istruttore?.foto_url || "",
    tag_nfc: istruttore?.tag_nfc || "",
    ruolo: "istruttore",
  });
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [uploading_foto, set_uploading_foto] = useState(false);

  const set_val = useCallback((k: string, v: any) => {
    set_form((p) => ({ ...p, [k]: v }));
  }, []);

  const handle_foto_upload = async (file: File) => {
    set_uploading_foto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${get_current_club_id()}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("foto-istruttori").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("foto-istruttori").getPublicUrl(path);
      set_val("foto_url", data.publicUrl);
      toast({ title: "✅ Foto caricata" });
    } catch (err: any) {
      toast({ title: "Errore upload foto", description: err?.message, variant: "destructive" });
    } finally {
      set_uploading_foto(false);
    }
  };

  const handle_save = () => {
    on_save({
      ...form,
      id: istruttore?.id,
      ruolo: "istruttore",
      costo_minuto_lezione_privata: to_num(form.costo_minuto_lezione_privata),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">
            {istruttore?.id ? "Modifica istruttore" : "Nuovo istruttore"}
          </h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <Field label="Foto">
            <div className="flex items-center gap-3">
              {form.foto_url ? (
                <img
                  src={form.foto_url}
                  alt="foto"
                  className="w-16 h-16 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xl font-bold">
                  {form.nome?.[0] || "?"}
                  {form.cognome?.[0] || ""}
                </div>
              )}
              <label
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-muted/30 text-sm text-muted-foreground transition-colors ${uploading_foto ? "opacity-50 pointer-events-none" : ""}`}
              >
                <Upload className="w-4 h-4" />
                {uploading_foto ? "Caricamento..." : "Carica foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handle_foto_upload(e.target.files[0])}
                />
              </label>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *">
              <input value={form.nome} onChange={(e) => set_val("nome", e.target.value)} className={input_cls} />
            </Field>
            <Field label="Cognome *">
              <input value={form.cognome} onChange={(e) => set_val("cognome", e.target.value)} className={input_cls} />
            </Field>
          </div>

          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set_val("email", e.target.value)}
              className={input_cls}
            />
          </Field>

          <Field label="Telefono">
            <input value={form.telefono} onChange={(e) => set_val("telefono", e.target.value)} className={input_cls} />
          </Field>

          <Field label="TAG NFC">
            <input
              value={form.tag_nfc}
              onChange={(e) => set_val("tag_nfc", e.target.value)}
              placeholder="es. 04:A3:B2:C1:D0"
              className={input_cls}
            />
          </Field>

          <Field label="Prezzo al minuto lezioni private (vendita al cliente)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF/min</span>
              <NumInput
                value={form.costo_minuto_lezione_privata}
                onChange={(v) => set_val("costo_minuto_lezione_privata", v)}
                className="pl-16"
                placeholder="es. 1.50"
              />
            </div>
          </Field>

          <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
            <input
              type="checkbox"
              id="attivo_istr"
              checked={form.attivo}
              onChange={(e) => set_val("attivo", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="attivo_istr" className="text-sm font-medium text-foreground cursor-pointer">
              Attivo
            </label>
          </div>

          <Field label="Note">
            <textarea
              value={form.note}
              onChange={(e) => set_val("note", e.target.value)}
              rows={2}
              className={`${input_cls} resize-none`}
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
          {istruttore?.id && !confirm_delete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set_confirm_delete(true)}
              className="w-full text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Elimina
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

// ─── Tab Ore Lavoro ────────────────────────────────────────
const TabOreLavoro: React.FC<{
  istruttore: any;
  lezioni: any[];
  corsi: any[];
  campi: any[];
}> = ({ istruttore, lezioni, corsi, campi }) => {
  const qc = useQueryClient();
  const now = new Date();
  const [anno, set_anno] = useState(now.getFullYear());
  const [mese, set_mese] = useState(now.getMonth() + 1);
  const [ore_extra, set_ore_extra] = useState<string>("");
  const [note_extra, set_note_extra] = useState("");
  const [ore_gare_manual, set_ore_gare_manual] = useState<string>("");
  const [saving, set_saving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("ore_lavoro_istruttori")
        .select("*")
        .eq("istruttore_id", istruttore.id)
        .eq("anno", anno)
        .eq("mese", mese)
        .maybeSingle();
      set_ore_extra(data?.ore_extra != null ? String(data.ore_extra) : "");
      set_note_extra(data?.note_extra ?? "");
      set_ore_gare_manual(data?.ore_gare != null ? String(data.ore_gare) : "");
    };
    load();
  }, [istruttore.id, anno, mese]);

  const lezioni_mese = useMemo(
    () =>
      lezioni.filter((l) => {
        if (l.istruttore_id !== istruttore.id || !l.data) return false;
        const d = new Date(l.data + "T00:00:00");
        return d.getFullYear() === anno && d.getMonth() + 1 === mese;
      }),
    [lezioni, istruttore.id, anno, mese],
  );

  const minuti_lezioni = lezioni_mese.reduce((s, l: any) => s + (l.durata_minuti || 20), 0);
  const ore_lezioni = minuti_lezioni / 60;

  const corsi_istruttore = useMemo(
    () => corsi.filter((c: any) => c.istruttori_ids?.includes(istruttore.id) && c.attivo),
    [corsi, istruttore.id],
  );

  const settimane_mese = useMemo(() => {
    const giorni_in_mese = new Date(anno, mese, 0).getDate();
    const conteggio: Record<string, number> = {};
    for (let d = 1; d <= giorni_in_mese; d++) {
      const dow = new Date(anno, mese - 1, d).getDay();
      const nome = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][dow];
      conteggio[nome] = (conteggio[nome] || 0) + 1;
    }
    return conteggio;
  }, [anno, mese]);

  const minuti_corsi = useMemo(
    () =>
      corsi_istruttore.reduce((s: number, c: any) => {
        const durata =
          time_to_min(c.ora_fine?.slice(0, 5) || "00:00") - time_to_min(c.ora_inizio?.slice(0, 5) || "00:00");
        return s + durata * (settimane_mese[c.giorno] || 4);
      }, 0),
    [corsi_istruttore, settimane_mese],
  );

  const ore_corsi = minuti_corsi / 60;

  const ore_campi = useMemo(() => {
    let totale = 0;
    for (const campo of campi) {
      if (!campo.data_inizio || !campo.data_fine) continue;
      const inizio = new Date(campo.data_inizio + "T00:00:00");
      const fine = new Date(campo.data_fine + "T00:00:00");
      if (inizio.getFullYear() === anno && inizio.getMonth() + 1 === mese) {
        const giorni = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        totale += giorni * 8;
      }
    }
    return totale;
  }, [campi, anno, mese]);

  const ore_gare_num = to_num(ore_gare_manual);
  const ore_extra_num = to_num(ore_extra);
  const ore_totali = ore_lezioni + ore_corsi + ore_campi + ore_gare_num + ore_extra_num;
  const costo_lezioni = ore_lezioni * (istruttore.costo_orario_lezioni || 0);
  const costo_corsi = ore_corsi * (istruttore.costo_orario_corsi || 0);
  const costo_totale_club = costo_lezioni + costo_corsi;

  const handle_save = async () => {
    set_saving(true);
    try {
      const { error } = await supabase.from("ore_lavoro_istruttori").upsert(
        {
          istruttore_id: istruttore.id,
          anno,
          mese,
          ore_corsi,
          ore_lezioni_private: ore_lezioni,
          ore_campi,
          ore_gare: ore_gare_num,
          ore_extra: ore_extra_num,
          note_extra,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "istruttore_id,anno,mese" },
      );
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["ore_lavoro"] });
      toast({ title: "✅ Ore lavoro salvate" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const handle_export_csv = () => {
    const rows = [
      ["Istruttore", `${istruttore.nome} ${istruttore.cognome}`],
      ["Mese", get_mese_label(anno, mese)],
      [""],
      ["Categoria", "Ore", "Costo (CHF)"],
      ["Lezioni private", ore_lezioni.toFixed(2), costo_lezioni.toFixed(2)],
      ["Corsi", ore_corsi.toFixed(2), costo_corsi.toFixed(2)],
      ["Campi allenamento", ore_campi.toFixed(2), ""],
      ["Accompagnamento gare", ore_gare_num.toFixed(2), ""],
      ["Extra/Altro", ore_extra_num.toFixed(2), ""],
      ["TOTALE", ore_totali.toFixed(2), costo_totale_club.toFixed(2)],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ore_${istruttore.cognome}_${anno}_${String(mese).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (mese === 1) {
              set_anno((a) => a - 1);
              set_mese(12);
            } else set_mese((m) => m - 1);
          }}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
        >
          ←
        </button>
        <h3 className="text-sm font-bold text-foreground capitalize">{get_mese_label(anno, mese)}</h3>
        <button
          onClick={() => {
            if (mese === 12) {
              set_anno((a) => a + 1);
              set_mese(1);
            } else set_mese((m) => m + 1);
          }}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Lezioni private", ore: ore_lezioni, color: "text-primary" },
          { label: "Corsi", ore: ore_corsi, color: "text-orange-500" },
          { label: "Ore totali", ore: ore_totali, color: "text-success" },
        ].map((kpi, i) => (
          <div key={i} className="bg-card rounded-xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`w-3.5 h-3.5 ${kpi.color}`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className={`text-lg font-bold tabular-nums ${kpi.color}`}>{ore_fmt(kpi.ore)}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Dettaglio ore mensili</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handle_export_csv} className="h-7 text-xs gap-1.5">
              <Download className="w-3 h-3" /> CSV
            </Button>
            <Button
              size="sm"
              onClick={handle_save}
              disabled={saving}
              className="h-7 text-xs bg-primary hover:bg-primary/90"
            >
              {saving ? "..." : "💾 Salva"}
            </Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-4 py-2.5 text-xs font-bold text-muted-foreground">Categoria</th>
              <th className="text-right px-4 py-2.5 text-xs font-bold text-muted-foreground">Ore</th>
              <th className="text-right px-4 py-2.5 text-xs font-bold text-muted-foreground">Costo/h club</th>
              <th className="text-right px-4 py-2.5 text-xs font-bold text-muted-foreground">Totale</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">Lezioni private</p>
                <p className="text-xs text-muted-foreground">{lezioni_mese.length} lezioni · automatico</p>
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{ore_fmt(ore_lezioni)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                CHF {(istruttore.costo_orario_lezioni || 0).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">
                CHF {costo_lezioni.toFixed(2)}
              </td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">Corsi</p>
                <p className="text-xs text-muted-foreground">{corsi_istruttore.length} corsi attivi · automatico</p>
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{ore_fmt(ore_corsi)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                CHF {(istruttore.costo_orario_corsi || 0).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">
                CHF {costo_corsi.toFixed(2)}
              </td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">Campi allenamento</p>
                <p className="text-xs text-muted-foreground">automatico (8h/giorno)</p>
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{ore_fmt(ore_campi)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">Accompagnamento gare</p>
                <p className="text-xs text-muted-foreground">inserimento manuale</p>
              </td>
              <td className="px-4 py-3 text-right">
                <NumInput
                  value={ore_gare_manual}
                  onChange={(v) => set_ore_gare_manual(v)}
                  className="w-20 px-2 py-1 text-right"
                  placeholder="0"
                />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-4 py-3 space-y-1">
                <p className="font-medium text-foreground">Extra / Riunioni / Altro</p>
                <input
                  type="text"
                  value={note_extra}
                  onChange={(e) => set_note_extra(e.target.value)}
                  placeholder="Note (opzionale)..."
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </td>
              <td className="px-4 py-3 text-right">
                <NumInput
                  value={ore_extra}
                  onChange={(v) => set_ore_extra(v)}
                  className="w-20 px-2 py-1 text-right"
                  placeholder="0"
                />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
            </tr>
            <tr className="bg-muted/20">
              <td className="px-4 py-3 font-bold text-foreground">TOTALE</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground">{ore_fmt(ore_totali)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-primary">
                CHF {costo_totale_club.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Tab Compenso ──────────────────────────────────────────
const TabCompenso: React.FC<{
  istruttore: any;
  lezioni: any[];
  corsi: any[];
  on_save_contratto: (data: any) => void;
  saving: boolean;
}> = ({ istruttore, lezioni, corsi, on_save_contratto, saving }) => {
  const now = new Date();
  const [anno, set_anno] = useState(now.getFullYear());
  const [mese, set_mese] = useState(now.getMonth() + 1);
  const [contratto_form, set_contratto_form] = useState({
    tipo_contratto: istruttore.tipo_contratto || "orario",
    costo_minuto_lezione_privata: String(istruttore.costo_minuto || istruttore.costo_minuto_lezione_privata || ""),
    compenso_fisso_mensile: String(istruttore.compenso_fisso_mensile || ""),
    compenso_fisso_corsi: String(istruttore.compenso_fisso_corsi || ""),
    costo_orario_corsi: String(istruttore.costo_orario_corsi || ""),
    costo_orario_lezioni: String(istruttore.costo_orario_lezioni || ""),
  });

  const lezioni_mese = useMemo(
    () =>
      lezioni.filter((l) => {
        if (l.istruttore_id !== istruttore.id || !l.data) return false;
        const d = new Date(l.data + "T00:00:00");
        return d.getFullYear() === anno && d.getMonth() + 1 === mese;
      }),
    [lezioni, istruttore.id, anno, mese],
  );

  const minuti_lezioni_private = lezioni_mese.reduce((s, l: any) => s + (l.durata_minuti || 20), 0);
  const ore_lezioni_private = minuti_lezioni_private / 60;

  const corsi_istruttore = useMemo(
    () => corsi.filter((c: any) => c.istruttori_ids?.includes(istruttore.id) && c.attivo),
    [corsi, istruttore.id],
  );

  const settimane_mese = useMemo(() => {
    const giorni_in_mese = new Date(anno, mese, 0).getDate();
    const conteggio: Record<string, number> = {};
    for (let d = 1; d <= giorni_in_mese; d++) {
      const dow = new Date(anno, mese - 1, d).getDay();
      const nome = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][dow];
      conteggio[nome] = (conteggio[nome] || 0) + 1;
    }
    return conteggio;
  }, [anno, mese]);

  const minuti_corsi = useMemo(
    () =>
      corsi_istruttore.reduce((s: number, c: any) => {
        const durata =
          time_to_min(c.ora_fine?.slice(0, 5) || "00:00") - time_to_min(c.ora_inizio?.slice(0, 5) || "00:00");
        return s + durata * (settimane_mese[c.giorno] || 4);
      }, 0),
    [corsi_istruttore, settimane_mese],
  );

  const ore_corsi = minuti_corsi / 60;
  const ore_totali = ore_lezioni_private + ore_corsi;

  const compenso_vendita = useMemo(() => {
    const tipo = contratto_form.tipo_contratto;
    const costo_min = to_num(contratto_form.costo_minuto_lezione_privata);
    const fisso_mensile = to_num(contratto_form.compenso_fisso_mensile);
    const fisso_corsi = to_num(contratto_form.compenso_fisso_corsi);
    switch (tipo) {
      case "orario":
        return (minuti_lezioni_private + minuti_corsi) * costo_min;
      case "fisso_mensile":
        return fisso_mensile;
      case "fisso_corsi":
        return fisso_corsi + minuti_lezioni_private * costo_min;
      case "misto":
        return fisso_mensile + minuti_lezioni_private * costo_min;
      default:
        return 0;
    }
  }, [contratto_form, minuti_lezioni_private, minuti_corsi]);

  const handle_save = () => {
    on_save_contratto({
      tipo_contratto: contratto_form.tipo_contratto,
      costo_minuto_lezione_privata: to_num(contratto_form.costo_minuto_lezione_privata),
      compenso_fisso_mensile: to_num(contratto_form.compenso_fisso_mensile),
      compenso_fisso_corsi: to_num(contratto_form.compenso_fisso_corsi),
      costo_orario_corsi: to_num(contratto_form.costo_orario_corsi),
      costo_orario_lezioni: to_num(contratto_form.costo_orario_lezioni),
    });
  };

  const upd = (k: string, v: string) => set_contratto_form((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Prezzo di vendita al cliente
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">RICAVI</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPI_CONTRATTO.map((tc) => (
            <div
              key={tc.value}
              onClick={() => set_contratto_form((p) => ({ ...p, tipo_contratto: tc.value }))}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${contratto_form.tipo_contratto === tc.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <p className="text-sm font-medium text-foreground">{tc.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {(contratto_form.tipo_contratto === "orario" ||
            contratto_form.tipo_contratto === "fisso_corsi" ||
            contratto_form.tipo_contratto === "misto") && (
            <Field label="Prezzo al minuto lezioni private (vendita)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <NumInput
                  value={contratto_form.costo_minuto_lezione_privata}
                  onChange={(v) => upd("costo_minuto_lezione_privata", v)}
                  className="pl-11"
                  placeholder="es. 1.50"
                />
              </div>
            </Field>
          )}
          {(contratto_form.tipo_contratto === "fisso_mensile" || contratto_form.tipo_contratto === "misto") && (
            <Field label="Compenso fisso mensile">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <NumInput
                  value={contratto_form.compenso_fisso_mensile}
                  onChange={(v) => upd("compenso_fisso_mensile", v)}
                  className="pl-11"
                  placeholder="es. 1500"
                />
              </div>
            </Field>
          )}
          {contratto_form.tipo_contratto === "fisso_corsi" && (
            <Field label="Compenso fisso corsi">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF</span>
                <NumInput
                  value={contratto_form.compenso_fisso_corsi}
                  onChange={(v) => upd("compenso_fisso_corsi", v)}
                  className="pl-11"
                  placeholder="es. 800"
                />
              </div>
            </Field>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Costo orario club (interno)
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold">
            COSTI
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Costo orario — lezioni private">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF/h</span>
              <NumInput
                value={contratto_form.costo_orario_lezioni}
                onChange={(v) => upd("costo_orario_lezioni", v)}
                className="pl-14"
                placeholder="es. 45"
              />
            </div>
          </Field>
          <Field label="Costo orario — corsi e altro">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF/h</span>
              <NumInput
                value={contratto_form.costo_orario_corsi}
                onChange={(v) => upd("costo_orario_corsi", v)}
                className="pl-14"
                placeholder="es. 35"
              />
            </div>
          </Field>
        </div>
      </div>

      <Button onClick={handle_save} disabled={saving} size="sm" className="bg-primary hover:bg-primary/90">
        {saving ? "..." : "💾 Salva configurazione compenso"}
      </Button>

      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (mese === 1) {
              set_anno((a) => a - 1);
              set_mese(12);
            } else set_mese((m) => m - 1);
          }}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
        >
          ←
        </button>
        <h3 className="text-sm font-bold text-foreground capitalize">{get_mese_label(anno, mese)}</h3>
        <button
          onClick={() => {
            if (mese === 12) {
              set_anno((a) => a + 1);
              set_mese(1);
            } else set_mese((m) => m + 1);
          }}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Ore lezioni", value: ore_fmt(ore_lezioni_private), icon: Clock, color: "text-primary" },
          { label: "Ore corsi", value: ore_fmt(ore_corsi), icon: Clock, color: "text-orange-500" },
          { label: "Ore totali", value: ore_fmt(ore_totali), icon: TrendingUp, color: "text-success" },
          {
            label: "Ricavo stimato",
            value: `CHF ${compenso_vendita.toFixed(2)}`,
            icon: Euro,
            color: "text-foreground",
          },
        ].map((kpi, i) => (
          <div key={i} className="bg-card rounded-xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className={`text-lg font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Scheda monitore/aiuto monitore ───────────────────────
const MonitoreDetail: React.FC<{
  monitore: any;
  on_back: () => void;
}> = ({ monitore, on_back }) => {
  const qc = useQueryClient();
  const now = new Date();
  const [anno, set_anno] = useState(now.getFullYear());
  const [mese, set_mese] = useState(now.getMonth() + 1);
  const [compenso_orario, set_compenso_orario] = useState<string>(() => {
    const n = to_num(monitore.compenso_orario_pista);
    return n === 0 ? "" : String(n);
  });
  const [ore_pista, set_ore_pista] = useState<string>("");
  const [note_extra, set_note_extra] = useState("");
  const [saving, set_saving] = useState(false);
  const [saving_compenso, set_saving_compenso] = useState(false);

  const ruolo_label = monitore.ruolo_pista === "monitore" ? "Monitore" : "Aiuto Monitore";

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("ore_pista_monitors")
        .select("*")
        .eq("atleta_id", monitore.id)
        .eq("anno", anno)
        .eq("mese", mese)
        .maybeSingle();
      const n = to_num(data?.ore_extra);
      set_ore_pista(n === 0 ? "" : String(n));
      set_note_extra(data?.note_extra ?? "");
    };
    load();
  }, [monitore.id, anno, mese]);

  const ore_num = to_num(ore_pista);
  const compenso_num = to_num(compenso_orario);
  const compenso_totale = ore_num * compenso_num;

  const handle_save_ore = async () => {
    set_saving(true);
    try {
      const { error } = await supabase.from("ore_pista_monitors").upsert(
        {
          atleta_id: monitore.id,
          anno,
          mese,
          ore_extra: ore_num,
          note_extra,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "atleta_id,anno,mese" },
      );
      if (error) throw error;
      toast({ title: "✅ Ore salvate" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving(false);
    }
  };

  const handle_save_compenso = async () => {
    set_saving_compenso(true);
    try {
      const { error } = await supabase
        .from("atleti")
        .update({ compenso_orario_pista: compenso_num })
        .eq("id", monitore.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["atleti"] });
      await qc.invalidateQueries({ queryKey: ["atleti_monitori"] });
      toast({ title: "✅ Compenso salvato" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving_compenso(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={on_back}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Istruttori
        </Button>
        <div className="flex items-center gap-3">
          {monitore.foto_url ? (
            <img
              src={monitore.foto_url}
              alt={monitore.nome}
              className="w-10 h-10 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {monitore.nome[0]}
              {monitore.cognome[0]}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {monitore.nome} {monitore.cognome}
            </h1>
            <Badge variant="secondary" className="text-xs">
              {ruolo_label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-card rounded-xl shadow-card p-5 space-y-3 max-w-lg">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Informazioni</p>
        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            {monitore.nome} è un atleta del club con ruolo pista <strong>{ruolo_label}</strong>. Per modificare i dati
            anagrafici vai nella scheda <strong>Atleti</strong>.
          </p>
        </div>
        {[
          { label: "Livello", value: monitore.percorso_amatori || monitore.livello_amatori || "—" },
          { label: "Carriera Artistica", value: monitore.carriera_artistica || "—" },
          { label: "Carriera Stile", value: monitore.carriera_stile || "—" },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground">{value}</span>
          </div>
        ))}
      </div>

      {/* Compenso */}
      <div className="bg-card rounded-xl shadow-card p-5 space-y-4 max-w-lg">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Compenso orario</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold">
            COSTI
          </span>
        </div>
        <Field label="Compenso orario (CHF/ora)">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">CHF/h</span>
            <NumInput
              value={compenso_orario}
              onChange={(v) => set_compenso_orario(v)}
              className="pl-14"
              placeholder="es. 15.00"
            />
          </div>
        </Field>
        <Button
          onClick={handle_save_compenso}
          disabled={saving_compenso}
          size="sm"
          className="bg-primary hover:bg-primary/90"
        >
          {saving_compenso ? "..." : "💾 Salva compenso"}
        </Button>
      </div>

      {/* Ore pista mensili */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden max-w-lg">
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (mese === 1) {
                  set_anno((a) => a - 1);
                  set_mese(12);
                } else set_mese((m) => m - 1);
              }}
              className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground"
            >
              ←
            </button>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest capitalize">
              {get_mese_label(anno, mese)}
            </h3>
            <button
              onClick={() => {
                if (mese === 12) {
                  set_anno((a) => a + 1);
                  set_mese(1);
                } else set_mese((m) => m + 1);
              }}
              className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground"
            >
              →
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs text-muted-foreground">Ore pista</p>
              </div>
              <p className="text-lg font-bold tabular-nums text-primary">{ore_fmt(ore_num)}</p>
            </div>
            <div className="bg-muted/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Euro className="w-3.5 h-3.5 text-success" />
                <p className="text-xs text-muted-foreground">Compenso totale</p>
              </div>
              <p className="text-lg font-bold tabular-nums text-success">CHF {compenso_totale.toFixed(2)}</p>
            </div>
          </div>

          <Field label="Ore pista questo mese">
            <NumInput value={ore_pista} onChange={(v) => set_ore_pista(v)} placeholder="es. 12.5" />
          </Field>
          <Field label="Note">
            <input
              type="text"
              value={note_extra}
              onChange={(e) => set_note_extra(e.target.value)}
              placeholder="Note opzionali..."
              className={input_cls}
            />
          </Field>
          <Button
            onClick={handle_save_ore}
            disabled={saving}
            size="sm"
            className="w-full bg-primary hover:bg-primary/90"
          >
            {saving ? "..." : "💾 Salva ore"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────
const InstructorsPage: React.FC = () => {
  const { t } = useI18n();
  const { data: istruttori = [], isLoading } = use_istruttori();
  const { data: monitori_atleti = [] } = use_atleti_monitori();
  const { data: lezioni = [] } = use_lezioni_private();
  const { data: corsi = [] } = use_corsi();
  const { data: campi = [] } = use_campi();
  const upsert = use_upsert_istruttore();
  const save_disp = use_save_disponibilita();
  const elimina = use_elimina_istruttore();
  const [modal_open, set_modal_open] = useState(false);
  const [selected_modal, set_selected_modal] = useState<any>(null);
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [selected_monitore_id, set_selected_monitore_id] = useState<string | null>(null);
  const [disp_local, set_disp_local] = useState<Record<string, { ora_inizio: string; ora_fine: string }[]>>({});
  const [saving_contratto, set_saving_contratto] = useState(false);

  const istruttori_veri = istruttori.filter((i: any) => !i.ruolo || i.ruolo === "istruttore");
  const monitori = monitori_atleti.filter((a: any) => a.ruolo_pista === "monitore");
  const aiuto_monitori = monitori_atleti.filter((a: any) => a.ruolo_pista === "aiuto_monitore");

  const handle_save = async (data: any) => {
    try {
      await upsert.mutateAsync(data);
      set_modal_open(false);
      toast({ title: data.id ? "✅ Salvato" : "✅ Creato" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    }
  };

  const handle_delete = async () => {
    try {
      await elimina.mutateAsync(selected_modal.id);
      set_modal_open(false);
      set_selected_id(null);
      toast({ title: "🗑️ Eliminato correttamente" });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  const handle_save_contratto = async (data: any) => {
    if (!selected_id) return;
    set_saving_contratto(true);
    try {
      const { error } = await supabase
        .from("istruttori")
        .update({
          tipo_contratto: data.tipo_contratto,
          costo_minuto_lezione_privata: data.costo_minuto_lezione_privata,
          compenso_fisso_mensile: data.compenso_fisso_mensile,
          compenso_fisso_corsi: data.compenso_fisso_corsi,
          costo_orario_corsi: data.costo_orario_corsi,
          costo_orario_lezioni: data.costo_orario_lezioni,
        })
        .eq("id", selected_id);
      if (error) throw error;
      toast({ title: "✅ Compenso salvato" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    } finally {
      set_saving_contratto(false);
    }
  };

  const open_detail = (i: any) => {
    set_selected_id(i.id);
    set_disp_local(JSON.parse(JSON.stringify(i.disponibilita || {})));
  };

  const add_slot = (giorno: string) => {
    set_disp_local((prev) => ({
      ...prev,
      [giorno]: [...(prev[giorno] || []), { ora_inizio: "14:00", ora_fine: "18:00" }],
    }));
  };

  const remove_slot = (giorno: string, idx: number) => {
    set_disp_local((prev) => ({ ...prev, [giorno]: (prev[giorno] || []).filter((_, i) => i !== idx) }));
  };

  const update_slot = (giorno: string, idx: number, field: "ora_inizio" | "ora_fine", value: string) => {
    set_disp_local((prev) => ({
      ...prev,
      [giorno]: (prev[giorno] || []).map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const save_disponibilita = async () => {
    if (!selected_id) return;
    await save_disp.mutateAsync({ istruttore_id: selected_id, disponibilita: disp_local });
    toast({ title: "✅ Disponibilità salvata" });
  };

  const selected = istruttori_veri.find((i: any) => i.id === selected_id);
  const selected_monitore = monitori_atleti.find((a: any) => a.id === selected_monitore_id);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  if (selected_monitore) {
    return <MonitoreDetail monitore={selected_monitore} on_back={() => set_selected_monitore_id(null)} />;
  }

  if (selected) {
    return (
      <>
        {modal_open && (
          <IstruttoreModal
            key={selected_modal?.id || "nuovo"}
            istruttore={selected_modal}
            on_close={() => set_modal_open(false)}
            on_save={handle_save}
            on_delete={selected_modal?.id ? handle_delete : undefined}
            saving={upsert.isPending}
            deleting={elimina.isPending}
          />
        )}
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => set_selected_id(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> {t("istruttori")}
            </Button>
            <div className="flex items-center gap-3">
              {selected.foto_url ? (
                <img
                  src={selected.foto_url}
                  alt={selected.nome}
                  className="w-10 h-10 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {selected.nome[0]}
                  {selected.cognome[0]}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {selected.nome} {selected.cognome}
                </h1>
                <Badge variant="secondary" className="text-xs">
                  Istruttore/Istruttrice
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                set_selected_modal(selected);
                set_modal_open(true);
              }}
            >
              {t("modifica")}
            </Button>
          </div>

          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Informazioni</TabsTrigger>
              <TabsTrigger value="compenso">💶 Compenso</TabsTrigger>
              <TabsTrigger value="ore">⏱️ Ore Lavoro</TabsTrigger>
              <TabsTrigger value="disponibilita">Disponibilità</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-6">
              <div className="bg-card rounded-xl shadow-card p-6 space-y-3 max-w-lg">
                {[
                  { label: t("email"), value: selected.email },
                  { label: t("telefono"), value: selected.telefono },
                  { label: "TAG NFC", value: selected.tag_nfc || "—" },
                  { label: "Prezzo vendita/min", value: `CHF ${(selected.costo_minuto || 0).toFixed(2)}/min` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("stato")}</span>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${selected.stato === "attivo" ? "bg-success" : "bg-muted-foreground"}`}
                  />
                </div>
                {selected.note && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Note</p>
                    <p className="text-sm text-foreground">{selected.note}</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="compenso" className="mt-6">
              <TabCompenso
                istruttore={selected}
                lezioni={lezioni}
                corsi={corsi}
                on_save_contratto={handle_save_contratto}
                saving={saving_contratto}
              />
            </TabsContent>

            <TabsContent value="ore" className="mt-6">
              <TabOreLavoro istruttore={selected} lezioni={lezioni} corsi={corsi} campi={campi} />
            </TabsContent>

            <TabsContent value="disponibilita" className="mt-6">
              <div className="bg-card rounded-xl shadow-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    {t("disponibilita")}
                  </h2>
                  <Button size="sm" onClick={save_disponibilita} disabled={save_disp.isPending}>
                    {save_disp.isPending ? "..." : t("salva")}
                  </Button>
                </div>
                <div className="space-y-4">
                  {GIORNI.map((giorno) => {
                    const slots = disp_local[giorno] || [];
                    return (
                      <div key={giorno} className="border border-border/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">{giorno}</span>
                          <Button variant="ghost" size="sm" onClick={() => add_slot(giorno)} className="h-7 text-xs">
                            <Plus className="w-3 h-3 mr-1" /> Slot
                          </Button>
                        </div>
                        {slots.length === 0 && <p className="text-xs text-muted-foreground">Nessuno slot</p>}
                        {slots.map((s, idx) => (
                          <div key={idx} className="flex items-center gap-2 mb-1">
                            <Input
                              type="time"
                              value={s.ora_inizio}
                              onChange={(e) => update_slot(giorno, idx, "ora_inizio", e.target.value)}
                              className="w-28 h-8 text-xs"
                            />
                            <span className="text-muted-foreground text-xs">—</span>
                            <Input
                              type="time"
                              value={s.ora_fine}
                              onChange={(e) => update_slot(giorno, idx, "ora_fine", e.target.value)}
                              className="w-28 h-8 text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => remove_slot(giorno, idx)}
                              className="h-7 w-7 p-0 text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </>
    );
  }

  return (
    <>
      {modal_open && (
        <IstruttoreModal
          key={selected_modal?.id || "nuovo"}
          istruttore={selected_modal}
          on_close={() => set_modal_open(false)}
          on_save={handle_save}
          on_delete={selected_modal?.id ? handle_delete : undefined}
          saving={upsert.isPending}
          deleting={elimina.isPending}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("istruttori")}</h1>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => {
              set_selected_modal(null);
              set_modal_open(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> {t("nuovo_istruttore")}
          </Button>
        </div>

        {/* Istruttori */}
        {istruttori_veri.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
              Istruttori/Istruttrice ({istruttori_veri.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {istruttori_veri.map((i: any) => (
                <div
                  key={i.id}
                  onClick={() => open_detail(i)}
                  className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {i.foto_url ? (
                      <img src={i.foto_url} alt={i.nome} className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {i.nome[0]}
                        {i.cognome[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-foreground">
                        {i.nome} {i.cognome}
                      </p>
                      <p className="text-xs text-muted-foreground">{i.email}</p>
                    </div>
                    <span
                      className={`ml-auto inline-block w-2 h-2 rounded-full ${i.stato === "attivo" ? "bg-success" : "bg-muted-foreground"}`}
                    />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vendita/min</span>
                      <span className="text-foreground tabular-nums">CHF {(i.costo_minuto || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Costo/h club</span>
                      <span className="text-foreground tabular-nums text-xs">
                        L: CHF {(i.costo_orario_lezioni || 0).toFixed(2)} · C: CHF{" "}
                        {(i.costo_orario_corsi || 0).toFixed(2)}
                      </span>
                    </div>
                    {i.tag_nfc && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NFC</span>
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          📡 {i.tag_nfc}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      {t("disponibilita")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {GIORNI.map((d) => (
                        <Badge
                          key={d}
                          variant={i.disponibilita[d]?.length > 0 ? "default" : "secondary"}
                          className="text-[10px] px-1.5"
                        >
                          {d.slice(0, 3)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monitori */}
        {monitori.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
              Monitori/Monitrici ({monitori.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {monitori.map((m: any) => (
                <div
                  key={m.id}
                  onClick={() => set_selected_monitore_id(m.id)}
                  className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {m.foto_url ? (
                      <img src={m.foto_url} alt={m.nome} className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {m.nome[0]}
                        {m.cognome[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-foreground">
                        {m.nome} {m.cognome}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.percorso_amatori || m.livello_amatori}</p>
                    </div>
                    <span
                      className={`ml-auto inline-block w-2 h-2 rounded-full ${m.attivo ? "bg-success" : "bg-muted-foreground"}`}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Compenso orario</span>
                    <span className="text-foreground tabular-nums">
                      CHF {(m.compenso_orario_pista || 0).toFixed(2)}/h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aiuto Monitori */}
        {aiuto_monitori.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
              Aiuto Monitori/Monitrici ({aiuto_monitori.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {aiuto_monitori.map((m: any) => (
                <div
                  key={m.id}
                  onClick={() => set_selected_monitore_id(m.id)}
                  className="bg-card rounded-xl shadow-card p-5 hover:shadow-card-hover transition-shadow cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {m.foto_url ? (
                      <img src={m.foto_url} alt={m.nome} className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {m.nome[0]}
                        {m.cognome[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-foreground">
                        {m.nome} {m.cognome}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.percorso_amatori || m.livello_amatori}</p>
                    </div>
                    <span
                      className={`ml-auto inline-block w-2 h-2 rounded-full ${m.attivo ? "bg-success" : "bg-muted-foreground"}`}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Compenso orario</span>
                    <span className="text-foreground tabular-nums">
                      CHF {(m.compenso_orario_pista || 0).toFixed(2)}/h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {istruttori_veri.length === 0 && monitori.length === 0 && aiuto_monitori.length === 0 && (
          <div className="bg-card rounded-xl shadow-card p-12 text-center text-muted-foreground">
            <p className="text-sm">Nessun istruttore o monitore registrato.</p>
            <p className="text-xs mt-1">
              Clicca "Nuovo istruttore" per aggiungerne uno, oppure vai in Atleti per impostare il ruolo pista.
            </p>
          </div>
        )}

        {monitori.length === 0 && aiuto_monitori.length === 0 && istruttori_veri.length > 0 && (
          <div className="flex items-start gap-2 p-4 bg-muted/30 rounded-xl border border-border">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Per aggiungere monitori o aiuto monitori, vai nella scheda <strong>Atleti</strong> e imposta il campo{" "}
              <strong>Ruolo in pista</strong> su "Monitore" o "Aiuto monitore".
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default InstructorsPage;
