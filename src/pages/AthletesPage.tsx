import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { use_atleti, use_club, use_adesioni_atleta, is_atleta_attivo_oggi } from "@/hooks/use-supabase-data";
import { use_upsert_atleta, use_elimina_atleta } from "@/hooks/use-supabase-mutations";
import { calculate_age } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Shield, X, Trash2, Upload, ArrowLeft, Printer, Mail, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import AtletaDetail from "@/components/AtletaDetail";
import SchedaAnagrafica from "@/components/SchedaAnagrafica";
import AthleteBadges from "@/components/AthleteBadges";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";
import SearchableListLayout from "@/components/common/SearchableListLayout";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { capitalizza_nome, capitalizza_indirizzo, normalizza_email, cerca_nap } from "@/lib/formato-testo";

import DateInput from "@/components/forms/DateInput";
import {
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

const CANTONI_CH = [
  "AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH",
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
    atleta_club: atleta?.atleta_club || false,
    atleta_bmetod: atleta?.atleta_bmetod || false,
    atleta_esterno: atleta?.atleta_esterno || false,
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
    sesso: atleta?.sesso || "",
    codice_fiscale: atleta?.codice_fiscale || "",
    indirizzo: atleta?.indirizzo || "",
    cap: atleta?.cap || "",
    citta: atleta?.citta || "",
    cantone: atleta?.cantone || "",
    telefono: atleta?.telefono || "",
    genitore2_nome: atleta?.genitore2_nome || "",
    genitore2_cognome: atleta?.genitore2_cognome || "",
    genitore2_telefono: atleta?.genitore2_telefono || "",
    genitore2_email: atleta?.genitore2_email || "",
    genitore1_indirizzo: atleta?.genitore1_indirizzo || "",
    genitore1_cap: atleta?.genitore1_cap || "",
    genitore1_citta: atleta?.genitore1_citta || "",
    genitore1_cantone: atleta?.genitore1_cantone || "",
    genitore2_indirizzo: atleta?.genitore2_indirizzo || "",
    genitore2_cap: atleta?.genitore2_cap || "",
    genitore2_citta: atleta?.genitore2_citta || "",
    genitore2_cantone: atleta?.genitore2_cantone || "",
  });
  const [show_g2, set_show_g2] = useState(!!(atleta?.genitore2_nome || atleta?.genitore2_email));
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [uploading_foto, set_uploading_foto] = useState(false);
  const [uploading_disco, set_uploading_disco] = useState(false);

  const set_val = useCallback((k: string, v: any) => {
    set_form((p) => ({ ...p, [k]: v }));
  }, []);

  // Regola di formattazione: ogni parola con iniziale maiuscola, resto minuscolo
  const normalizza_campo = useCallback((k: string, tipo: "nome" | "indirizzo" | "email" = "nome") => {
    set_form((p) => {
      const attuale = String((p as any)[k] ?? "");
      const nuovo =
        tipo === "email" ? normalizza_email(attuale) : tipo === "indirizzo" ? capitalizza_indirizzo(attuale) : capitalizza_nome(attuale);
      return attuale === nuovo ? p : { ...p, [k]: nuovo };
    });
  }, []);

  // Suggerimento Città / Cantone dal NAP
  const suggerisci_da_nap = useCallback(async (cap_key: string, citta_key: string, cantone_key: string) => {
    const cap = String((form as any)[cap_key] ?? "");
    const info = await cerca_nap(cap);
    if (!info) return;
    set_form((p) => ({
      ...p,
      [citta_key]: String((p as any)[citta_key] ?? "").trim() || info.citta,
      [cantone_key]: String((p as any)[cantone_key] ?? "").trim() || info.cantone,
    }));
  }, [form]);


  

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
              <input value={form.nome} onChange={(e) => set_val("nome", e.target.value)} onBlur={() => normalizza_campo("nome")} className={input_cls} />
            </Field>
            <Field label="Cognome" required>
              <input value={form.cognome} onChange={(e) => set_val("cognome", e.target.value)} onBlur={() => normalizza_campo("cognome")} className={input_cls} />
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

          {/* Provenienza */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Provenienza</p>
            <div className="flex items-start gap-3 px-3 py-2 bg-muted/30 rounded-lg">
              <input
                type="checkbox"
                id="club_check"
                checked={form.atleta_club}
                onChange={(e) => set_val("atleta_club", e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-primary"
              />
              <label htmlFor="club_check" className="cursor-pointer">
                <span className="text-sm font-medium text-foreground">Club</span>
                <span className="block text-xs text-muted-foreground">Atleta del club principale</span>
              </label>
            </div>
            <div className="flex items-start gap-3 px-3 py-2 bg-muted/30 rounded-lg">
              <input
                type="checkbox"
                id="bmetod_check"
                checked={form.atleta_bmetod}
                onChange={(e) => set_val("atleta_bmetod", e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-primary"
              />
              <label htmlFor="bmetod_check" className="cursor-pointer">
                <span className="text-sm font-medium text-foreground">BMETOD</span>
                <span className="block text-xs text-muted-foreground">Atleta BMETOD Academy</span>
              </label>
            </div>
            <div className="flex items-start gap-3 px-3 py-2 bg-muted/30 rounded-lg">
              <input
                type="checkbox"
                id="esterno_check"
                checked={form.atleta_esterno}
                onChange={(e) => set_val("atleta_esterno", e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-primary"
              />
              <label htmlFor="esterno_check" className="cursor-pointer">
                <span className="text-sm font-medium text-foreground">Esterno</span>
                <span className="block text-xs text-muted-foreground">Pattinatore esterno ospite</span>
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sesso">
                <Select value={form.sesso || ""} onValueChange={(v) => set_val("sesso", v)}>
                  <SelectTrigger className="h-10 w-full rounded-lg">
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">Femmina</SelectItem>
                    <SelectItem value="M">Maschio</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Telefono">
                <input value={form.telefono} onChange={(e) => set_val("telefono", e.target.value)} placeholder="+41 79 123 45 67" className={input_cls} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Codice fiscale (opzionale)">
                <input value={form.codice_fiscale} onChange={(e) => set_val("codice_fiscale", e.target.value)} className={input_cls} />
              </Field>
            </div>
            <div className="mt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Indirizzo di residenza</p>
              <Field label="Indirizzo (via e numero)">
                <input value={form.indirizzo} onChange={(e) => set_val("indirizzo", e.target.value)} onBlur={() => normalizza_campo("indirizzo", "indirizzo")} className={input_cls} />
              </Field>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,110px)_minmax(0,1fr)_minmax(0,140px)]">
                <Field label="CAP">
                  <input
                    value={form.cap}
                    onChange={(e) => set_val("cap", e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
                    onBlur={() => suggerisci_da_nap("cap", "citta", "cantone")}
                    placeholder="6900"
                    className={input_cls}
                  />
                </Field>
                <Field label="Città">
                  <input value={form.citta} onChange={(e) => set_val("citta", e.target.value)} onBlur={() => normalizza_campo("citta")} className={input_cls} />
                </Field>
                <Field label="Cantone">
                  <Select value={form.cantone || ""} onValueChange={(v) => set_val("cantone", v)}>
                    <SelectTrigger className="h-10 w-full rounded-lg">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {CANTONI_CH.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {form.cap && form.cap.length > 0 && form.cap.length !== 4 && (
                <p className="text-xs text-destructive">CAP svizzero: 4 cifre</p>
              )}
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
                <input value={form.genitore1_nome} onChange={(e) => set_val("genitore1_nome", e.target.value)} onBlur={() => normalizza_campo("genitore1_nome")} className={input_cls} />
              </Field>
              <Field label="Cognome">
                <input value={form.genitore1_cognome} onChange={(e) => set_val("genitore1_cognome", e.target.value)} onBlur={() => normalizza_campo("genitore1_cognome")} className={input_cls} />
              </Field>
              <Field label="Telefono">
                <input value={form.genitore1_telefono} onChange={(e) => set_val("genitore1_telefono", e.target.value)} placeholder="+41 ..." className={input_cls} />
              </Field>
              <Field label="Email">
                <input type="email" value={form.genitore1_email} onChange={(e) => set_val("genitore1_email", e.target.value)} onBlur={() => normalizza_campo("genitore1_email", "email")} className={input_cls} />
              </Field>
            </div>
            <div className="mt-3 space-y-3">
              <Field label="Indirizzo (via e numero)">
                <input value={form.genitore1_indirizzo} onChange={(e) => set_val("genitore1_indirizzo", e.target.value)} onBlur={() => normalizza_campo("genitore1_indirizzo", "indirizzo")} className={input_cls} />
              </Field>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,110px)_minmax(0,1fr)_minmax(0,140px)]">
                <Field label="CAP">
                  <input value={form.genitore1_cap} onChange={(e) => set_val("genitore1_cap", e.target.value.replace(/[^0-9]/g, "").slice(0,5))} onBlur={() => suggerisci_da_nap("genitore1_cap", "genitore1_citta", "genitore1_cantone")} className={input_cls} />
                </Field>
                <Field label="Città">
                  <input value={form.genitore1_citta} onChange={(e) => set_val("genitore1_citta", e.target.value)} onBlur={() => normalizza_campo("genitore1_citta")} className={input_cls} />
                </Field>
                <Field label="Cantone">
                  <Select value={form.genitore1_cantone || ""} onValueChange={(v) => set_val("genitore1_cantone", v)}>
                    <SelectTrigger className="h-10 w-full rounded-lg"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {CANTONI_CH.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </div>

          {/* Genitore 2 — collassabile */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => set_show_g2((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 hover:text-foreground"
            >
              <span>Genitore 2 (opzionale)</span>
              <span className="text-base leading-none">{show_g2 ? "−" : "+"}</span>
            </button>
            {show_g2 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome">
                    <input value={form.genitore2_nome} onChange={(e) => set_val("genitore2_nome", e.target.value)} onBlur={() => normalizza_campo("genitore2_nome")} className={input_cls} />
                  </Field>
                  <Field label="Cognome">
                    <input value={form.genitore2_cognome} onChange={(e) => set_val("genitore2_cognome", e.target.value)} onBlur={() => normalizza_campo("genitore2_cognome")} className={input_cls} />
                  </Field>
                  <Field label="Telefono">
                    <input value={form.genitore2_telefono} onChange={(e) => set_val("genitore2_telefono", e.target.value)} placeholder="+41 ..." className={input_cls} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={form.genitore2_email} onChange={(e) => set_val("genitore2_email", e.target.value)} onBlur={() => normalizza_campo("genitore2_email", "email")} className={input_cls} />
                  </Field>
                </div>
                <div className="mt-3 space-y-3">
                  <Field label="Indirizzo (via e numero)">
                    <input value={form.genitore2_indirizzo} onChange={(e) => set_val("genitore2_indirizzo", e.target.value)} onBlur={() => normalizza_campo("genitore2_indirizzo", "indirizzo")} className={input_cls} />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,110px)_minmax(0,1fr)_minmax(0,140px)]">
                    <Field label="CAP">
                      <input value={form.genitore2_cap} onChange={(e) => set_val("genitore2_cap", e.target.value.replace(/[^0-9]/g, "").slice(0,5))} onBlur={() => suggerisci_da_nap("genitore2_cap", "genitore2_citta", "genitore2_cantone")} className={input_cls} />
                    </Field>
                    <Field label="Città">
                      <input value={form.genitore2_citta} onChange={(e) => set_val("genitore2_citta", e.target.value)} onBlur={() => normalizza_campo("genitore2_citta")} className={input_cls} />
                    </Field>
                    <Field label="Cantone">
                      <Select value={form.genitore2_cantone || ""} onValueChange={(v) => set_val("genitore2_cantone", v)}>
                        <SelectTrigger className="h-10 w-full rounded-lg"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {CANTONI_CH.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
              </>
            )}
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
  const query_client = useQueryClient();
  const { session } = useAuth();
  const params = useParams<{ id?: string }>();
  const { data: atleti = [], isLoading } = use_atleti();
  const upsert = use_upsert_atleta();
  const elimina = use_elimina_atleta();
  const [search_raw, set_search_raw] = useState("");
  const search = useDebouncedValue(search_raw, 200);
  const [level_filter, set_level_filter] = useState("tutti");
  const [status_filter, set_status_filter] = useState("tutti");
  const [agonista_filter, set_agonista_filter] = useState<"tutti" | "si" | "no">("tutti");
  const [attivo_filter, set_attivo_filter] = useState<"tutti" | "attivi" | "inattivi">("tutti");
  const [eta_filter, set_eta_filter] = useState<"tutti" | "5-8" | "9-12" | "13+">("tutti");
  const [sort_by, set_sort_by] = useState<"cognome" | "livello" | "eta" | "recente" | "codice">("cognome");
  const [solo_da_verificare, set_solo_da_verificare] = useState(false);
  const [selected_id, set_selected_id] = useState<string | null>(params.id ?? null);
  useEffect(() => { if (params.id && params.id !== selected_id) set_selected_id(params.id); }, [params.id]);
  const [modal_open, set_modal_open] = useState(false);
  const [selected_atleta, set_selected_atleta] = useState<any>(null);
  const [scheda_id, set_scheda_id] = useState<string | null>(null);
  const [scheda_modo, set_scheda_modo] = useState<"foto" | "iscrizione">("foto");
  const [scheda_atleta_nuovo, set_scheda_atleta_nuovo] = useState<any>(null);
  const [quick_open, set_quick_open] = useState(false);
  const [quick_form, set_quick_form] = useState<{ nome: string; cognome: string; genitore1_email: string; genitore1_telefono: string; livello: string; livello_prep: string }>({ nome: "", cognome: "", genitore1_email: "", genitore1_telefono: "", livello: "", livello_prep: "" });
  const [quick_saving, set_quick_saving] = useState(false);
  
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

  // Per la sezione Artistica calcoliamo due breakdown distinti per percorso:
  // - art[l]: numero di atleti con livello_artistica = l (indipendentemente da stile)
  // - sti[l]: numero di atleti con livello_stile     = l (indipendentemente da artistica)
  const artistica_breakdown_art = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of LIVELLI_CARRIERA_NUOVI) counts[l] = 0;
    for (const a of atleti) {
      if (a.categoria !== "artistica") continue;
      if (a.livello_artistica && counts[a.livello_artistica] !== undefined) counts[a.livello_artistica]++;
    }
    return counts;
  }, [atleti]);

  const artistica_breakdown_sti = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of LIVELLI_CARRIERA_NUOVI) counts[l] = 0;
    for (const a of atleti) {
      if (a.categoria !== "artistica") continue;
      if (a.livello_stile && counts[a.livello_stile] !== undefined) counts[a.livello_stile]++;
    }
    return counts;
  }, [atleti]);

  // Atleti in transizione: categoria=artistica + livello_artistica=NULL + in_preparazione popolato
  const artistica_in_prep_count = useMemo(
    () =>
      atleti.filter(
        (a: any) =>
          a.categoria === "artistica" &&
          !a.livello_artistica &&
          a.livello_artistica_in_preparazione,
      ).length,
    [atleti],
  );

  const [card_filter, set_card_filter] = useState<
    | { sezione: "pulcini" }
    | { sezione: "amatori"; livello: string }
    | { sezione: "artistica"; percorso: "artistica" | "stile"; livello: string }
    | { sezione: "in_prep"; disciplina: "artistica" | "stile"; livello: string }
    | null
  >(null);

  // Filtro a cascata: prima categoria, poi (se categoria scelta) livello specifico
  const [categoria_filter, set_categoria_filter] = useState<"tutti" | Categoria>("tutti");
  // Filtro Percorso visibile solo quando categoria = artistica
  const [percorso_filter, set_percorso_filter] = useState<
    "tutti" | "artistica" | "stile" | "entrambi"
  >("tutti");

  const da_verificare_count = useMemo(
    () => atleti.filter((a: any) => a.verificato === false).length,
    [atleti],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = atleti.filter((a: any) => {
      if (solo_da_verificare && a.verificato !== false) return false;
      if (q) {
        const hay = [a.nome, a.cognome, a.codice_atleta, a.genitore1_email, a.genitore2_email]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const status_match =
        status_filter === "tutti" ||
        (status_filter === "scuola" && !a.agonista && !a.atleta_federazione) ||
        (status_filter === "agoniste" && (a.agonista || a.atleta_federazione)) ||
        (status_filter === "federazione" && a.atleta_federazione);
      if (!status_match) return false;
      if (agonista_filter === "si" && !a.agonista) return false;
      if (agonista_filter === "no" && a.agonista) return false;
      if (attivo_filter !== "tutti") {
        // Stato atleta deriva dalla colonna boolean atleti.attivo (fonte di verità anagrafica)
        const att = a.attivo !== false;
        if (attivo_filter === "attivi" && !att) return false;
        if (attivo_filter === "inattivi" && att) return false;
      }
      if (eta_filter !== "tutti") {
        const eta = calculate_age(a.data_nascita) ?? -1;
        if (eta_filter === "5-8" && (eta < 5 || eta > 8)) return false;
        if (eta_filter === "9-12" && (eta < 9 || eta > 12)) return false;
        if (eta_filter === "13+" && eta < 13) return false;
      }

      if (card_filter) {
        if (card_filter.sezione === "pulcini") {
          return (a.categoria ?? "pulcini") === "pulcini";
        }
        if (card_filter.sezione === "amatori") {
          return a.categoria === "amatori" && a.livello_amatori === card_filter.livello;
        }
        if (card_filter.sezione === "artistica") {
          if (a.categoria !== "artistica") return false;
          if (card_filter.percorso === "artistica") return a.livello_artistica === card_filter.livello;
          return a.livello_stile === card_filter.livello;
        }
        if (card_filter.sezione === "in_prep") {
          if (a.categoria !== "artistica") return false;
          if (card_filter.disciplina === "artistica") {
            return !a.livello_artistica && a.livello_artistica_in_preparazione === card_filter.livello;
          }
          return !a.livello_stile && a.livello_stile_in_preparazione === card_filter.livello;
        }
      }

      if (categoria_filter !== "tutti") {
        const cat = (a.categoria ?? "pulcini") as Categoria;
        if (cat !== categoria_filter) return false;
        if (categoria_filter === "artistica") {
          if (percorso_filter === "artistica" && !a.livello_artistica) return false;
          if (percorso_filter === "stile" && !a.livello_stile) return false;
          if (percorso_filter === "entrambi" && (!a.livello_artistica || !a.livello_stile)) return false;
        }
        if (level_filter !== "tutti") {
          if (categoria_filter === "pulcini") return true;
          if (categoria_filter === "amatori") return a.livello_amatori === level_filter;
          if (categoria_filter === "artistica") {
            return a.livello_artistica === level_filter || a.livello_stile === level_filter;
          }
        }
        return true;
      }

      return true;
    });

    // Sort
    const livello_rank = (a: any) => {
      const order = ["oro", "argento", "bronzo", "stella3", "stella2", "stella1", "ghiaccio", "pulcini"];
      const lv = (a.livello_artistica || a.livello_stile || a.livello_amatori || a.categoria || "").toLowerCase();
      const idx = order.findIndex((o) => lv.includes(o));
      return idx === -1 ? 999 : idx;
    };
    const sorted = [...list].sort((a: any, b: any) => {
      if (sort_by === "cognome") return (a.cognome ?? "").localeCompare(b.cognome ?? "");
      if (sort_by === "codice") return (a.codice_atleta ?? "").localeCompare(b.codice_atleta ?? "");
      if (sort_by === "eta") return (calculate_age(b.data_nascita) ?? 0) - (calculate_age(a.data_nascita) ?? 0);
      if (sort_by === "recente") return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      if (sort_by === "livello") return livello_rank(a) - livello_rank(b);
      return 0;
    });
    return sorted;
  }, [atleti, search, solo_da_verificare, status_filter, agonista_filter, attivo_filter, eta_filter, card_filter, categoria_filter, percorso_filter, level_filter, sort_by, adesioni]);


  const handle_save = async (data_in: any) => {
    const data = {
      ...data_in,
      ...Object.fromEntries(
        ["nome", "cognome", "citta", "genitore1_nome", "genitore1_cognome", "genitore1_citta", "genitore2_nome", "genitore2_cognome", "genitore2_citta"]
          .filter((k) => typeof data_in?.[k] === "string")
          .map((k) => [k, capitalizza_nome(data_in[k])]),
      ),
      ...Object.fromEntries(
        ["indirizzo", "genitore1_indirizzo", "genitore2_indirizzo"]
          .filter((k) => typeof data_in?.[k] === "string")
          .map((k) => [k, capitalizza_indirizzo(data_in[k])]),
      ),
      ...Object.fromEntries(
        ["genitore1_email", "genitore2_email"]
          .filter((k) => typeof data_in?.[k] === "string")
          .map((k) => [k, normalizza_email(data_in[k])]),
      ),
    };
    try {
      const res: any = await upsert.mutateAsync(data);
      set_modal_open(false);
      await query_client.invalidateQueries({ queryKey: ["atleti", get_current_club_id()] });
      if (!data.id && res?.atleta) {
        // Nuovo atleta: mostro subito la scheda con codice atleta, QR e stampa
        set_scheda_atleta_nuovo(res.atleta);
        set_scheda_modo("iscrizione");
        toast({ title: "✅ Atleta creata", description: `Codice atleta: ${res.atleta.codice_atleta ?? "—"}` });
      } else {
        toast({ title: data.id ? "✅ Atleta aggiornata" : "✅ Atleta creata" });
      }
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

  const crea_atleta_rapido = async () => {
    if (!quick_form.nome.trim() || !quick_form.cognome.trim()) {
      toast({ title: "Nome e cognome obbligatori", variant: "destructive" });
      return;
    }
    if (!quick_form.livello) {
      toast({ title: "Livello iniziale obbligatorio", description: "Seleziona il livello dell'atleta.", variant: "destructive" });
      return;
    }
    if (quick_saving) return;
    const gia_esiste = (atleti ?? []).some(

      (a: any) =>
        (a.nome ?? "").trim().toLowerCase() === quick_form.nome.trim().toLowerCase() &&
        (a.cognome ?? "").trim().toLowerCase() === quick_form.cognome.trim().toLowerCase(),
    );
    if (gia_esiste) {
      toast({ title: "Atleta già presente", description: "Esiste già una scheda con questo nome e cognome.", variant: "destructive" });
      return;
    }
    set_quick_saving(true);

    try {
      const liv = quick_form.livello;
      const campi_livello: Record<string, any> = {};
      if (liv === "Pulcini") {
        campi_livello.categoria = "pulcini";
      } else if (LIVELLI_AMATORI.includes(liv as any)) {
        campi_livello.categoria = "amatori";
        campi_livello.livello_amatori = liv;
      } else if (liv) {
        campi_livello.categoria = "artistica";
        campi_livello.livello_artistica = liv;
      }
      if (quick_form.livello_prep) {
        campi_livello.livello_in_preparazione = quick_form.livello_prep;
        if (campi_livello.categoria === "artistica") {
          campi_livello.livello_artistica_in_preparazione = quick_form.livello_prep;
        }
      }
      const { data, error } = await supabase
        .from("atleti")
        .insert({
          club_id: get_current_club_id(),
          nome: capitalizza_nome(quick_form.nome),
          cognome: capitalizza_nome(quick_form.cognome),
          genitore1_email: normalizza_email(quick_form.genitore1_email) || null,
          genitore1_telefono: quick_form.genitore1_telefono.trim() || null,
          ...campi_livello,
          attivo: true,
          verificato: false,
        })
        .select()
        .single();
      if (error) throw error;
      await query_client.invalidateQueries({ queryKey: ["atleti", get_current_club_id()] });
      set_quick_open(false);
      set_quick_form({ nome: "", cognome: "", genitore1_email: "", genitore1_telefono: "", livello: "", livello_prep: "" });
      set_scheda_atleta_nuovo(data);
      set_scheda_modo("iscrizione");
      toast({ title: "✅ Atleta creato", description: `Codice atleta: ${data?.codice_atleta ?? "—"} — scheda di iscrizione pronta` });
    } catch (err: any) {
      toast({ title: "Errore creazione atleta", description: err?.message, variant: "destructive" });
    } finally {
      set_quick_saving(false);
    }
  };

  if (scheda_atleta_nuovo) {
    return (
      <SchedaAnagrafica
        atleta={scheda_atleta_nuovo}
        modo={scheda_modo}
        on_back={() => set_scheda_atleta_nuovo(null)}
      />
    );
  }

  if (scheda_id) {
    const atleta = atleti.find((a: any) => a.id === scheda_id);
    if (atleta) return <SchedaAnagrafica atleta={atleta} modo={scheda_modo} on_back={() => set_scheda_id(null)} />;
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

      {quick_open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !quick_saving && set_quick_open(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold">Nuovo atleta</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Bastano questi dati per creare la scheda: il resto lo completa il genitore dalla pagina di iscrizione.
                Se preferisci inserire tutto ora, usa "Compila subito la scheda completa".
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" required>
                <Input value={quick_form.nome} onChange={(e) => set_quick_form((p) => ({ ...p, nome: e.target.value }))} onBlur={() => set_quick_form((p) => ({ ...p, nome: capitalizza_nome(p.nome) }))} />
              </Field>
              <Field label="Cognome" required>
                <Input value={quick_form.cognome} onChange={(e) => set_quick_form((p) => ({ ...p, cognome: e.target.value }))} onBlur={() => set_quick_form((p) => ({ ...p, cognome: capitalizza_nome(p.cognome) }))} />
              </Field>
              <Field label="Email genitore">
                <Input type="email" value={quick_form.genitore1_email} onChange={(e) => set_quick_form((p) => ({ ...p, genitore1_email: e.target.value }))} onBlur={() => set_quick_form((p) => ({ ...p, genitore1_email: normalizza_email(p.genitore1_email) }))} />
              </Field>
              <Field label="Telefono genitore">
                <Input type="tel" value={quick_form.genitore1_telefono} onChange={(e) => set_quick_form((p) => ({ ...p, genitore1_telefono: e.target.value }))} />
              </Field>
              <Field label="Livello iniziale" required>
                <Select value={quick_form.livello || undefined} onValueChange={(v) => set_quick_form((p) => ({ ...p, livello: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona livello" /></SelectTrigger>
                  <SelectContent>
                    {LIVELLI_TUTTI.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="In preparazione">
                <Select value={quick_form.livello_prep || undefined} onValueChange={(v) => set_quick_form((p) => ({ ...p, livello_prep: v }))}>
                  <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
                  <SelectContent>
                    {LIVELLI_TUTTI.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="ghost"
                className="mr-auto text-muted-foreground"
                disabled={quick_saving}
                onClick={() => {
                  set_quick_open(false);
                  set_selected_atleta(null);
                  set_modal_open(true);
                }}
              >
                Compila subito la scheda completa
              </Button>
              <Button variant="ghost" onClick={() => set_quick_open(false)} disabled={quick_saving}>Annulla</Button>
              <Button onClick={crea_atleta_rapido} disabled={quick_saving}>
                {quick_saving ? "Creazione…" : "Crea e stampa scheda"}
              </Button>
            </div>
          </div>
        </div>
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
          <div className="flex flex-wrap items-center gap-2">
            {da_verificare_count > 0 && (
              <button
                onClick={() => set_solo_da_verificare((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${solo_da_verificare ? "border-yellow-500 bg-yellow-100 text-yellow-900" : "border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100"}`}
                title="Mostra solo atleti non ancora verificati"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {da_verificare_count} da verificare
              </button>
            )}
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Switch checked={solo_da_verificare} onCheckedChange={set_solo_da_verificare} />
              <span>Solo da verificare</span>
            </label>
            {(["presidente", "segreteria", "admin", "superadmin"].includes(session?.ruolo as string)) && (
              <Button
                variant="outline"
                onClick={() => navigate("/import-atleti")}
              >
                <Upload className="w-4 h-4 mr-2" /> Importa da Excel
              </Button>
            )}
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={() => set_quick_open(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> {t("nuovo_atleta")}
            </Button>
          </div>
        </div>

        {/* Card livelli — sempre TUTTI i box, anche con count=0 (stile spento) */}
        <div className="space-y-2">
          {/* PULCINI — totale unico, sempre presente */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0">
              Pulcini
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(() => {
                const sel = card_filter?.sezione === "pulcini";
                const empty = pulcini_count === 0;
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
                      sel
                        ? "border-2 border-emerald-500 bg-emerald-100"
                        : empty
                          ? "border border-emerald-100 bg-emerald-50/40"
                          : "border border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <span className={`block text-2xl font-bold ${empty ? "text-muted-foreground/50" : "text-emerald-800"}`}>{pulcini_count}</span>
                    <span className={`block text-xs mt-0.5 ${empty ? "text-muted-foreground/50" : "text-emerald-600"}`}>Totale</span>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* AMATORI — sempre Stellina 1-4 */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0">
              Amatori
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {LIVELLI_AMATORI.map((l) => {
                const sel = card_filter?.sezione === "amatori" && card_filter.livello === l;
                const n = amatori_breakdown[l] || 0;
                const empty = n === 0;
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
                      sel
                        ? "border-2 border-blue-500 bg-blue-100"
                        : empty
                          ? "border border-blue-100 bg-blue-50/40"
                          : "border border-blue-200 bg-blue-50"
                    }`}
                  >
                    <span className={`block text-2xl font-bold ${empty ? "text-muted-foreground/50" : "text-blue-800"}`}>{n}</span>
                    <span className={`block text-xs mt-0.5 ${empty ? "text-muted-foreground/50" : "text-blue-600"}`}>{l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ARTISTICA · Percorso Artistica — viola */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0">
              Art. · Artistica
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {/* Tassello "In preparazione" — atleti già artistica ma senza livello battezzato */}
              {(() => {
                const empty = artistica_in_prep_count === 0;
                const sel =
                  card_filter?.sezione === "in_prep" &&
                  card_filter.disciplina === "artistica" &&
                  card_filter.livello === "Interbronzo";
                return (
                  <button
                    onClick={() => {
                      if (sel) {
                        set_card_filter(null);
                      } else {
                        set_card_filter({ sezione: "in_prep", disciplina: "artistica", livello: "Interbronzo" });
                        set_categoria_filter("tutti");
                        set_percorso_filter("tutti");
                        set_level_filter("tutti");
                      }
                    }}
                    className={`shrink-0 px-4 py-3 rounded-xl shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${
                      sel
                        ? "border-2 border-purple-500 bg-purple-100"
                        : `border border-purple-200 bg-purple-50/50 ${empty ? "opacity-60" : ""}`
                    }`}
                    title="Atleti che hanno superato Stellina 4 ma non ancora Interbronzo"
                  >
                    <span className={`block text-2xl font-bold ${empty ? "text-muted-foreground/50" : "text-purple-700"}`}>{artistica_in_prep_count}</span>
                    <span className={`block text-[11px] mt-0.5 italic ${empty ? "text-muted-foreground/50" : "text-purple-600"}`}>In prep. Interbronzo</span>
                  </button>
                );
              })()}
              {LIVELLI_CARRIERA_NUOVI.map((l) => {
                const sel =
                  card_filter?.sezione === "artistica" &&
                  card_filter.percorso === "artistica" &&
                  card_filter.livello === l;
                const n = artistica_breakdown_art[l] || 0;
                const empty = n === 0;
                return (
                  <button
                    key={l}
                    onClick={() => {
                      if (sel) set_card_filter(null);
                      else {
                        set_card_filter({ sezione: "artistica", percorso: "artistica", livello: l });
                        set_level_filter("tutti");
                        set_categoria_filter("tutti");
                      }
                    }}
                    className={`shrink-0 px-4 py-3 rounded-xl shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${
                      sel
                        ? "border-2 border-purple-500 bg-purple-100"
                        : empty
                          ? "border border-purple-100 bg-purple-50/40"
                          : "border border-purple-200 bg-purple-50"
                    }`}
                  >
                    <span className={`block text-2xl font-bold ${empty ? "text-muted-foreground/50" : "text-purple-800"}`}>{n}</span>
                    <span className={`block text-xs mt-0.5 ${empty ? "text-muted-foreground/50" : "text-purple-600"}`}>{l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ARTISTICA · Percorso Stile — rosa */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0">
              Art. · Stile
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {LIVELLI_CARRIERA_NUOVI.map((l) => {
                const sel =
                  card_filter?.sezione === "artistica" &&
                  card_filter.percorso === "stile" &&
                  card_filter.livello === l;
                const n = artistica_breakdown_sti[l] || 0;
                const empty = n === 0;
                return (
                  <button
                    key={l}
                    onClick={() => {
                      if (sel) set_card_filter(null);
                      else {
                        set_card_filter({ sezione: "artistica", percorso: "stile", livello: l });
                        set_level_filter("tutti");
                        set_categoria_filter("tutti");
                      }
                    }}
                    className={`shrink-0 px-4 py-3 rounded-xl shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${
                      sel
                        ? "border-2 border-pink-500 bg-pink-100"
                        : empty
                          ? "border border-pink-100 bg-pink-50/40"
                          : "border border-pink-200 bg-pink-50"
                    }`}
                  >
                    <span className={`block text-2xl font-bold ${empty ? "text-muted-foreground/50" : "text-pink-800"}`}>{n}</span>
                    <span className={`block text-xs mt-0.5 ${empty ? "text-muted-foreground/50" : "text-pink-600"}`}>{l}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {(() => {
          // Filtri data-driven: i valori delle option derivano sempre dai
          // record realmente presenti nel club corrente (atleti già filtrato da RLS).
          const distinct_categorie = Array.from(
            new Set(
              atleti
                .map((a: any) => (a?.categoria ?? null))
                .filter((v: any) => v !== null && v !== undefined && String(v).trim() !== "")
            )
          ).sort() as string[];
          const cat_options = [
            { value: "tutti", label: "Tutte le categorie" },
            ...distinct_categorie.map((c) => ({ value: c, label: get_categoria_label(c) })),
          ];
          // Per il livello, distinct sulla colonna corretta in base alla categoria scelta.
          const liv_column =
            categoria_filter === "amatori"
              ? "livello_amatori"
              : categoria_filter === "artistica"
                ? "livello_artistica"
                : null;
          const distinct_livelli = liv_column
            ? (Array.from(
                new Set(
                  atleti
                    .filter((a: any) => (a?.categoria ?? null) === categoria_filter)
                    .map((a: any) => a?.[liv_column])
                    .filter((v: any) => v !== null && v !== undefined && String(v).trim() !== "")
                )
              ) as string[]).sort()
            : [];
          const liv_options = [
            { value: "tutti", label: "Tutti i livelli" },
            ...distinct_livelli.map((l) => ({ value: l, label: l })),
          ];
          const filtri: any[] = [];
          // Mostro il filtro categoria solo se ci sono almeno 2 valori distinti.
          if (distinct_categorie.length > 1) {
            filtri.push({
              key: "categoria", label: "Categoria", value: categoria_filter, options: cat_options,
              onChange: (v: string) => {
                set_categoria_filter(v as any);
                set_level_filter("tutti");
                set_percorso_filter("tutti");
                set_card_filter(null);
              },
            });
          }
          if (categoria_filter === "artistica") {
            filtri.push({
              key: "percorso", label: "Percorso", value: percorso_filter,
              options: [
                { value: "tutti", label: "Tutti i percorsi" },
                { value: "artistica", label: "Solo Artistica" },
                { value: "stile", label: "Solo Stile" },
                { value: "entrambi", label: "Entrambi" },
              ],
              onChange: (v: string) => set_percorso_filter(v as any),
            });
          }
          if (liv_column && distinct_livelli.length > 1) {
            filtri.push({
              key: "livello", label: "Livello", value: level_filter, options: liv_options,
              onChange: set_level_filter,
            });
          }
          filtri.push(
            {
              key: "status", label: "Status", value: status_filter,
              options: [
                { value: "tutti", label: "Tutti" },
                { value: "scuola", label: "Solo scuola" },
                { value: "agoniste", label: "Solo agoniste" },
                { value: "federazione", label: "Solo Federazione" },
              ],
              onChange: set_status_filter,
            },
            {
              key: "agonista", label: "Agonista", value: agonista_filter,
              options: [
                { value: "tutti", label: "Tutti" },
                { value: "si", label: "Sì" },
                { value: "no", label: "No" },
              ],
              onChange: (v: string) => set_agonista_filter(v as any),
            },
            {
              key: "attivo", label: "Stato", value: attivo_filter,
              options: [
                { value: "tutti", label: "Tutti" },
                { value: "attivi", label: "Attivi" },
                { value: "inattivi", label: "Inattivi" },
              ],
              onChange: (v: string) => set_attivo_filter(v as any),
            },
            {
              key: "eta", label: "Età", value: eta_filter,
              options: [
                { value: "tutti", label: "Tutte" },
                { value: "5-8", label: "5–8" },
                { value: "9-12", label: "9–12" },
                { value: "13+", label: "13+" },
              ],
              onChange: (v: string) => set_eta_filter(v as any),
            },
          );
          return (
            <SearchableListLayout
              search={search_raw}
              on_search_change={set_search_raw}
              search_placeholder="Cerca per nome, cognome, codice atleta, email genitori…"
              filters={filtri}
              sort={{
                value: sort_by,
                onChange: (v) => set_sort_by(v as any),
                options: [
                  { value: "cognome", label: "Cognome A-Z" },
                  { value: "livello", label: "Livello" },
                  { value: "eta", label: "Età ↓" },
                  { value: "recente", label: "Iscrizione recente" },
                  { value: "codice", label: "Codice atleta" },
                ],
              }}
              count_filtered={filtered.length}
              count_total={atleti.length}
              extra_summary={card_filter ? (
                <button
                  onClick={() => set_card_filter(null)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[11px] font-semibold text-primary hover:bg-primary/20"
                >
                  {card_filter.sezione === "pulcini" && "Pulcini"}
                  {card_filter.sezione === "amatori" && `Amatori · ${card_filter.livello}`}
                  {card_filter.sezione === "artistica" && `${card_filter.percorso === "artistica" ? "Artistica" : "Stile"} · ${card_filter.livello}`}
                  {card_filter.sezione === "in_prep" && `In prep · ${card_filter.livello}`}
                  <span>✕</span>
                </button>
              ) : null}
            >
              <div />
            </SearchableListLayout>
          );
        })()}


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
                    <tr key={a.id} className={`border-b border-border/50 transition-colors ${a.verificato === false ? "bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:hover:bg-yellow-950/50" : "hover:bg-muted/30"}`}>
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
                              <p className="font-medium text-foreground inline-flex items-center gap-2 flex-wrap">
                                <span>{a.nome} {a.cognome}</span>
                                <AthleteBadges
                                  agonista={a.agonista}
                                  atleta_federazione={a.atleta_federazione}
                                  atleta_club={a.atleta_club}
                                  atleta_bmetod={a.atleta_bmetod}
                                  atleta_esterno={a.atleta_esterno}
                                />
                                {a.verificato === false && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800 ring-1 ring-inset ring-yellow-300">
                                    ⚠️ Da verificare
                                  </span>
                                )}
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
                          className={`inline-block w-2 h-2 rounded-full ${a.attivo !== false ? "bg-success" : "bg-muted-foreground"}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { set_scheda_modo("foto"); set_scheda_id(a.id); }}
                          className="text-xs h-7"
                        >
                          Scheda
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { set_scheda_modo("iscrizione"); set_scheda_id(a.id); }}
                          className="text-xs h-7"
                        >
                          Iscrizione
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
