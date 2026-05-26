import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { format_data_completa } from "@/lib/format-data";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Calendar } from "lucide-react";
import CalendarioAtletaInterattivo from "@/components/CalendarioAtletaInterattivo";
import CodiceAtletaCard from "@/components/CodiceAtletaCard";
import StoricoTestAtleta from "@/components/StoricoTestAtleta";
import DateInput from "@/components/forms/DateInput";
import AthleteBadges from "@/components/AthleteBadges";
import { useI18n } from "@/lib/i18n";
import {
  use_corsi,
  use_gare,
  use_fatture,
  use_lezioni_private,
  use_istruttori,
  use_tutti_club,
  use_adesioni_atleta,
  is_atleta_attivo_oggi,
  get_istruttore_name_from_list,
} from "@/hooks/use-supabase-data";
import { use_upsert_atleta, use_migra_atleta } from "@/hooks/use-supabase-mutations";
import { calculate_age } from "@/lib/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectLivello } from "@/components/ui/select-livello";
import { ArrowLeft, Shield, Medal, Save, Upload, Music, ArrowRightLeft, X, Mail, Copy, Printer, Link as LinkIcon, QrCode, Share2, Trophy, ShieldCheck, UserCog } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase, get_current_club_id } from "@/lib/supabase";
import CompensoStaffModal from "@/components/CompensoStaffModal";

interface Props {
  atleta: any;
  on_back: () => void;
}

const LIVELLI_COMUNI = ["Pulcini", "Stellina 1", "Stellina 2", "Stellina 3", "Stellina 4"];
const LIVELLI_CARRIERA = ["Interbronzo", "Bronzo", "Interargento", "Argento", "Interoro", "Oro"];
const LIVELLI_PROGRESSIONE = [...LIVELLI_COMUNI, ...LIVELLI_CARRIERA];

const CANTONI_CH = [
  ["AG", "Argovia"], ["AI", "Appenzello Interno"], ["AR", "Appenzello Esterno"],
  ["BE", "Berna"], ["BL", "Basilea Campagna"], ["BS", "Basilea Città"],
  ["FR", "Friburgo"], ["GE", "Ginevra"], ["GL", "Glarona"], ["GR", "Grigioni"],
  ["JU", "Giura"], ["LU", "Lucerna"], ["NE", "Neuchâtel"], ["NW", "Nidvaldo"],
  ["OW", "Obvaldo"], ["SG", "San Gallo"], ["SH", "Sciaffusa"], ["SO", "Soletta"],
  ["SZ", "Svitto"], ["TG", "Turgovia"], ["TI", "Ticino"], ["UR", "Uri"],
  ["VD", "Vaud"], ["VS", "Vallese"], ["ZG", "Zugo"], ["ZH", "Zurigo"],
] as const;

// ─── NumInput ──────────────────────────────────────────────
function to_num(v: string | number): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const cleaned = String(v).replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

const input_cls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

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
        set_local(n === 0 ? "" : String(n));
        onChange(String(n));
      }}
      className={`${input_cls} ${className}`}
    />
  );
};

// CalendarioAtleta replaced by CalendarioAtletaInterattivo

// ─── Modal Migrazione ──────────────────────────────────────
const MigraModal: React.FC<{
  atleta: any;
  on_close: () => void;
  on_migra: (club_id: string, note: string) => Promise<void>;
  saving: boolean;
}> = ({ atleta, on_close, on_migra, saving }) => {
  const { data: tutti_club = [] } = use_tutti_club();
  const [club_dest, set_club_dest] = useState("");
  const [note, set_note] = useState("");
  const [confirm, set_confirm] = useState(false);

  const altri_club = tutti_club.filter((c: any) => c.id !== get_current_club_id());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Migra atleta</h2>
            <p className="text-xs text-muted-foreground">
              {atleta.nome} {atleta.cognome}
            </p>
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-bold text-primary uppercase tracking-wide">Cosa viene migrato</p>
            <p className="text-xs text-muted-foreground">✅ Anagrafica completa</p>
            <p className="text-xs text-muted-foreground">✅ Storico gare e medagliere</p>
            <p className="text-xs text-muted-foreground">✅ Storico livelli</p>
            <p className="text-xs text-muted-foreground">✅ Foto e disco audio</p>
            <p className="text-xs text-muted-foreground">❌ Iscrizioni corsi (da rifare nel nuovo club)</p>
            <p className="text-xs text-muted-foreground">❌ Fatture (rimangono nel vecchio club)</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Club di destinazione *
            </label>
            <select
              value={club_dest}
              onChange={(e) => set_club_dest(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Seleziona club...</option>
              {altri_club.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.citta ? `— ${c.citta}` : ""}
                </option>
              ))}
            </select>
            {altri_club.length === 0 && (
              <p className="text-xs text-muted-foreground">Nessun altro club registrato nella piattaforma.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note</label>
            <textarea
              value={note}
              onChange={(e) => set_note(e.target.value)}
              rows={2}
              placeholder="Motivo della migrazione (opzionale)..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {club_dest && !confirm && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs text-orange-700">
                ⚠️ Questa operazione sposterà{" "}
                <strong>
                  {atleta.nome} {atleta.cognome}
                </strong>{" "}
                nel club selezionato. Non sarà più visibile in questo club.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border space-y-2">
          {!confirm ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={on_close} className="flex-1">
                Annulla
              </Button>
              <Button
                onClick={() => set_confirm(true)}
                disabled={!club_dest}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Continua →
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">Sei sicuro? L'operazione non è reversibile.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => set_confirm(false)} className="flex-1">
                  ← Indietro
                </Button>
                <Button
                  onClick={() => on_migra(club_dest, note)}
                  disabled={saving}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
                >
                  {saving ? "..." : "🚀 Conferma migrazione"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AtletaDetail: React.FC<Props> = ({ atleta: a, on_back }) => {
  const { t } = useI18n();
  const upsert = use_upsert_atleta();
  const migra = use_migra_atleta();
  const [show_migra, set_show_migra] = useState(false);
  const [generating_portal, set_generating_portal] = useState(false);
  const [show_qr_portal, set_show_qr_portal] = useState(false);
  const [verifying, set_verifying] = useState(false);
  const [confirm_verifica, set_confirm_verifica] = useState(false);
  const { session } = useAuth();
  const query_client = useQueryClient();
  const can_verificare = (session?.ruolo as string) !== "aiuto_monitore";

  // Nome utente che ha verificato (se presente)
  const { data: verificato_da_nome } = useQuery({
    queryKey: ["utente_verificatore", a.verificato_da_user_id],
    queryFn: async () => {
      if (!a.verificato_da_user_id) return null;
      const { data } = await supabase.rpc("get_utente_club_display_name", {
        _user_id: a.verificato_da_user_id,
      });
      const s = (data as string | null) ?? "";
      return s.trim() || null;
    },
    enabled: !!a.verificato_da_user_id,
  });

  // Deep-link tab via ?tab=...
  const VALID_TABS = ["anagrafica", "livello", "corsi", "gare", "medagliere", "genitori", "fatture", "lezioni", "calendario", "storico_test"] as const;
  const [search_params, set_search_params] = useSearchParams();
  const initial_tab = (() => {
    const t = search_params.get("tab");
    return t && (VALID_TABS as readonly string[]).includes(t) ? t : "anagrafica";
  })();
  const [active_tab, set_active_tab] = useState<string>(initial_tab);
  // Sync quando l'URL cambia esternamente
  useEffect(() => {
    const t = search_params.get("tab");
    if (t && (VALID_TABS as readonly string[]).includes(t) && t !== active_tab) {
      set_active_tab(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search_params]);
  const handle_tab_change = (v: string) => {
    set_active_tab(v);
    const next = new URLSearchParams(search_params);
    if (v === "anagrafica") next.delete("tab"); else next.set("tab", v);
    set_search_params(next, { replace: true });
  };


  const [form, set_form] = useState({
    ...a,
    e_aiuto_monitrice: !!a.e_aiuto_monitrice,
    e_monitrice: !!a.e_monitrice,
    // nuovo modello (con fallback dal valore legacy in DB)
    categoria: a.categoria || (a.carriera_artistica ? "artistica" : a.livello_amatori || /^Stellina/.test(a.livello_attuale || "") ? "amatori" : "pulcini"),
    livello_amatori: a.livello_amatori || (a.livello_attuale && /^Stellina/.test(a.livello_attuale) ? a.livello_attuale : null),
    livello_artistica: a.livello_artistica || a.carriera_artistica || null,
    livello_artistica_in_preparazione: a.livello_artistica_in_preparazione || null,
    livello_stile: a.livello_stile || a.carriera_stile || null,
    livello_stile_in_preparazione: a.livello_stile_in_preparazione || null,
    // legacy (mantenuti per altre tab)
    percorso_amatori: a.percorso_amatori || a.livello_amatori || "Pulcini",
    carriera_artistica: a.carriera_artistica || "",
    carriera_stile: a.carriera_stile || "",
    licenza_sis_numero: a.licenza_sis_numero || "",
    licenza_sis_categoria: a.licenza_sis_categoria || "",
    licenza_sis_disciplina: a.licenza_sis_disciplina || "",
    licenza_sis_validita_da: a.licenza_sis_validita_da || "",
    licenza_sis_validita_a: a.licenza_sis_validita_a || "",
    genitore1_nome: a.genitore1_nome || a.genitore_1?.nome || "",
    genitore1_cognome: a.genitore1_cognome || a.genitore_1?.cognome || "",
    genitore1_telefono: a.genitore1_telefono || a.genitore_1?.telefono || "",
    genitore1_email: a.genitore1_email || a.genitore_1?.email || "",
    genitore2_nome: a.genitore2_nome || a.genitore_2?.nome || "",
    genitore2_cognome: a.genitore2_cognome || a.genitore_2?.cognome || "",
    genitore2_telefono: a.genitore2_telefono || a.genitore_2?.telefono || "",
    genitore2_email: a.genitore2_email || a.genitore_2?.email || "",
    foto_url: a.foto_url || "",
    disco_url: a.disco_url || "",
    disco_in_preparazione: a.disco_in_preparazione || "",
    compenso_orario_pista_str: (() => {
      const n = to_num(a.compenso_orario_pista);
      return n === 0 ? "" : String(n);
    })(),
  });

  // Compenso staff modal state (apre dopo save se un flag staff è stato appena attivato)
  const [pending_compenso, set_pending_compenso] = useState<null | {
    livello: "monitrice" | "aiuto_monitrice";
    rollback_field: "e_aiuto_monitrice" | "e_monitrice";
  }>(null);
  const eta_atleta = useMemo(() => calculate_age(a.data_nascita), [a.data_nascita]);
  const staff_disabled = eta_atleta < 12;

  const [uploading_foto, set_uploading_foto] = useState(false);
  const [uploading_disco, set_uploading_disco] = useState(false);

  const { data: corsi = [] } = use_corsi();
  const { data: gare = [] } = use_gare();
  const { data: fatture = [] } = use_fatture();
  const { data: lezioni = [] } = use_lezioni_private();
  const { data: istruttori = [] } = use_istruttori();
  const { data: adesioni = [] } = use_adesioni_atleta();
  const atleta_attivo = a.attivo !== false;

  const athlete_corsi = corsi.filter((c: any) => c.atleti_ids.includes(a.id));
  const athlete_gare = gare.filter((g: any) => g.atleti_iscritti.some((ai: any) => ai.atleta_id === a.id));
  const athlete_fatture = fatture.filter((f: any) => f.atleta_id === a.id);
  const athlete_lezioni = lezioni.filter((l: any) => l.atleti_ids.includes(a.id));

  const medals = athlete_gare.flatMap((g: any) =>
    g.atleti_iscritti
      .filter((ai: any) => ai.atleta_id === a.id && ai.medaglia)
      .map((ai: any) => ({
        gara: g.nome,
        data: g.data,
        medaglia: ai.medaglia,
        punteggio_tecnico: ai.punteggio_tecnico,
        punteggio_artistico: ai.punteggio_artistico,
        punteggio: ai.punteggio,
        posizione: ai.posizione,
      })),
  );

  const count_medaglia = (tipo: string) =>
    medals.filter((m: any) => m.medaglia?.toLowerCase() === tipo.toLowerCase()).length;

  const upd = (k: string, v: any) => set_form((p: any) => ({ ...p, [k]: v }));
  const is_carriera_attiva = form.percorso_amatori === "Stellina 4";

  const PORTALE_BASE_URL = "https://skate-club-hub.lovable.app/portale-atleta";
  // L'identificatore del portale web è ora il codice_atleta (AT-XXXX-XXXX),
  // lo stesso usato dall'app mobile genitori. Niente più portal_token separato.
  const codice_atleta_value: string | null = (form as any)?.codice_atleta ?? null;
  const portal_url = codice_atleta_value
    ? `${PORTALE_BASE_URL}/${encodeURIComponent(codice_atleta_value)}`
    : null;
  const portal_qr_src = portal_url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(portal_url)}`
    : null;

  const handle_genera_portal = async () => {
    set_generating_portal(true);
    try {
      if (!codice_atleta_value) {
        toast({ title: "Codice atleta mancante", description: "Salva l'atleta per generare il codice di accesso.", variant: "destructive" });
        return;
      }
      set_show_qr_portal(true);
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    } finally {
      set_generating_portal(false);
    }
  };



  const handle_copy_portal_link = async () => {
    if (!portal_url) return;
    try {
      await navigator.clipboard.writeText(portal_url);
      toast({ title: "🔗 Link copiato negli appunti" });
    } catch {
      toast({ title: "Impossibile copiare", variant: "destructive" });
    }
  };

  const handle_share_portal_link = async () => {
    if (!portal_url) return;
    const share_data = {
      title: "Portale atleta",
      text: `Accesso portale di ${form.nome} ${form.cognome}`,
      url: portal_url,
    };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(share_data);
      } else {
        await navigator.clipboard.writeText(portal_url);
        toast({ title: "🔗 Link copiato", description: "Condivisione non supportata, link copiato negli appunti" });
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({ title: "Impossibile condividere", description: err?.message, variant: "destructive" });
      }
    }
  };

  const handle_foto_upload = async (file: File) => {
    set_uploading_foto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${get_current_club_id()}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("foto-atleti").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("foto-atleti").getPublicUrl(path);
      upd("foto_url", data.publicUrl);
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
      const { error } = await supabase.storage.from("dischi-audio").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("dischi-audio").getPublicUrl(path);
      upd("disco_url", data.publicUrl);
      toast({ title: "✅ Disco caricato" });
    } catch (err: any) {
      toast({ title: "Errore upload disco", description: err?.message, variant: "destructive" });
    } finally {
      set_uploading_disco(false);
    }
  };

  const handle_marca_verificato = async () => {
    set_verifying(true);
    try {
      const { error } = await supabase
        .from("atleti")
        .update({
          verificato: true,
          verificato_da_user_id: session?.user_id ?? null,
          verificato_at: new Date().toISOString(),
        } as any)
        .eq("id", a.id);
      if (error) throw error;
      // aggiorna form locale e cache
      set_form((p: any) => ({
        ...p,
        verificato: true,
        verificato_da_user_id: session?.user_id ?? null,
        verificato_at: new Date().toISOString(),
      }));
      a.verificato = true;
      await query_client.invalidateQueries({ queryKey: ["atleti"] });
      toast({ title: "✅ Atleta marcato come verificato" });
      set_confirm_verifica(false);
    } catch (err: any) {
      toast({ title: "Errore verifica", description: err?.message, variant: "destructive" });
    } finally {
      set_verifying(false);
    }
  };

  const handle_save = async () => {
    // Snapshot delle flag staff PRIMA del save per capire se abbiamo appena attivato un ruolo
    const flag_attivata: "monitrice" | "aiuto_monitrice" | null =
      !a.e_monitrice && form.e_monitrice ? "monitrice" :
      !a.e_aiuto_monitrice && form.e_aiuto_monitrice ? "aiuto_monitrice" :
      null;

    try {
      await upsert.mutateAsync({
        id: a.id,
        nome: form.nome,
        cognome: form.cognome,
        data_nascita: form.data_nascita,
        // nuovo modello
        categoria: form.categoria,
        livello_amatori: form.livello_amatori || null,
        livello_artistica: form.livello_artistica || null,
        livello_artistica_in_preparazione: form.livello_artistica_in_preparazione || null,
        livello_stile: form.livello_stile || null,
        livello_stile_in_preparazione: form.livello_stile_in_preparazione || null,
        // legacy mantenuti
        percorso_amatori: form.percorso_amatori,
        carriera_artistica: form.livello_artistica || (is_carriera_attiva ? form.carriera_artistica || null : null),
        carriera_stile: form.livello_stile || (is_carriera_attiva ? form.carriera_stile || null : null),
        licenza_sis_numero: form.licenza_sis_numero || null,
        licenza_sis_categoria: form.licenza_sis_categoria || null,
        licenza_sis_disciplina: form.licenza_sis_disciplina || null,
        licenza_sis_validita_da: form.licenza_sis_validita_da || null,
        licenza_sis_validita_a: form.licenza_sis_validita_a || null,
        atleta_federazione: is_carriera_attiva ? form.atleta_federazione : false,
        ore_pista_stagione: form.ore_pista_stagione,
        genitore1_nome: form.genitore1_nome,
        genitore1_cognome: form.genitore1_cognome,
        genitore1_telefono: form.genitore1_telefono,
        genitore1_email: form.genitore1_email,
        genitore1_indirizzo: form.genitore1_indirizzo || null,
        genitore1_cap: form.genitore1_cap || null,
        genitore1_citta: form.genitore1_citta || null,
        genitore1_cantone: form.genitore1_cantone || null,
        genitore2_nome: form.genitore2_nome,
        genitore2_cognome: form.genitore2_cognome,
        genitore2_telefono: form.genitore2_telefono,
        genitore2_email: form.genitore2_email,
        genitore2_indirizzo: form.genitore2_indirizzo || null,
        genitore2_cap: form.genitore2_cap || null,
        genitore2_citta: form.genitore2_citta || null,
        genitore2_cantone: form.genitore2_cantone || null,
        sesso: form.sesso || null,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        cantone: form.cantone || null,
        telefono: form.telefono || null,
        codice_fiscale: form.codice_fiscale || null,
        attivo: form.attivo !== false,
        note: form.note,
        disco_in_preparazione: form.disco_in_preparazione,
        tag_nfc: form.tag_nfc,
        foto_url: form.foto_url || null,
        disco_url: form.disco_url || null,
        ruolo_pista: form.ruolo_pista || "atleta",
        compenso_orario_pista: to_num(form.compenso_orario_pista_str),
        attivo_come_monitore: form.attivo_come_monitore || false,
        e_aiuto_monitrice: !!form.e_aiuto_monitrice,
        e_monitrice: !!form.e_monitrice,
      });
      toast({ title: "✅ Atleta salvata" });
      // Aggiorna lo snapshot locale così che un secondo save non riapra il modale
      a.e_aiuto_monitrice = !!form.e_aiuto_monitrice;
      a.e_monitrice = !!form.e_monitrice;
      // Apri modale compenso obbligatorio se abbiamo attivato un ruolo staff
      if (flag_attivata) {
        set_pending_compenso({
          livello: flag_attivata,
          rollback_field: flag_attivata === "monitrice" ? "e_monitrice" : "e_aiuto_monitrice",
        });
      }
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err?.message, variant: "destructive" });
    }
  };

  const handle_rollback_flag = async () => {
    if (!pending_compenso) return;
    const field = pending_compenso.rollback_field;
    try {
      const { error } = await supabase.from("atleti").update({ [field]: false } as any).eq("id", a.id);
      if (error) throw error;
      set_form((p: any) => ({ ...p, [field]: false }));
      (a as any)[field] = false;
      await query_client.invalidateQueries({ queryKey: ["atleti"] });
      await query_client.invalidateQueries({ queryKey: ["istruttori"] });
      toast({ title: "Ruolo rimosso" });
    } catch (err: any) {
      toast({ title: "Errore rollback", description: err?.message, variant: "destructive" });
    } finally {
      set_pending_compenso(null);
    }
  };

  const handle_migra = async (club_dest_id: string, note: string) => {
    try {
      await migra.mutateAsync({
        atleta_id: a.id,
        atleta_nome: `${a.nome} ${a.cognome}`,
        club_destinazione_id: club_dest_id,
        note,
      });
      toast({ title: "🚀 Atleta migrata con successo" });
      set_show_migra(false);
      on_back();
    } catch (err: any) {
      toast({ title: "Errore migrazione", description: err?.message, variant: "destructive" });
    }
  };

  const EditRow: React.FC<{ label: string; value: any; onChange: (v: string) => void; type?: string }> = ({
    label,
    value,
    onChange,
    type,
  }) => (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Input type={type || "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );

  const livello_display = form.carriera_artistica || form.carriera_stile ? null : form.percorso_amatori;

  return (
    <>
      {show_migra && (
        <MigraModal
          atleta={a}
          on_close={() => set_show_migra(false)}
          on_migra={handle_migra}
          saving={migra.isPending}
        />
      )}

      {pending_compenso && (
        <CompensoStaffModal
          open
          atleta={{ id: a.id, nome: form.nome, cognome: form.cognome }}
          livello={pending_compenso.livello}
          on_saved={() => {
            set_pending_compenso(null);
            query_client.invalidateQueries({ queryKey: ["istruttori"] });
          }}
          on_cancel={handle_rollback_flag}
        />
      )}


      <div className="space-y-6 animate-fade-in">
        {form.verificato === false && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700 px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
              <p className="flex-1 text-sm font-medium text-yellow-900 dark:text-yellow-100">
                ⚠️ Atleta importato da Excel{a.created_at ? ` il ${format_data_completa(a.created_at)}` : ""}, non ancora verificato
              </p>
              {can_verificare && !confirm_verifica && (
                <Button
                  size="sm"
                  onClick={() => set_confirm_verifica(true)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Marca come verificato
                </Button>
              )}
              {can_verificare && confirm_verifica && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-yellow-900 dark:text-yellow-100">Tutti i dati sono stati controllati?</span>
                  <Button size="sm" variant="outline" onClick={() => set_confirm_verifica(false)} disabled={verifying}>
                    No
                  </Button>
                  <Button size="sm" onClick={handle_marca_verificato} disabled={verifying} className="bg-green-600 hover:bg-green-700 text-white">
                    {verifying ? "..." : "Sì, conferma"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
        {form.verificato === true && form.verificato_at && form.verificato_da_user_id && (
          <p className="text-xs text-muted-foreground -mb-2">
            <CheckCircle2 className="w-3 h-3 inline-block mr-1 text-green-600" />
            Verificato il {format_data_completa(form.verificato_at)}
            {verificato_da_nome ? ` da ${verificato_da_nome}` : ""}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={on_back} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("atleti")}
          </Button>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handle_genera_portal}
              disabled={generating_portal}
              className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5"
              title={portal_url ?? "Genera QR di accesso al portale"}
            >
              <QrCode className="w-3.5 h-3.5" /> 📱 QR Accesso Portale
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => set_show_migra(true)}
              className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Migra
            </Button>
            <Button onClick={handle_save} disabled={upsert.isPending} className="bg-primary hover:bg-primary/90">
              <Save className="w-4 h-4 mr-2" /> {upsert.isPending ? "..." : t("salva")}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            {form.foto_url ? (
              <img
                src={form.foto_url}
                alt={form.nome}
                className="w-16 h-16 rounded-full object-cover border-2 border-border shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent text-lg font-bold">
                {form.nome?.[0]}
                {form.cognome?.[0]}
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 shadow-sm">
              <Upload className="w-3 h-3 text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handle_foto_upload(e.target.files[0])}
              />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            {(() => {
              const is_f = form.sesso === "F";
              const attiva = is_f ? "Attiva" : "Attivo";
              const inattiva = is_f ? "Inattiva" : "Inattivo";
              const federata = is_f ? "Federata" : "Federato";

              const cat = form.categoria;
              type Tile = { titolo: string; sottotitolo: string; bg: string; titolo_color: string; sub_color: string; extra?: string };
              const tiles: Tile[] = [];
              if (cat === "pulcini") {
                tiles.push({ titolo: "Pulcini", sottotitolo: "Categoria iniziale", bg: "#E6F1FB", titolo_color: "#042C53", sub_color: "#185FA5" });
              } else if (cat === "amatori") {
                if (form.livello_amatori) {
                  tiles.push({ titolo: form.livello_amatori, sottotitolo: "Categoria Amatori", bg: "#E1F5EE", titolo_color: "#04342C", sub_color: "#0F6E56" });
                }
              } else if (cat === "artistica") {
                if (form.livello_artistica) {
                  tiles.push({
                    titolo: form.livello_artistica,
                    sottotitolo: "Percorso Artistica",
                    bg: "#EEEDFE",
                    titolo_color: "#26215C",
                    sub_color: "#534AB7",
                    extra: form.livello_artistica_in_preparazione ? `Prepara ${form.livello_artistica_in_preparazione}` : undefined,
                  });
                } else if (form.livello_artistica_in_preparazione) {
                  // Stato di transizione: ha superato Stellina 4 ma non ancora Interbronzo
                  tiles.push({
                    titolo: `In preparazione ${form.livello_artistica_in_preparazione}`,
                    sottotitolo: "Artistica · In preparazione del primo test",
                    bg: "#F6F5FE",
                    titolo_color: "#534AB7",
                    sub_color: "#7B73C9",
                  });
                }
                if (form.livello_stile) {
                  tiles.push({ titolo: form.livello_stile, sottotitolo: "Percorso Stile", bg: "#FBEAF0", titolo_color: "#4B1528", sub_color: "#993556" });
                }
              }

              const has_flags = form.agonista || form.atleta_federazione || form.attivo_come_monitore;

              return (
                <div className="flex flex-col gap-2">
                  {/* Riga 1: Nome + stato */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-[17px] font-medium tracking-tight text-foreground leading-tight">
                      {form.nome} {form.cognome}
                    </h1>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block rounded-full"
                        style={{ width: 7, height: 7, backgroundColor: atleta_attivo ? "#22C55E" : "#9CA3AF" }}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {atleta_attivo ? attiva : inattiva}
                      </span>
                    </span>
                  </div>

                  {/* Riga 2: Codice atleta */}
                  {form.codice_atleta && (
                    <div className="font-mono text-[12px] text-muted-foreground/80">
                      {form.codice_atleta}
                    </div>
                  )}

                  {/* Riga 3: Tassello/i livello */}
                  {tiles.length > 0 && (
                    <div
                      className={tiles.length === 2 ? "grid grid-cols-2 gap-2" : ""}
                      style={tiles.length === 2 ? undefined : undefined}
                    >
                      {tiles.map((tile, i) => (
                        <div
                          key={i}
                          className="rounded-md"
                          style={{ backgroundColor: tile.bg, padding: "10px 14px" }}
                        >
                          <div style={{ fontSize: 19, fontWeight: 500, color: tile.titolo_color, lineHeight: 1.2 }}>
                            {tile.titolo}
                          </div>
                          <div style={{ fontSize: 12, color: tile.sub_color, marginTop: 2 }}>
                            {tile.sottotitolo}
                          </div>
                          {tile.extra && (
                            <div style={{ fontSize: 11, color: tile.sub_color, marginTop: 4, opacity: 0.85, fontStyle: "italic" }}>
                              {tile.extra}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Riga 4: flag */}
                  {has_flags && (
                    <div className="flex items-center gap-3 flex-wrap text-[12px] text-muted-foreground mt-0.5">
                      {form.agonista && (
                        <span className="inline-flex items-center gap-1">
                          <Trophy className="w-[14px] h-[14px]" />
                          Agonista
                        </span>
                      )}
                      {form.atleta_federazione && (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="w-[14px] h-[14px]" />
                          {federata}
                        </span>
                      )}
                      {form.attivo_come_monitore && (
                        <span className="inline-flex items-center gap-1">
                          <UserCog className="w-[14px] h-[14px]" />
                          Monitore
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        <Tabs value={active_tab} onValueChange={handle_tab_change}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="anagrafica">{t("anagrafica")}</TabsTrigger>
            <TabsTrigger value="livello">{t("livello")}</TabsTrigger>
            <TabsTrigger value="corsi">{t("corsi")}</TabsTrigger>
            <TabsTrigger value="gare">{t("gare")}</TabsTrigger>
            <TabsTrigger value="medagliere">{t("medagliere")}</TabsTrigger>
            <TabsTrigger value="genitori">{t("genitori")}</TabsTrigger>
            <TabsTrigger value="fatture">{t("fatture")}</TabsTrigger>
            <TabsTrigger value="lezioni">{t("lezioni")}</TabsTrigger>
            <TabsTrigger value="calendario">Calendario</TabsTrigger>
            <TabsTrigger value="storico_test">Storico Test</TabsTrigger>
          </TabsList>

          {/* ── Anagrafica ── */}
          <TabsContent value="anagrafica" className="mt-6">
            <div className="bg-card rounded-xl shadow-card p-6 space-y-4 max-w-lg">
              <EditRow label={t("nome")} value={form.nome} onChange={(v) => upd("nome", v)} />
              <EditRow label={t("cognome")} value={form.cognome} onChange={(v) => upd("cognome", v)} />
              <div className="flex justify-between items-center py-1 gap-3">
                <span className="text-sm text-muted-foreground">{t("data_nascita")}</span>
                <DateInput
                  value={form.data_nascita?.split("T")[0] || ""}
                  onChange={(v) => upd("data_nascita", v)}
                />
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">{t("eta")}</span>
                <span className="text-sm font-medium text-foreground">{calculate_age(form.data_nascita)} anni</span>
              </div>
              <EditRow
                label={t("ore_pista")}
                value={form.ore_pista_stagione}
                onChange={(v) => upd("ore_pista_stagione", Number(v))}
                type="number"
              />
              <EditRow label="TAG NFC" value={form.tag_nfc || ""} onChange={(v) => upd("tag_nfc", v)} />

              <div className="pt-3 border-t border-border space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Indirizzo atleta</p>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Sesso</Label>
                  <Select value={form.sesso || ""} onValueChange={(v) => upd("sesso", v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Femmina</SelectItem>
                      <SelectItem value="M">Maschio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Indirizzo</Label>
                  <Input value={form.indirizzo || ""} onChange={(e) => upd("indirizzo", e.target.value)} className="h-9" placeholder="Via, numero" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">CAP</Label>
                    <Input value={form.cap || ""} onChange={(e) => upd("cap", e.target.value)} maxLength={4} className="h-9" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Città</Label>
                    <Input value={form.citta || ""} onChange={(e) => upd("citta", e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Cantone</Label>
                  <Select value={form.cantone || ""} onValueChange={(v) => upd("cantone", v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {CANTONI_CH.map(([code, nome]) => (
                        <SelectItem key={code} value={code}>{code} — {nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Telefono</Label>
                    <Input type="tel" value={form.telefono || ""} onChange={(e) => upd("telefono", e.target.value)} className="h-9" placeholder="+41 ..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Codice fiscale</Label>
                    <Input value={form.codice_fiscale || ""} onChange={(e) => upd("codice_fiscale", e.target.value)} className="h-9" />
                  </div>
                </div>
              </div>


              <div className="pt-3 border-t border-border space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Licenza Swiss Ice Skating</p>
                <EditRow
                  label="N° licenza SIS"
                  value={form.licenza_sis_numero || ""}
                  onChange={(v) => upd("licenza_sis_numero", v)}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <EditRow
                    label="Categoria SIS"
                    value={form.licenza_sis_categoria || ""}
                    onChange={(v) => upd("licenza_sis_categoria", v)}
                  />
                  <EditRow
                    label="Disciplina SIS"
                    value={form.licenza_sis_disciplina || ""}
                    onChange={(v) => upd("licenza_sis_disciplina", v)}
                  />
                  <div className="flex justify-between items-center py-1 gap-3">
                    <span className="text-sm text-muted-foreground">Validità fino al</span>
                    <DateInput
                      value={form.licenza_sis_validita_a?.split("T")[0] || ""}
                      onChange={(v) => upd("licenza_sis_validita_a", v)}
                      min_year={2000}
                      max_year={2100}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Disco in preparazione</Label>
                <Input
                  value={form.disco_in_preparazione || ""}
                  onChange={(e) => upd("disco_in_preparazione", e.target.value)}
                  placeholder="es. Romeo e Giulietta - Prokofiev"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">File audio disco</Label>
                {form.disco_url && (
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    <Music className="w-4 h-4 text-primary flex-shrink-0" />
                    <audio controls src={form.disco_url} className="flex-1 h-8" />
                  </div>
                )}
                <label
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-muted/30 text-sm text-muted-foreground transition-colors w-fit ${uploading_disco ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <Upload className="w-4 h-4" />
                  {uploading_disco ? "Caricamento..." : form.disco_url ? "Sostituisci disco" : "Carica disco audio"}
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handle_disco_upload(e.target.files[0])}
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">{t("note")}</Label>
                <Textarea value={form.note || ""} onChange={(e) => upd("note", e.target.value)} />
              </div>
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
                <input
                  type="checkbox"
                  id="attivo_atleta"
                  checked={form.attivo !== false}
                  onChange={(e) => upd("attivo", e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="attivo_atleta" className="text-sm font-medium text-foreground cursor-pointer">
                  Atleta attiva
                </label>
              </div>
            </div>
          </TabsContent>

          {/* ── Livello ── */}
          <TabsContent value="livello" className="mt-6">
            <div className="space-y-6 max-w-2xl">
              {/* ─── Sezione Categoria ─── */}
              <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Categoria</h3>
                  <Badge variant="outline" className="capitalize">{form.categoria}</Badge>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Stadio della carriera</Label>
                  <Select
                    value={form.categoria}
                    onValueChange={(v) => {
                      set_form((p: any) => ({
                        ...p,
                        categoria: v,
                        // applico default sensati
                        livello_amatori: v === "amatori" && !p.livello_amatori ? "Stellina 1" : p.livello_amatori,
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pulcini">Pulcini</SelectItem>
                      <SelectItem value="amatori">Amatori</SelectItem>
                      <SelectItem value="artistica">Artistica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.categoria !== "artistica" && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      if (form.categoria === "pulcini") {
                        set_form((p: any) => ({ ...p, categoria: "amatori", livello_amatori: p.livello_amatori || "Stellina 1" }));
                        toast({ title: "🎉 Promosso ad Amatori", description: "Livello iniziale: Stellina 1" });
                      } else if (form.categoria === "amatori") {
                        set_form((p: any) => ({ ...p, categoria: "artistica" }));
                        toast({
                          title: "🎉 Promosso ad Artistica",
                          description: "Livello amatori mantenuto come fallback fino al superamento di Interbronzo",
                        });
                      }
                    }}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Promuovi a {form.categoria === "pulcini" ? "Amatori" : "Artistica"}
                  </Button>
                )}
              </div>

              {/* ─── Sezione Livelli ─── */}
              {form.categoria !== "pulcini" && (
                <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Livelli</h3>

                  {(form.categoria === "amatori" || form.categoria === "artistica") && (
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">
                        Livello amatori {form.categoria === "artistica" && <span className="italic text-xs">(fallback)</span>}
                      </Label>
                      <Select
                        value={form.livello_amatori || "__none__"}
                        onValueChange={(v) => upd("livello_amatori", v === "__none__" ? null : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Nessuno —</SelectItem>
                          {["Stellina 1", "Stellina 2", "Stellina 3", "Stellina 4"].map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {form.categoria === "artistica" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground">Livello artistica</Label>
                          <SelectLivello
                            value={form.livello_artistica}
                            onChange={(v) => upd("livello_artistica", v)}
                            fase="carriera"
                            allowNull={true}
                            nullLabel="— Nessuno —"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground">In preparazione</Label>
                          <SelectLivello
                            value={form.livello_artistica_in_preparazione}
                            onChange={(v) => upd("livello_artistica_in_preparazione", v)}
                            fase="carriera"
                            allowNull={true}
                            nullLabel="— Nessuno —"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground">Livello stile</Label>
                          <SelectLivello
                            value={form.livello_stile}
                            onChange={(v) => upd("livello_stile", v)}
                            fase="carriera"
                            allowNull={true}
                            nullLabel="— Nessuno —"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground">In preparazione</Label>
                          <SelectLivello
                            value={form.livello_stile_in_preparazione}
                            onChange={(v) => upd("livello_stile_in_preparazione", v)}
                            fase="carriera"
                            allowNull={true}
                            nullLabel="— Nessuno —"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
                        <input
                          type="checkbox"
                          id="fed_check"
                          checked={!!form.atleta_federazione}
                          onChange={(e) => upd("atleta_federazione", e.target.checked)}
                          className="w-4 h-4 accent-primary"
                        />
                        <label htmlFor="fed_check" className="text-sm font-medium text-foreground cursor-pointer">
                          Atleta federazione
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─── Storico Test ─── */}
              <div className="bg-card rounded-xl shadow-card p-6 space-y-3">
                <h3 className="text-sm font-bold text-foreground">Storico Test</h3>
                <StoricoTestAtleta atleta_id={a.id} />
              </div>

              {/* ─── Ruolo in pista ─── */}
              <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Ruolo in pista</h3>
                  {staff_disabled && (
                    <span className="text-[10px] text-muted-foreground">Disponibile dai 12 anni</span>
                  )}
                </div>
                <div className="space-y-2">
                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border ${staff_disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/30"}`}
                    title={staff_disabled ? "Disponibile dai 12 anni di età" : ""}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-orange-500"
                      disabled={staff_disabled}
                      checked={!!form.e_aiuto_monitrice}
                      onChange={(e) => {
                        const v = e.target.checked;
                        set_form((p: any) => ({ ...p, e_aiuto_monitrice: v, e_monitrice: v ? false : p.e_monitrice }));
                      }}
                    />
                    <span className="text-sm">Aiuto monitrice</span>
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">aiuto</span>
                  </label>
                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border ${staff_disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/30"}`}
                    title={staff_disabled ? "Disponibile dai 12 anni di età" : ""}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-purple-500"
                      disabled={staff_disabled}
                      checked={!!form.e_monitrice}
                      onChange={(e) => {
                        const v = e.target.checked;
                        set_form((p: any) => ({ ...p, e_monitrice: v, e_aiuto_monitrice: v ? false : p.e_aiuto_monitrice }));
                      }}
                    />
                    <span className="text-sm">Monitrice</span>
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">monitrice</span>
                  </label>
                </div>
                {(form.e_monitrice || form.e_aiuto_monitrice) && (
                  <p className="text-[11px] text-muted-foreground">
                    Dopo il salvataggio si aprirà il modulo per impostare il compenso.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Corsi ── */}
          <TabsContent value="corsi" className="mt-6">
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
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("giorno")}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("ora_inizio")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {athlete_corsi.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Nessun corso iscritto.
                      </td>
                    </tr>
                  ) : (
                    athlete_corsi.map((c: any) => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.tipo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.giorno}</td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {c.ora_inizio?.slice(0, 5)} - {c.ora_fine?.slice(0, 5)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Gare ── */}
          <TabsContent value="gare" className="mt-6">
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("nome")}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("data")}
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Tecnico
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Artistico
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
                  {athlete_gare.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Nessuna gara registrata.
                      </td>
                    </tr>
                  ) : (
                    athlete_gare.map((g: any) => {
                      const entry = g.atleti_iscritti.find((ai: any) => ai.atleta_id === a.id);
                      return (
                        <tr key={g.id} className="border-b border-border/50">
                          <td className="px-4 py-3 font-medium text-foreground">{g.nome}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(g.data + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                            {entry?.punteggio_tecnico ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                            {entry?.punteggio_artistico ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                            {entry?.posizione ? `${entry.posizione}°` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry?.medaglia ? <MedalBadge tipo={entry.medaglia} /> : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Medagliere ── */}
          <TabsContent value="medagliere" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { tipo: "Oro", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                { tipo: "Argento", color: "bg-slate-50 text-slate-600 border-slate-200" },
                { tipo: "Bronzo", color: "bg-orange-50 text-orange-700 border-orange-200" },
              ].map(({ tipo, color }) => (
                <div key={tipo} className={`rounded-xl border p-6 text-center ${color}`}>
                  <Medal className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-3xl font-bold tabular-nums">{count_medaglia(tipo)}</p>
                  <p className="text-sm font-medium mt-1">{tipo}</p>
                </div>
              ))}
            </div>
            {medals.length > 0 ? (
              <div className="bg-card rounded-xl shadow-card p-5 space-y-2">
                {medals
                  .sort((a: any, b: any) => (b.data || "").localeCompare(a.data || ""))
                  .map((m: any, i: number) => {
                    const pt = m.punteggio_tecnico;
                    const pa = m.punteggio_artistico;
                    const totale = pt != null && pa != null ? (Number(pt) + Number(pa)).toFixed(2) : m.punteggio;
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <MedalBadge tipo={m.medaglia} />
                        <span className="font-medium text-foreground">{m.gara}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {totale ? `— ${totale}pts` : ""}
                          {m.posizione ? `, #${m.posizione}` : ""}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="bg-card rounded-xl shadow-card p-8 text-center text-muted-foreground">
                <Medal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nessuna medaglia ancora.</p>
              </div>
            )}
          </TabsContent>

          {/* ── Genitori ── */}
          <TabsContent value="genitori" className="mt-6 space-y-6">
            <CodiceAtletaCard
              atleta={form}
              on_updated={(nuovo) => upd("codice_atleta", nuovo)}
            />
            {[
              { label: t("genitore_1"), prefix: "genitore1", collapsible: false },
              { label: t("genitore_2"), prefix: "genitore2", collapsible: true },
            ].map(({ label, prefix, collapsible }) => {
              const has_g2_data = prefix === "genitore2" && (form.genitore2_nome || form.genitore2_email || form.genitore2_indirizzo);
              const body = (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {["nome", "cognome", "telefono", "email"].map((field) => (
                      <div key={field} className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground">{t(field)}</Label>
                        <Input
                          type={field === "email" ? "email" : field === "telefono" ? "tel" : "text"}
                          value={form[`${prefix}_${field}`] || ""}
                          onChange={(e) => upd(`${prefix}_${field}`, e.target.value)}
                          className="h-9"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Indirizzo</Label>
                    <Input value={form[`${prefix}_indirizzo`] || ""} onChange={(e) => upd(`${prefix}_indirizzo`, e.target.value)} className="h-9" placeholder="Via, numero" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">CAP</Label>
                      <Input value={form[`${prefix}_cap`] || ""} onChange={(e) => upd(`${prefix}_cap`, e.target.value)} maxLength={4} className="h-9" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-sm text-muted-foreground">Città</Label>
                      <Input value={form[`${prefix}_citta`] || ""} onChange={(e) => upd(`${prefix}_citta`, e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Cantone</Label>
                    <Select value={form[`${prefix}_cantone`] || ""} onValueChange={(v) => upd(`${prefix}_cantone`, v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {CANTONI_CH.map(([code, nome]) => (
                          <SelectItem key={code} value={code}>{code} — {nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
              if (collapsible) {
                return (
                  <details key={prefix} className="bg-card rounded-xl shadow-card p-5" open={!!has_g2_data}>
                    <summary className="text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">{label}</summary>
                    <div className="mt-4">{body}</div>
                  </details>
                );
              }
              return (
                <div key={prefix} className="bg-card rounded-xl shadow-card p-5 space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</h4>
                  {body}
                </div>
              );
            })}
          </TabsContent>

          {/* ── Fatture ── */}
          <TabsContent value="fatture" className="mt-6">
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("numero_fattura")}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("descrizione")}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("importo")}
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("stato")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {athlete_fatture.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Nessuna fattura.
                      </td>
                    </tr>
                  ) : (
                    athlete_fatture.map((f: any) => (
                      <tr key={f.id} className="border-b border-border/50">
                        <td className="px-4 py-3 font-medium tabular-nums text-foreground">{f.numero}</td>
                        <td className="px-4 py-3 text-muted-foreground">{f.descrizione}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                          CHF {Number(f.importo).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={f.stato === "pagata" ? "default" : "destructive"} className="text-xs">
                            {t(f.stato)}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Lezioni ── */}
          <TabsContent value="lezioni" className="mt-6">
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("data")}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("istruttori")}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("ora_inizio")}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {t("importo")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {athlete_lezioni.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Nessuna lezione privata.
                      </td>
                    </tr>
                  ) : (
                    athlete_lezioni.map((l: any) => (
                      <tr key={l.id} className="border-b border-border/50">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(l.data + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {get_istruttore_name_from_list(istruttori, l.istruttore_id)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {l.ora_inizio?.slice(0, 5)} - {l.ora_fine?.slice(0, 5)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                          CHF {Number(l.costo || l.costo_totale || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Calendario ── */}
          <TabsContent value="calendario" className="mt-6">
            <CalendarioAtletaInterattivo atleta_id={a.id} />
          </TabsContent>

          {/* ── Storico Test ── */}
          <TabsContent value="storico_test" className="mt-6">
            <StoricoTestAtleta atleta_id={a.id} />
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={show_qr_portal} onOpenChange={set_show_qr_portal}>
        <DialogContent className="max-w-md print:max-w-full print:shadow-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" /> QR Accesso Portale
            </DialogTitle>
          </DialogHeader>
          <div id="qr-portale-print" className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                Scansiona per accedere al portale personale di{" "}
                <span className="font-semibold text-foreground">{form.nome} {form.cognome}</span>
              </p>
            </div>
            <div className="flex justify-center">
              {portal_qr_src ? (
                <img src={portal_qr_src} alt="QR portale atleta" className="w-64 h-64 rounded-xl border border-border bg-background p-2" />
              ) : (
                <div className="w-64 h-64 bg-muted rounded-xl animate-pulse" />
              )}
            </div>
            <div className="space-y-1.5 print:hidden">
              <Label className="text-xs text-muted-foreground">Link diretto</Label>
              <div className="flex gap-2">
                <Input readOnly value={portal_url ?? ""} className="font-mono text-xs h-9" onFocus={(e) => e.currentTarget.select()} />
                <Button size="sm" variant="outline" onClick={handle_copy_portal_link} className="shrink-0">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground hidden print:block break-all">{portal_url}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end pt-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" /> Stampa QR
            </Button>
            <Button variant="outline" size="sm" onClick={handle_share_portal_link}>
              <Share2 className="w-4 h-4 mr-1.5" /> Condividi link
            </Button>
            <Button size="sm" onClick={() => set_show_qr_portal(false)}>Chiudi</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const MedalBadge: React.FC<{ tipo: string }> = ({ tipo }) => {
  const tipo_lower = tipo?.toLowerCase();
  const colors: Record<string, string> = {
    oro: "bg-yellow-100 text-yellow-700",
    argento: "bg-slate-100 text-slate-600",
    bronzo: "bg-orange-100 text-orange-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[tipo_lower] || ""}`}>{tipo}</span>;
};

export default AtletaDetail;
