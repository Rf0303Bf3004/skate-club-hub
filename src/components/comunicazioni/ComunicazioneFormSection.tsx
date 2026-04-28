import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, X, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { use_livelli } from "@/hooks/use-supabase-data";

export type TipoDestinatariMulti = "tutti" | "per_corso" | "per_livello" | "atleti";

export type ComunicazioneFormState = {
  invia: boolean;
  titolo: string;
  testo: string;
  tipo_destinatari: TipoDestinatariMulti;
  corsi_ids: string[];
  livelli: string[];
  atleti_ids: string[];
};

export const empty_comunicazione_state = (defaults?: Partial<ComunicazioneFormState>): ComunicazioneFormState => ({
  invia: true,
  titolo: "",
  testo: "",
  tipo_destinatari: "tutti",
  corsi_ids: [],
  livelli: [],
  atleti_ids: [],
  ...defaults,
});

type CorsoOpt = { id: string; label: string };
type AtletaOpt = { id: string; label: string; livello?: string | null };

interface Props {
  state: ComunicazioneFormState;
  onChange: (next: ComunicazioneFormState) => void;
  corsi?: CorsoOpt[];
  atleti?: AtletaOpt[];
  label?: string;
  description?: string;
}

export const ComunicazioneFormSection: React.FC<Props> = ({
  state,
  onChange,
  corsi = [],
  atleti = [],
  label,
  description,
}) => {
  const { t } = useI18n();
  const { data: livelli_db = [] } = use_livelli();

  const upd = <K extends keyof ComunicazioneFormState>(k: K, v: ComunicazioneFormState[K]) =>
    onChange({ ...state, [k]: v });

  const toggle_in_array = (key: "corsi_ids" | "livelli" | "atleti_ids", value: string) => {
    const cur = state[key] as string[];
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    onChange({ ...state, [key]: next });
  };

  const [atleta_search, set_atleta_search] = React.useState("");
  const filtered_atleti = React.useMemo(() => {
    const q = atleta_search.trim().toLowerCase();
    if (!q) return atleti;
    return atleti.filter((a) => a.label.toLowerCase().includes(q) || (a.livello ?? "").toLowerCase().includes(q));
  }, [atleti, atleta_search]);

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-start gap-2">
        <Checkbox
          id="comunicazione-invia"
          checked={state.invia}
          onCheckedChange={(v) => upd("invia", !!v)}
        />
        <div className="flex-1">
          <Label htmlFor="comunicazione-invia" className="cursor-pointer flex items-center gap-2">
            <Send className="w-4 h-4" /> {label ?? t("comunicazione_invia_subito")}
          </Label>
          <p className="text-xs text-muted-foreground">{description ?? t("comunicazione_descrizione")}</p>
        </div>
      </div>

      {state.invia && (
        <div className="space-y-3 pl-6">
          <div>
            <Label>{t("comunicazione_titolo")}</Label>
            <Input value={state.titolo} onChange={(e) => upd("titolo", e.target.value)} />
          </div>
          <div>
            <Label>{t("comunicazione_testo")}</Label>
            <Textarea
              value={state.testo}
              onChange={(e) => upd("testo", e.target.value)}
              rows={6}
            />
          </div>
          <div>
            <Label>{t("destinatari")}</Label>
            <Select
              value={state.tipo_destinatari}
              onValueChange={(v: TipoDestinatariMulti) =>
                onChange({ ...state, tipo_destinatari: v, corsi_ids: [], livelli: [], atleti_ids: [] })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutto il club</SelectItem>
                <SelectItem value="per_corso">Per corso</SelectItem>
                <SelectItem value="per_livello">Per livello</SelectItem>
                <SelectItem value="atleti">Atleti specifici</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.tipo_destinatari === "per_corso" && (
            <div className="space-y-2">
              <Label>Seleziona corsi</Label>
              {corsi.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun corso disponibile.</p>
              ) : (
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 bg-background">
                  {corsi.map((c) => {
                    const checked = state.corsi_ids.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                        <Checkbox checked={checked} onCheckedChange={() => toggle_in_array("corsi_ids", c.id)} />
                        <span>{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {state.corsi_ids.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {state.corsi_ids.map((id) => {
                    const c = corsi.find((x) => x.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {c?.label ?? id.slice(0, 8)}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => toggle_in_array("corsi_ids", id)} />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {state.tipo_destinatari === "per_livello" && (
            <div className="space-y-2">
              <Label>Seleziona livelli</Label>
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto bg-background">
                <div className="grid grid-cols-2 gap-1">
                  {livelli_db.map((l: any) => {
                    const checked = state.livelli.includes(l.nome);
                    return (
                      <label key={l.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                        <Checkbox checked={checked} onCheckedChange={() => toggle_in_array("livelli", l.nome)} />
                        <span>{l.nome}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {state.livelli.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {state.livelli.map((nome) => (
                    <Badge key={nome} variant="secondary" className="gap-1">
                      {nome}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => toggle_in_array("livelli", nome)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {state.tipo_destinatari === "atleti" && (
            <div className="space-y-2">
              <Label>Seleziona atleti</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Cerca per nome, cognome o livello…"
                  value={atleta_search}
                  onChange={(e) => set_atleta_search(e.target.value)}
                />
              </div>
              <div className="border rounded-md p-2 max-h-56 overflow-y-auto space-y-1 bg-background">
                {filtered_atleti.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2 py-1">Nessun atleta trovato.</p>
                ) : filtered_atleti.map((a) => {
                  const checked = state.atleti_ids.includes(a.id);
                  return (
                    <label key={a.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                      <Checkbox checked={checked} onCheckedChange={() => toggle_in_array("atleti_ids", a.id)} />
                      <span className="flex-1">{a.label}</span>
                      {a.livello && <Badge variant="outline" className="text-xs">{a.livello}</Badge>}
                    </label>
                  );
                })}
              </div>
              {state.atleti_ids.length > 0 && (
                <p className="text-xs text-muted-foreground">{state.atleti_ids.length} atleti selezionati</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const fmt_date_it = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("it-CH", { day: "2-digit", month: "long", year: "numeric" });
};

/**
 * Helper: insert record in `comunicazioni` collegata all'evento.
 * Ritorna number stimato di destinatari (per toast).
 */
export async function invia_comunicazione_evento(
  supabase: any,
  params: {
    club_id: string;
    state: ComunicazioneFormState;
    fk: { gara_id?: string; evento_straordinario_id?: string; test_livello_id?: string };
  }
) {
  const { club_id, state, fk } = params;

  const payload: any = {
    club_id,
    titolo: state.titolo,
    testo: state.testo,
    corpo: state.testo,
    tipo: "evento",
    tipo_destinatari: state.tipo_destinatari,
    corsi_ids: state.tipo_destinatari === "per_corso" ? (state.corsi_ids.length ? state.corsi_ids : null) : null,
    livelli: state.tipo_destinatari === "per_livello" ? (state.livelli.length ? state.livelli : null) : null,
    atleti_ids: state.tipo_destinatari === "atleti" ? (state.atleti_ids.length ? state.atleti_ids : null) : null,
    gara_id: fk.gara_id ?? null,
    evento_straordinario_id: fk.evento_straordinario_id ?? null,
    test_livello_id: fk.test_livello_id ?? null,
    stato: "inviata",
    inviata_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("comunicazioni").insert(payload);
  if (error) throw error;

  // Conteggio destinatari (stima, il trigger DB li popola comunque)
  let count = 0;
  if (state.tipo_destinatari === "tutti") {
    const { count: c } = await supabase
      .from("atleti")
      .select("id", { count: "exact", head: true })
      .eq("club_id", club_id);
    count = c ?? 0;
  } else if (state.tipo_destinatari === "per_corso" && state.corsi_ids.length > 0) {
    const { count: c } = await supabase
      .from("iscrizioni_corsi")
      .select("id", { count: "exact", head: true })
      .in("corso_id", state.corsi_ids)
      .eq("attiva", true);
    count = c ?? 0;
  } else if (state.tipo_destinatari === "per_livello" && state.livelli.length > 0) {
    const { count: c } = await supabase
      .from("atleti")
      .select("id", { count: "exact", head: true })
      .eq("club_id", club_id)
      .or(
        `carriera_artistica.in.(${state.livelli.map((l) => `"${l}"`).join(",")}),carriera_stile.in.(${state.livelli
          .map((l) => `"${l}"`)
          .join(",")}),livello_attuale.in.(${state.livelli.map((l) => `"${l}"`).join(",")})`
      );
    count = c ?? 0;
  } else if (state.tipo_destinatari === "atleti") {
    count = state.atleti_ids.length;
  }

  return count;
}

export const default_testo_gara = (nome: string, luogo: string, data: string) =>
  `Care atlete, vi convochiamo per ${nome || "la gara"} a ${luogo || "—"} il ${fmt_date_it(data)}. Confermate la partecipazione tramite l'app.`;

export const default_titolo_gara = (nome: string) => `Convocazione ${nome || "gara"}`;

export const default_testo_test = (nome: string, data: string) =>
  `Care atlete, è in programma il test ${nome || "di livello"} il ${fmt_date_it(data)}. Iscrivetevi tramite l'app.`;

export const default_titolo_test = (nome: string) => `Test livello ${nome || ""}`.trim();

export const default_testo_gala = (titolo: string, data: string, ora?: string | null, luogo?: string | null) =>
  `Care atlete, vi invitiamo a partecipare a ${titolo || "il nostro evento"} il ${fmt_date_it(data)}${ora ? ` alle ${ora.slice(0, 5)}` : ""}${luogo ? ` presso ${luogo}` : ""}.\n\nConfermate la partecipazione tramite l'app.`;

export const default_titolo_gala = (titolo: string) => `Convocazione ${titolo || "evento"}`;
