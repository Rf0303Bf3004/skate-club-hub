import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type ComunicazioneFormState = {
  invia: boolean;
  titolo: string;
  testo: string;
  tipo_destinatari: "tutti" | "corso" | "atleta";
  corso_id: string;
  atleta_id: string;
};

export const empty_comunicazione_state = (defaults?: Partial<ComunicazioneFormState>): ComunicazioneFormState => ({
  invia: true,
  titolo: "",
  testo: "",
  tipo_destinatari: "tutti",
  corso_id: "",
  atleta_id: "",
  ...defaults,
});

type Option = { id: string; label: string };

interface Props {
  state: ComunicazioneFormState;
  onChange: (next: ComunicazioneFormState) => void;
  corsi?: Option[];
  atleti?: Option[];
  /** label opzionale (override i18n) */
  label?: string;
  /** descrizione opzionale (override i18n) */
  description?: string;
}

/**
 * Sezione "Comunicazione" riutilizzabile per i form di creazione evento
 * (Galà, Gara, Test livello). Fornisce checkbox + campi titolo/testo/destinatari.
 */
export const ComunicazioneFormSection: React.FC<Props> = ({
  state,
  onChange,
  corsi = [],
  atleti = [],
  label,
  description,
}) => {
  const { t } = useI18n();
  const upd = <K extends keyof ComunicazioneFormState>(k: K, v: ComunicazioneFormState[K]) =>
    onChange({ ...state, [k]: v });

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
              rows={5}
            />
          </div>
          <div>
            <Label>{t("destinatari")}</Label>
            <Select
              value={state.tipo_destinatari}
              onValueChange={(v: "tutti" | "corso" | "atleta") =>
                onChange({ ...state, tipo_destinatari: v, corso_id: "", atleta_id: "" })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">{t("comunicazione_destinatari_tutti")}</SelectItem>
                <SelectItem value="corso">{t("comunicazione_destinatari_corso")}</SelectItem>
                <SelectItem value="atleta">{t("comunicazione_destinatari_atleta")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.tipo_destinatari === "corso" && (
            <div>
              <Label>{t("corsi")}</Label>
              <Select value={state.corso_id} onValueChange={(v) => upd("corso_id", v)}>
                <SelectTrigger><SelectValue placeholder={t("comunicazione_seleziona_corso")} /></SelectTrigger>
                <SelectContent>
                  {corsi.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">{t("comunicazione_nessun_corso")}</div>
                  ) : corsi.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {state.tipo_destinatari === "atleta" && (
            <div>
              <Label>{t("atleti")}</Label>
              <Select value={state.atleta_id} onValueChange={(v) => upd("atleta_id", v)}>
                <SelectTrigger><SelectValue placeholder={t("comunicazione_seleziona_atleta")} /></SelectTrigger>
                <SelectContent>
                  {atleti.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">{t("comunicazione_nessun_atleta")}</div>
                  ) : atleti.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    corso_id: state.tipo_destinatari === "corso" ? state.corso_id || null : null,
    atleta_id: state.tipo_destinatari === "atleta" ? state.atleta_id || null : null,
    gara_id: fk.gara_id ?? null,
    evento_straordinario_id: fk.evento_straordinario_id ?? null,
    test_livello_id: fk.test_livello_id ?? null,
    stato: "inviata",
    inviata_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("comunicazioni").insert(payload);
  if (error) throw error;

  // Conteggio destinatari (stima)
  let count = 0;
  if (state.tipo_destinatari === "tutti") {
    const { count: c } = await supabase
      .from("atleti")
      .select("id", { count: "exact", head: true })
      .eq("club_id", club_id);
    count = c ?? 0;
  } else if (state.tipo_destinatari === "corso" && state.corso_id) {
    const { count: c } = await supabase
      .from("iscrizioni_corsi")
      .select("id", { count: "exact", head: true })
      .eq("corso_id", state.corso_id)
      .eq("attiva", true);
    count = c ?? 0;
  } else if (state.tipo_destinatari === "atleta" && state.atleta_id) {
    count = 1;
  }

  return count;
}

export const default_testo_gara = (nome: string, luogo: string, data: string) =>
  `Care atlete, vi convochiamo per ${nome || "la gara"} a ${luogo || "—"} il ${fmt_date_it(data)}. Confermate la partecipazione tramite l'app.`;

export const default_titolo_gara = (nome: string) => `Convocazione ${nome || "gara"}`;

export const default_testo_test = (nome: string, data: string) =>
  `Care atlete, è in programma il test ${nome || "di livello"} il ${fmt_date_it(data)}. Iscrivetevi tramite l'app.`;

export const default_titolo_test = (nome: string) => `Test livello ${nome || ""}`.trim();
