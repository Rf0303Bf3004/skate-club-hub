import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { use_atleti, use_club, use_adesioni_atleta, is_atleta_attivo_oggi } from "@/hooks/use-supabase-data";
import { use_upsert_atleta, use_elimina_atleta } from "@/hooks/use-supabase-mutations";
import { calculate_age } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Shield, X, Trash2, Upload, ArrowLeft, Printer, Mail } from "lucide-react";
import AtletaDetail from "@/components/AtletaDetail";
import AthleteBadges from "@/components/AthleteBadges";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";
import InvitoGenitoreModal from "@/components/InvitoGenitoreModal";
import DateInput from "@/components/forms/DateInput";
import {
  CATEGORIE,
  LIVELLI_AMATORI,
  LIVELLI_CARRIERA as LIVELLI_CARRIERA_NUOVI,
  get_categoria_label,
  get_livello_display,
  get_pillole_discipline,
  type Categoria,
} from "@/lib/atleta-livello";
import { SelectLivello } from "@/components/ui/select-livello";

const LIVELLI_COMUNI = ["Pulcini", "Stellina 1", "Stellina 2", "Stellina 3", "Stellina 4"];

const LIVELLI_CARRIERA = ["Interbronzo", "Bronzo", "Interargento", "Argento", "Interoro", "Oro"];

// Dropdown completo per "Livello attuale" e "Livello in preparazione"
const LIVELLI_TUTTI = [...LIVELLI_COMUNI, ...LIVELLI_CARRIERA];

const TUTTI_LIVELLI = [...LIVELLI_COMUNI, ...LIVELLI_CARRIERA];

const NAZIONI_INDIRIZZO = [
  { value: "CH", label: "🇨🇭 Svizzera (CH)" },
  { value: "IT", label: "🇮🇹 Italia (IT)" },
  { value: "DE", label: "🇩🇪 Germania (DE)" },
  { value: "FR", label: "🇫🇷 Francia (FR)" },
  { value: "AT", label: "🇦🇹 Austria (AT)" },
  { value: "LI", label: "🇱🇮 Liechtenstein (LI)" },
  { value: "ES", label: "🇪🇸 Spagna (ES)" },
  { value: "PT", label: "🇵🇹 Portogallo (PT)" },
];

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

// ─── Carriera Badge — pillole ART/STI sul nuovo modello ───
const CarrieraBadge: React.FC<{ atleta: any }> = ({ atleta }) => {
  const pillole = get_pillole_discipline(atleta);
  if (pillole.length === 0) return null;
  const pill = "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset";
  return (
    <span className="inline-flex items-center gap-1 align-middle flex-wrap">
      {pillole.map((p) =>
        p.label === "ART" ? (
          <span
            key={p.label}
            className={`${pill} bg-purple-50 text-purple-700 ring-purple-200`}
            title={`Carriera Artistica: ${p.value}`}
          >
            ART {p.value}
          </span>
        ) : (
          <span
            key={p.label}
            className={`${pill} bg-blue-50 text-blue-700 ring-blue-200`}
            title={`Carriera Stile: ${p.value}`}
          >
            STI {p.value}
          </span>
        ),
      )}
    </span>
  );
};

// ─── Livello Badge — usa get_livello_display dal nuovo modello ───
const LivelloBadge: React.FC<{ atleta: any }> = ({ atleta }) => {
  const lv = get_livello_display(atleta);
  if (!lv || lv === "—") return <span className="text-muted-foreground/40">—</span>;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge variant="secondary" className="text-xs">
        {lv}
      </Badge>
      <CarrieraBadge atleta={atleta} />
    </div>
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
  const livello_iniziale =
    atleta?.livello_attuale || atleta?.percorso_amatori || atleta?.livello_amatori || "Pulcini";

  const [form, set_form] = useState({
    nome: atleta?.nome || "",
    cognome: atleta?.cognome || "",
    data_nascita: atleta?.data_nascita?.split("T")[0] || "",
    livello_attuale: livello_iniziale,
    livello_in_preparazione: atleta?.livello_in_preparazione || "",
    carriera_artistica: atleta?.carriera_artistica || "",
    carriera_stile: atleta?.carriera_stile || "",
    ore_pista_stagione: atleta?.ore_pista_stagione || 0,
    agonista: atleta?.agonista || atleta?.atleta_federazione || false,
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
    licenza_sis_numero: atleta?.licenza_sis_numero || "",
    licenza_sis_categoria: atleta?.licenza_sis_categoria || "",
    licenza_sis_disciplina: atleta?.licenza_sis_disciplina || "",
    licenza_sis_validita_a: atleta?.licenza_sis_validita_a?.split("T")[0] || "",
    indirizzo_via: atleta?.indirizzo_via || "",
    indirizzo_nap: atleta?.indirizzo_nap || "",
    indirizzo_localita: atleta?.indirizzo_localita || "",
    indirizzo_nazione: atleta?.indirizzo_nazione || "CH",
    telefono: atleta?.telefono || "",
  });
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [uploading_foto, set_uploading_foto] = useState(false);
  const [uploading_disco, set_uploading_disco] = useState(false);

  const set_val = useCallback((k: string, v: any) => {
    set_form((p) => ({ ...p, [k]: v }));
  }, []);

  

  const handle_foto_upload = async (file: File) => {
    set_uploading_foto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${get_current_club_id()}/${Date.now()}.${ext}`;
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
      const path = `${get_current_club_id()}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("dischi-musicali").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("dischi-musicali").getPublicUrl(path);
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
            <DateInput value={form.data_nascita} onChange={(v) => set_val("data_nascita", v)} />
          </Field>

          {/* Livello attuale + Livello in preparazione */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <Field label="Livello attuale">
              <SelectLivello
                value={form.livello_attuale}
                onChange={(v) => set_val("livello_attuale", v ?? "Pulcini")}
                fase="comune"
                allowNull={false}
              />
            </Field>
            <Field label="Livello in preparazione">
              <SelectLivello
                value={form.livello_in_preparazione || null}
                onChange={(v) => set_val("livello_in_preparazione", v ?? "")}
                fase="comune"
                allowNull={true}
                nullLabel="— Nessuno —"
              />
            </Field>
          </div>

          {/* Status atleta: 3 checkbox separati */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
              <input
                type="checkbox"
                id="attivo_check_top"
                checked={form.attivo}
                onChange={(e) => set_val("attivo", e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="attivo_check_top" className="cursor-pointer">
                <span className="text-sm font-medium text-foreground">Atleta attiva</span>
                <span className="block text-xs text-muted-foreground">Iscritta e partecipa alle attività del club</span>
              </label>
            </div>
            <div className="flex items-start gap-3 px-3 py-2 bg-muted/30 rounded-lg">
              <input
                type="checkbox"
                id="ago_check"
                checked={form.agonista}
                onChange={(e) => {
                  const v = e.target.checked;
                  // Disattivare agonista disattiva anche atleta_federazione
                  set_form((p) => ({ ...p, agonista: v, atleta_federazione: v ? p.atleta_federazione : false }));
                }}
                className="w-4 h-4 mt-0.5 accent-primary"
              />
              <label htmlFor="ago_check" className="cursor-pointer">
                <span className="text-sm font-medium text-foreground">Agonista</span>
                <span className="block text-xs text-muted-foreground">Partecipa a gare federali con licenza agonistica</span>
              </label>
            </div>
            <div className="flex items-start gap-3 px-3 py-2 bg-muted/30 rounded-lg">
              <input
                type="checkbox"
                id="fed_check"
                checked={form.atleta_federazione}
                onChange={(e) => {
                  const v = e.target.checked;
                  // Attivare federazione attiva anche agonista
                  set_form((p) => ({ ...p, atleta_federazione: v, agonista: v ? true : p.agonista }));
                }}
                className="w-4 h-4 mt-0.5 accent-primary"
              />
              <label htmlFor="fed_check" className="cursor-pointer">
                <span className="text-sm font-medium text-foreground">Atleta di Federazione</span>
                <span className="block text-xs text-muted-foreground">Rappresenta il Cantone nelle gare federali</span>
              </label>
            </div>
          </div>

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

          {(form.agonista || form.atleta_federazione) && (
            <>
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
            </>
          )}

          {/* Dati anagrafici extra */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Dati anagrafici</p>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Telefono">
                <input value={form.telefono} onChange={(e) => set_val("telefono", e.target.value)} className={input_cls} />
              </Field>
            </div>
            <div className="mt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Indirizzo di residenza</p>
              <Field label="Via">
                <input
                  value={form.indirizzo_via}
                  onChange={(e) => set_val("indirizzo_via", e.target.value)}
                  className={input_cls}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,120px)_minmax(0,1fr)_minmax(0,180px)]">
                <Field label="NAP">
                  <input
                    value={form.indirizzo_nap}
                    onChange={(e) => set_val("indirizzo_nap", e.target.value)}
                    maxLength={10}
                    className={input_cls}
                  />
                </Field>
                <Field label="Località">
                  <input
                    value={form.indirizzo_localita}
                    onChange={(e) => set_val("indirizzo_localita", e.target.value)}
                    className={input_cls}
                  />
                </Field>
                <Field label="Nazione">
                  <Select value={form.indirizzo_nazione} onValueChange={(v) => set_val("indirizzo_nazione", v)}>
                    <SelectTrigger className="h-10 w-full rounded-lg">
                      <SelectValue placeholder="Seleziona nazione" />
                    </SelectTrigger>
                    <SelectContent>
                      {NAZIONI_INDIRIZZO.map((nazione) => (
                        <SelectItem key={nazione.value} value={nazione.value}>
                          {nazione.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </div>

          {/* Licenza SIS */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Licenza Swiss Ice Skating</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="N. Licenza">
                <input value={form.licenza_sis_numero} onChange={(e) => set_val("licenza_sis_numero", e.target.value)} placeholder="es. SIS-12345" className={input_cls} />
              </Field>
              <Field label="Categoria">
                <input value={form.licenza_sis_categoria} onChange={(e) => set_val("licenza_sis_categoria", e.target.value)} className={input_cls} />
              </Field>
              <Field label="Disciplina">
                <input value={form.licenza_sis_disciplina} onChange={(e) => set_val("licenza_sis_disciplina", e.target.value)} className={input_cls} />
              </Field>
              <Field label="Validità fino al">
                <input type="date" value={form.licenza_sis_validita_a} onChange={(e) => set_val("licenza_sis_validita_a", e.target.value)} className={input_cls} />
              </Field>
            </div>
          </div>

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
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const { data: atleti = [], isLoading } = use_atleti();
  const upsert = use_upsert_atleta();
  const elimina = use_elimina_atleta();
  const [search, set_search] = useState("");
  const [level_filter, set_level_filter] = useState("tutti");
  const [status_filter, set_status_filter] = useState("tutti");
  const [selected_id, set_selected_id] = useState<string | null>(params.id ?? null);
  useEffect(() => { if (params.id && params.id !== selected_id) set_selected_id(params.id); }, [params.id]);
  const [modal_open, set_modal_open] = useState(false);
  const [selected_atleta, set_selected_atleta] = useState<any>(null);
  const [scheda_id, set_scheda_id] = useState<string | null>(null);
  const [invito_atleta, set_invito_atleta] = useState<any>(null);
  const { data: club } = use_club();
  const { data: adesioni = [] } = use_adesioni_atleta();

  // Banner: atleti senza iscrizioni nella stagione corrente
  const { data: non_iscritti_count = 0 } = useQuery({
    queryKey: ["atleti-non-iscritti", get_current_club_id()],
    queryFn: async () => {
      const club_id = get_current_club_id();
      // Get active season
      const { data: stagione } = await supabase
        .from("stagioni").select("id").eq("club_id", club_id).eq("attiva", true).maybeSingle();
      if (!stagione) return 0;
      // Get active athletes
      const { data: attivi } = await supabase
        .from("atleti").select("id").eq("club_id", club_id).eq("attivo", true);
      if (!attivi?.length) return 0;
      // Get courses of this season
      const { data: corsi } = await supabase
        .from("corsi").select("id").eq("club_id", club_id).eq("stagione_id", stagione.id);
      if (!corsi?.length) return attivi.length;
      const corsi_ids = corsi.map((c: any) => c.id);
      // Get athletes with at least one active enrollment in those courses
      const { data: iscrizioni } = await supabase
        .from("iscrizioni_corsi").select("atleta_id").in("corso_id", corsi_ids).eq("attiva", true);
      const iscritti = new Set((iscrizioni || []).map((i: any) => i.atleta_id));
      return attivi.filter((a: any) => !iscritti.has(a.id)).length;
    },
  });

  // Conteggi per categoria (nuovo modello)
  const pulcini_count = useMemo(
    () => atleti.filter((a: any) => (a.categoria ?? "pulcini") === "pulcini").length,
    [atleti],
  );

  const amatori_breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of LIVELLI_AMATORI) counts[l] = 0;
    for (const a of atleti) {
      if (a.categoria === "amatori" && a.livello_amatori && counts[a.livello_amatori] !== undefined) {
        counts[a.livello_amatori]++;
      }
    }
    return counts;
  }, [atleti]);

  // Per la sezione Artistica sommiamo, per ogni livello carriera, chi ce l'ha
  // valorizzato in livello_artistica O in livello_stile (somma logica per livello).
  const artistica_breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of LIVELLI_CARRIERA_NUOVI) counts[l] = 0;
    for (const a of atleti) {
      if (a.categoria !== "artistica") continue;
      if (a.livello_artistica && counts[a.livello_artistica] !== undefined) counts[a.livello_artistica]++;
      if (a.livello_stile && counts[a.livello_stile] !== undefined) counts[a.livello_stile]++;
    }
    return counts;
  }, [atleti]);

  const [card_filter, set_card_filter] = useState<
    | { sezione: "pulcini" }
    | { sezione: "amatori"; livello: string }
    | { sezione: "artistica"; livello: string }
    | null
  >(null);

  // Filtro a cascata: prima categoria, poi (se categoria scelta) livello specifico
  const [categoria_filter, set_categoria_filter] = useState<"tutti" | Categoria>("tutti");

  const filtered = atleti.filter((a: any) => {
    const name_match = `${a.nome} ${a.cognome}`.toLowerCase().includes(search.toLowerCase());
    const status_match =
      status_filter === "tutti" ||
      (status_filter === "scuola" && !a.agonista && !a.atleta_federazione) ||
      (status_filter === "agoniste" && (a.agonista || a.atleta_federazione)) ||
      (status_filter === "federazione" && a.atleta_federazione);
    if (!status_match) return false;
    if (!name_match) return false;

    // Filtro card click (precedenza alta)
    if (card_filter) {
      if (card_filter.sezione === "pulcini") {
        return (a.categoria ?? "pulcini") === "pulcini";
      }
      if (card_filter.sezione === "amatori") {
        return a.categoria === "amatori" && a.livello_amatori === card_filter.livello;
      }
      if (card_filter.sezione === "artistica") {
        return (
          a.categoria === "artistica" &&
          (a.livello_artistica === card_filter.livello || a.livello_stile === card_filter.livello)
        );
      }
    }

    // Filtro a cascata categoria → livello
    if (categoria_filter !== "tutti") {
      const cat = (a.categoria ?? "pulcini") as Categoria;
      if (cat !== categoria_filter) return false;
      if (level_filter !== "tutti") {
        if (categoria_filter === "pulcini") return true; // niente sottolivelli
        if (categoria_filter === "amatori") return a.livello_amatori === level_filter;
        if (categoria_filter === "artistica") {
          return a.livello_artistica === level_filter || a.livello_stile === level_filter;
        }
      }
      return true;
    }

    return true;
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

  if (scheda_id) {
    const atleta = atleti.find((a: any) => a.id === scheda_id);
    if (atleta) {
      const codice = (atleta.cognome + atleta.nome + "0001").toUpperCase().replace(/\s/g, "").slice(0, 16);
      const qr_src = "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=" + encodeURIComponent(codice);
      return (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3 print:hidden">
            <Button variant="ghost" size="sm" onClick={() => set_scheda_id(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Indietro
            </Button>
            {atleta.genitore1_email && (
              <Button size="sm" variant="outline" onClick={() => set_invito_atleta(atleta)}>
                <Mail className="w-4 h-4 mr-2" /> Genera invito genitore
              </Button>
            )}
            <Button size="sm" onClick={() => window.print()} className="ml-auto">
              <Printer className="w-4 h-4 mr-2" /> Stampa / Salva PDF
            </Button>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden border border-border max-w-2xl mx-auto print:max-w-full print:border-0 print:rounded-none">
            {/* Header */}
            <div className="bg-[hsl(var(--primary))] px-6 py-4 flex items-center gap-4">
              <div className="bg-[hsl(var(--accent))] w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">C</div>
              <div>
                <p className="text-primary-foreground font-semibold text-base">{club?.nome || "Club"}</p>
                <p className="text-primary-foreground/50 text-xs">Scheda anagrafica atleta</p>
              </div>
              <span className="ml-auto text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-accent/20 text-accent">
                {is_atleta_attivo_oggi(adesioni, atleta.id) ? "Attivo" : "Inattivo"}
              </span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border">
              {/* Left 2/3 */}
              <div className="col-span-2 p-6 space-y-5">
                <div className="flex items-center gap-4">
                  {atleta.foto_url ? (
                    <img src={atleta.foto_url} className="w-16 h-16 rounded-full object-cover border-2 border-accent/20" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-2xl">
                      {atleta.nome?.[0]}{atleta.cognome?.[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-xl font-semibold text-foreground inline-flex items-center gap-2 flex-wrap">
                      <span>{atleta.nome} {atleta.cognome}</span>
                      <AthleteBadges agonista={atleta.agonista} atleta_federazione={atleta.atleta_federazione} />
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Nato/a il {atleta.data_nascita ? new Date(atleta.data_nascita).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                    </p>
                    <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/10 text-accent">
                      {atleta.percorso_amatori || atleta.carriera_artistica || "—"}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Dati personali</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([["Telefono", atleta.telefono], ["Indirizzo", [atleta.indirizzo_via, atleta.indirizzo_nap, atleta.indirizzo_localita].filter(Boolean).join(" ") || atleta.indirizzo]] as [string, string | undefined][]).map(([l, v]) => (
                      <div key={l} className="bg-muted/30 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">{l}</p>
                        <p className="text-sm font-medium text-foreground">{v || <span className="text-muted-foreground/40 italic">—</span>}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Genitore / Tutore</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([["Nome", atleta.genitore1_nome ? atleta.genitore1_nome + " " + atleta.genitore1_cognome : null], ["Email", atleta.genitore1_email], ["Telefono", atleta.genitore1_telefono]] as [string, string | null][]).map(([l, v]) => (
                      <div key={l} className="bg-muted/30 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">{l}</p>
                        <p className="text-sm font-medium text-foreground">{v || <span className="text-muted-foreground/40 italic">—</span>}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {atleta.licenza_sis_numero && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Licenza Swiss Ice Skating</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([["N. Licenza", atleta.licenza_sis_numero], ["Categoria", atleta.licenza_sis_categoria], ["Disciplina", atleta.licenza_sis_disciplina], ["Validità", atleta.licenza_sis_validita_a ? "fino al " + new Date(atleta.licenza_sis_validita_a).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : null]] as [string, string | null][]).map(([l, v]) => (
                        <div key={l} className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                          <p className="text-xs text-blue-400">{l}</p>
                          <p className="text-sm font-medium text-blue-800">{v || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {atleta.tag_nfc && (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-green-700 text-sm">📡</span>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 font-medium">Tag NFC</p>
                      <p className="text-sm font-bold text-green-800 font-mono">{atleta.tag_nfc}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right 1/3 */}
              <div className="p-5 flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">App Ice Arena</p>
                  <img src={qr_src} alt="QR Code" className="w-28 h-28 rounded-xl border border-border mx-auto" />
                  <p className="text-xs text-muted-foreground mt-2 leading-snug">Scansiona per<br />scaricare l'app</p>
                  <p className="text-xs font-bold text-accent mt-1 font-mono break-all">{codice}</p>
                  <p className="text-xs text-green-600 font-medium mt-1">Non scade mai</p>
                </div>

                <div className="w-full border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">Foto profilo</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                    <p className="text-xs text-amber-700 font-medium leading-snug">Sfondo bianco<br />Busto e viso<br />JPG/PNG min 300px<br />Max 2MB</p>
                  </div>
                </div>

                <div className="w-full space-y-1 text-center">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Istruzioni app</p>
                  <p className="text-xs text-muted-foreground leading-snug">1. Scarica Ice Arena<br />2. Tocca Accedi<br />3. Inserisci il codice<br />4. Carica foto profilo</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground"><span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>Tessera valida · Stagione 2025/26</p>
              <p className="text-xs text-muted-foreground">Generato il {new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })} · Ice Arena Manager</p>
            </div>
          </div>
        </div>
      );
    }
  }

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
      {invito_atleta && (
        <InvitoGenitoreModal
          atleta={invito_atleta}
          genitore_email={invito_atleta.genitore1_email}
          genitore_nome={`${invito_atleta.genitore1_nome} ${invito_atleta.genitore1_cognome}`.trim()}
          on_close={() => set_invito_atleta(null)}
        />
      )}
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
        {non_iscritti_count > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700 px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
            <p className="flex-1 text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {non_iscritti_count} atleti non ancora iscritti alla stagione corrente
            </p>
            <Button size="sm" variant="outline" onClick={() => navigate("/richieste-iscrizione")} className="shrink-0">
              Gestisci iscrizioni
            </Button>
          </div>
        )}
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

        {/* Card livelli — 3 sezioni: PULCINI / AMATORI / ARTISTICA */}
        <div className="space-y-2">
          {/* PULCINI — totale unico, niente sotto-livelli */}
          {pulcini_count > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-20 shrink-0">
                Pulcini
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(() => {
                  const sel = card_filter?.sezione === "pulcini";
                  return (
                    <button
                      onClick={() => {
                        if (sel) set_card_filter(null);
                        else {
                          set_card_filter({ sezione: "pulcini" });
                          set_level_filter("tutti");
                          set_categoria_filter("tutti");
                        }
                      }}
                      className={`shrink-0 px-4 py-3 rounded-xl shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${
                        sel ? "border-2 border-emerald-500 bg-emerald-100" : "border border-emerald-200 bg-emerald-50"
                      }`}
                    >
                      <span className="block text-2xl font-bold text-emerald-800">{pulcini_count}</span>
                      <span className="block text-xs text-emerald-600 mt-0.5">Totale</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* AMATORI — breakdown Stellina 1-4 */}
          {LIVELLI_AMATORI.some((l) => amatori_breakdown[l] > 0) && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-20 shrink-0">
                Amatori
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {LIVELLI_AMATORI.filter((l) => amatori_breakdown[l] > 0).map((l) => {
                  const sel = card_filter?.sezione === "amatori" && card_filter.livello === l;
                  return (
                    <button
                      key={l}
                      onClick={() => {
                        if (sel) set_card_filter(null);
                        else {
                          set_card_filter({ sezione: "amatori", livello: l });
                          set_level_filter("tutti");
                          set_categoria_filter("tutti");
                        }
                      }}
                      className={`shrink-0 px-4 py-3 rounded-xl shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${
                        sel ? "border-2 border-blue-500 bg-blue-100" : "border border-blue-200 bg-blue-50"
                      }`}
                    >
                      <span className="block text-2xl font-bold text-blue-800">{amatori_breakdown[l]}</span>
                      <span className="block text-xs text-blue-600 mt-0.5">{l}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ARTISTICA — breakdown carriera (somma artistica + stile) */}
          {LIVELLI_CARRIERA_NUOVI.some((l) => artistica_breakdown[l] > 0) && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-20 shrink-0">
                Artistica
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {LIVELLI_CARRIERA_NUOVI.filter((l) => artistica_breakdown[l] > 0).map((l) => {
                  const sel = card_filter?.sezione === "artistica" && card_filter.livello === l;
                  return (
                    <button
                      key={l}
                      onClick={() => {
                        if (sel) set_card_filter(null);
                        else {
                          set_card_filter({ sezione: "artistica", livello: l });
                          set_level_filter("tutti");
                          set_categoria_filter("tutti");
                        }
                      }}
                      className={`shrink-0 px-4 py-3 rounded-xl shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${
                        sel ? "border-2 border-purple-500 bg-purple-100" : "border border-purple-200 bg-purple-50"
                      }`}
                    >
                      <span className="block text-2xl font-bold text-purple-800">{artistica_breakdown[l]}</span>
                      <span className="block text-xs text-purple-600 mt-0.5">{l}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
          <Select
            value={categoria_filter}
            onValueChange={(v) => {
              set_categoria_filter(v as "tutti" | Categoria);
              set_level_filter("tutti");
              set_card_filter(null);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutte le categorie</SelectItem>
              {CATEGORIE.map((c) => (
                <SelectItem key={c} value={c}>
                  {get_categoria_label(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categoria_filter !== "tutti" && categoria_filter !== "pulcini" && (
            <Select value={level_filter} onValueChange={set_level_filter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("livello")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti i livelli</SelectItem>
                {(categoria_filter === "amatori" ? LIVELLI_AMATORI : LIVELLI_CARRIERA_NUOVI).map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={status_filter} onValueChange={set_status_filter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti</SelectItem>
              <SelectItem value="scuola">Solo scuola</SelectItem>
              <SelectItem value="agoniste">Solo agoniste</SelectItem>
              <SelectItem value="federazione">Solo Federazione</SelectItem>
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
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="font-medium text-foreground inline-flex items-center gap-2">
                                <span>{a.nome} {a.cognome}</span>
                                <AthleteBadges agonista={a.agonista} atleta_federazione={a.atleta_federazione} />
                              </p>
                            </div>
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
                          className={`inline-block w-2 h-2 rounded-full ${is_atleta_attivo_oggi(adesioni, a.id) ? "bg-success" : "bg-muted-foreground"}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => set_scheda_id(a.id)}
                          className="text-xs h-7"
                        >
                          Scheda
                        </Button>
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
