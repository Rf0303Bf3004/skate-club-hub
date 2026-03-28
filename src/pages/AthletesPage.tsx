import React, { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { use_atleti } from "@/hooks/use-supabase-data";
import { use_upsert_atleta, use_elimina_atleta } from "@/hooks/use-supabase-mutations";
import { calculate_age } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Shield, X, Trash2, Upload } from "lucide-react";
import AtletaDetail from "@/components/AtletaDetail";
import { toast } from "@/hooks/use-toast";
import { supabase, DEMO_CLUB_ID } from "@/lib/supabase";

const LIVELLI_COMUNI = ["Pulcini", "Stellina 1", "Stellina 2", "Stellina 3", "Stellina 4"];

const LIVELLI_CARRIERA = ["Interbronzo", "Bronzo", "Interargento", "Argento", "Interoro", "Oro"];

const TUTTI_LIVELLI = [...LIVELLI_COMUNI, ...LIVELLI_CARRIERA];

// ─── Field ─────────────────────────────────────────────────
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

const input_cls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

// ─── Carriera Badge ────────────────────────────────────────
const CarrieraBadge: React.FC<{ atleta: any }> = ({ atleta }) => {
  const ha_artistica = !!atleta.carriera_artistica;
  const ha_stile = !!atleta.carriera_stile;
  if (!ha_artistica && !ha_stile) return <span className="text-muted-foreground/40">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {ha_artistica && (
        <Badge className="bg-purple-100 text-purple-800 text-xs font-medium border-0 w-fit">
          Artistica: {atleta.carriera_artistica}
        </Badge>
      )}
      {ha_stile && (
        <Badge className="bg-blue-100 text-blue-800 text-xs font-medium border-0 w-fit">
          Stile: {atleta.carriera_stile}
        </Badge>
      )}
    </div>
  );
};

// ─── Livello Badge ─────────────────────────────────────────
const LivelloBadge: React.FC<{ atleta: any }> = ({ atleta }) => {
  const ha_carriera = !!(atleta.carriera_artistica || atleta.carriera_stile);
  if (ha_carriera) return null;
  return (
    <Badge variant="secondary" className="text-xs">
      {atleta.percorso_amatori || atleta.livello_amatori}
    </Badge>
  );
};

// ─── Modal nuovo/modifica atleta ───────────────────────────
const AtletaModal: React.FC<{
  atleta?: any;
  on_close: () => void;
  on_save: (data: any) => Promise<void>;
  on_delete?: () => Promise<void>;
  saving: boolean;
  deleting: boolean;
}> = ({ atleta, on_close, on_save, on_delete, saving, deleting }) => {
  const carriera_attiva = atleta?.percorso_amatori === "Stellina 4" || atleta?.livello_amatori === "Stellina 4";

  const [form, set_form] = useState({
    nome: atleta?.nome || "",
    cognome: atleta?.cognome || "",
    data_nascita: atleta?.data_nascita?.split("T")[0] || "",
    percorso_amatori: atleta?.percorso_amatori || atleta?.livello_amatori || "Pulcini",
    carriera_artistica: atleta?.carriera_artistica || "",
    carriera_stile: atleta?.carriera_stile || "",
    ore_pista_stagione: atleta?.ore_pista_stagione || 0,
    atleta_federazione: atleta?.atleta_federazione || false,
    tag_nfc: atleta?.tag_nfc || "",
    genitore1_nome: atleta?.genitore1_nome || atleta?.genitore_1?.nome || "",
    genitore1_cognome: atleta?.genitore1_cognome || atleta?.genitore_1?.cognome || "",
    genitore1_telefono: atleta?.genitore1_telefono || atleta?.genitore_1?.telefono || "",
    genitore1_email: atleta?.genitore1_email || atleta?.genitore_1?.email || "",
    note: atleta?.note || "",
    attivo: atleta?.attivo !== false,
    foto_url: atleta?.foto_url || "",
    disco_in_preparazione: atleta?.disco_in_preparazione || "",
    disco_url: atleta?.disco_url || "",
  });
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [uploading_foto, set_uploading_foto] = useState(false);
  const [uploading_disco, set_uploading_disco] = useState(false);

  const set_val = useCallback((k: string, v: any) => {
    set_form((p) => ({ ...p, [k]: v }));
  }, []);

  const is_carriera_attiva = form.percorso_amatori === "Stellina 4";

  const handle_foto_upload = async (file: File) => {
    set_uploading_foto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${DEMO_CLUB_ID}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("foto-atleti").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("foto-atleti").getPublicUrl(path);
      set_val("foto_url", data.publicUrl);
      toast({ title: "✅ Foto caricata" });
    } catch (err: any) {
      toast({ title: "Errore upload foto", description: err?.message, variant: "destructive" });
    } finally {
      set_uploading_foto(false);
    }
  };

  const handle_disco_upload = async (file: File) => {
    set_uploading_disco(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${DEMO_CLUB_ID}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("dischi-audio").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("dischi-audio").getPublicUrl(path);
      set_val("disco_url", data.publicUrl);
      toast({ title: "✅ Disco caricato" });
    } catch (err: any) {
      toast({ title: "Errore upload disco", description: err?.message, variant: "destructive" });
    } finally {
      set_uploading_disco(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{atleta?.id ? "Modifica atleta" : "Nuova atleta"}</h2>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Foto */}
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

          {/* Nome e Cognome */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" required>
              <input value={form.nome} onChange={(e) => set_val("nome", e.target.value)} className={input_cls} />
            </Field>
            <Field label="Cognome" required>
              <input value={form.cognome} onChange={(e) => set_val("cognome", e.target.value)} className={input_cls} />
            </Field>
          </div>

          <Field label="Data di nascita" required>
            <input
              type="date"
              value={form.data_nascita}
              onChange={(e) => set_val("data_nascita", e.target.value)}
              className={input_cls}
            />
          </Field>

          {/* Percorso comune */}
          <Field label="Percorso comune">
            <select
              value={form.percorso_amatori}
              onChange={(e) => {
                const v = e.target.value;
                set_form((p) => ({
                  ...p,
                  percorso_amatori: v,
                  carriera_artistica: v !== "Stellina 4" ? "" : p.carriera_artistica,
                  carriera_stile: v !== "Stellina 4" ? "" : p.carriera_stile,
                  atleta_federazione: v !== "Stellina 4" ? false : p.atleta_federazione,
                }));
              }}
              className={input_cls}
            >
              {LIVELLI_COMUNI.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>

          {/* Carriera Artistica */}
          <Field label="Carriera Artistica">
            <select
              value={form.carriera_artistica}
              onChange={(e) => set_val("carriera_artistica", e.target.value)}
              disabled={!is_carriera_attiva}
              className={`${input_cls} ${!is_carriera_attiva ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <option value="">Nessuna</option>
              {LIVELLI_CARRIERA.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {!is_carriera_attiva && (
              <p className="text-xs text-muted-foreground italic mt-1">Si sblocca dopo Stellina 4</p>
            )}
          </Field>

          {/* Carriera Stile */}
          <Field label="Carriera Stile">
            <select
              value={form.carriera_stile}
              onChange={(e) => set_val("carriera_stile", e.target.value)}
              disabled={!is_carriera_attiva}
              className={`${input_cls} ${!is_carriera_attiva ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <option value="">Nessuna</option>
              {LIVELLI_CARRIERA.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {!is_carriera_attiva && (
              <p className="text-xs text-muted-foreground italic mt-1">Si sblocca dopo Stellina 4</p>
            )}
          </Field>

          <Field label="Ore pista stagione">
            <input
              type="number"
              min="0"
              value={form.ore_pista_stagione}
              onChange={(e) => set_val("ore_pista_stagione", Number(e.target.value))}
              className={input_cls}
            />
          </Field>

          <Field label="TAG NFC">
            <input
              value={form.tag_nfc}
              onChange={(e) => set_val("tag_nfc", e.target.value)}
              placeholder="es. 04:A3:B2:C1:D0"
              className={input_cls}
            />
          </Field>

          <Field label="Disco in preparazione">
            <input
              value={form.disco_in_preparazione}
              onChange={(e) => set_val("disco_in_preparazione", e.target.value)}
              placeholder="es. Romeo e Giulietta - Prokofiev"
              className={input_cls}
            />
          </Field>

          <Field label="File disco audio">
            <div className="flex items-center gap-3">
              {form.disco_url && <audio controls src={form.disco_url} className="h-8 flex-1" />}
              <label
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-muted/30 text-sm text-muted-foreground transition-colors ${uploading_disco ? "opacity-50 pointer-events-none" : ""}`}
              >
                <Upload className="w-4 h-4" />
                {uploading_disco ? "Caricamento..." : form.disco_url ? "Sostituisci" : "Carica audio"}
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handle_disco_upload(e.target.files[0])}
                />
              </label>
            </div>
          </Field>

          {/* Genitore 1 */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Genitore 1</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome">
                <input
                  value={form.genitore1_nome}
                  onChange={(e) => set_val("genitore1_nome", e.target.value)}
                  className={input_cls}
                />
              </Field>
              <Field label="Cognome">
                <input
                  value={form.genitore1_cognome}
                  onChange={(e) => set_val("genitore1_cognome", e.target.value)}
                  className={input_cls}
                />
              </Field>
              <Field label="Telefono">
                <input
                  value={form.genitore1_telefono}
                  onChange={(e) => set_val("genitore1_telefono", e.target.value)}
                  className={input_cls}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.genitore1_email}
                  onChange={(e) => set_val("genitore1_email", e.target.value)}
                  className={input_cls}
                />
              </Field>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
            <input
              type="checkbox"
              id="fed_check"
              checked={form.atleta_federazione}
              onChange={(e) => set_val("atleta_federazione", e.target.checked)}
              className="w-4 h-4 accent-primary"
              disabled={!is_carriera_attiva}
            />
            <label
              htmlFor="fed_check"
              className={`text-sm font-medium cursor-pointer ${!is_carriera_attiva ? "text-muted-foreground" : "text-foreground"}`}
            >
              Atleta federazione
            </label>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
            <input
              type="checkbox"
              id="attivo_check"
              checked={form.attivo}
              onChange={(e) => set_val("attivo", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="attivo_check" className="text-sm font-medium text-foreground cursor-pointer">
              Atleta attiva
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
            <Button
              onClick={() => on_save({ ...form, id: atleta?.id })}
              disabled={saving}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {saving ? "..." : "💾 Salva"}
            </Button>
          </div>
          {atleta?.id && !confirm_delete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set_confirm_delete(true)}
              className="w-full text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Elimina atleta
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
const AthletesPage: React.FC = () => {
  const { t } = useI18n();
  const { data: atleti = [], isLoading } = use_atleti();
  const upsert = use_upsert_atleta();
  const elimina = use_elimina_atleta();
  const [search, set_search] = useState("");
  const [level_filter, set_level_filter] = useState("tutti");
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [modal_open, set_modal_open] = useState(false);
  const [selected_atleta, set_selected_atleta] = useState<any>(null);

  const filtered = atleti.filter((a: any) => {
    const name_match = `${a.nome} ${a.cognome}`.toLowerCase().includes(search.toLowerCase());
    const livello = a.percorso_amatori || a.livello_amatori || "";
    const level_match = level_filter === "tutti" || livello === level_filter;
    return name_match && level_match;
  });

  const handle_save = async (data: any) => {
    try {
      await upsert.mutateAsync(data);
      set_modal_open(false);
      toast({ title: data.id ? "✅ Atleta aggiornata" : "✅ Atleta creata" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    }
  };

  const handle_delete = async () => {
    try {
      await elimina.mutateAsync(selected_atleta.id);
      set_modal_open(false);
      set_selected_id(null);
      toast({ title: "🗑️ Atleta eliminata correttamente" });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  if (selected_id) {
    const atleta = atleti.find((a: any) => a.id === selected_id);
    if (atleta) return <AtletaDetail atleta={atleta} on_back={() => set_selected_id(null)} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      {modal_open && (
        <AtletaModal
          key={selected_atleta?.id || "nuovo"}
          atleta={selected_atleta}
          on_close={() => set_modal_open(false)}
          on_save={handle_save}
          on_delete={selected_atleta?.id ? handle_delete : undefined}
          saving={upsert.isPending}
          deleting={elimina.isPending}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("atleti")}</h1>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => {
              set_selected_atleta(null);
              set_modal_open(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> {t("nuovo_atleta")}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("cerca")}
              value={search}
              onChange={(e) => set_search(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={level_filter} onValueChange={set_level_filter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("livello")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti i livelli</SelectItem>
              {TUTTI_LIVELLI.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("nome")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t("eta")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Livello / Carriera
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    {t("ore_pista")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    NFC
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    {t("stato")}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Nessuna atleta trovata.
                    </td>
                  </tr>
                ) : (
                  filtered.map((a: any) => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 cursor-pointer" onClick={() => set_selected_id(a.id)}>
                        <div className="flex items-center gap-3">
                          {a.foto_url ? (
                            <img src={a.foto_url} alt={a.nome} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                              {a.nome[0]}
                              {a.cognome[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-foreground">
                              {a.nome} {a.cognome}
                            </p>
                            {a.atleta_federazione && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Shield className="w-3 h-3 text-accent" />
                                <span className="text-xs text-accent">{t("atleta_federazione")}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell cursor-pointer"
                        onClick={() => set_selected_id(a.id)}
                      >
                        {calculate_age(a.data_nascita)}
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => set_selected_id(a.id)}>
                        <LivelloBadge atleta={a} />
                        <CarrieraBadge atleta={a} />
                      </td>
                      <td
                        className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell cursor-pointer"
                        onClick={() => set_selected_id(a.id)}
                      >
                        {a.ore_pista_stagione}h
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {a.tag_nfc ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            📡 NFC
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-center hidden lg:table-cell cursor-pointer"
                        onClick={() => set_selected_id(a.id)}
                      >
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${a.stato === "attivo" ? "bg-success" : "bg-muted-foreground"}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            set_selected_atleta(a);
                            set_modal_open(true);
                          }}
                          className="text-xs h-7"
                        >
                          Modifica
                        </Button>
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

export default AthletesPage;
