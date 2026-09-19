import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Footprints, Mail, Phone } from "lucide-react";

export interface RichiestaProva {
  id: string;
  nome: string;
  cognome: string;
  data_nascita: string | null;
  genitore_nome: string | null;
  email: string | null;
  telefono: string | null;
  note: string | null;
  stato: "nuova" | "contattata" | "venuta" | "iscritta" | "chiusa";
  creata_il: string;
  note_club: string | null;
}

const STATI = ["nuova", "contattata", "venuta", "iscritta", "chiusa"] as const;
const APERTE = ["nuova", "contattata", "venuta"];

/** Le richieste di prova del club: la RLS limita già al club della sessione. */
export function use_richieste_prova() {
  return useQuery({
    queryKey: ["richieste_prova"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("richieste_prova")
        .select("*")
        .order("creata_il", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RichiestaProva[];
    },
  });
}

function eta_da(data_nascita: string | null): number | null {
  if (!data_nascita) return null;
  const nascita = new Date(data_nascita + "T00:00:00");
  if (isNaN(nascita.getTime())) return null;
  const oggi = new Date();
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const m = oggi.getMonth() - nascita.getMonth();
  if (m < 0 || (m === 0 && oggi.getDate() < nascita.getDate())) eta--;
  return eta >= 0 && eta < 120 ? eta : null;
}

function giorni_da(iso: string): number {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

const RigaProva: React.FC<{ r: RichiestaProva; puo_gestire: boolean; on_salvata: () => void }> = ({
  r,
  puo_gestire,
  on_salvata,
}) => {
  const { t } = useTranslation("atleti");
  const k = (s: string, o?: any) => t(`iscrizioni_stagione.prove.${s}`, o as any) as string;

  const [stato, set_stato] = useState(r.stato);
  const [note_club, set_note_club] = useState(r.note_club ?? "");
  const [salvando, set_salvando] = useState(false);
  const [errore_salvataggio, set_errore_salvataggio] = useState<string | null>(null);

  const eta = eta_da(r.data_nascita);
  const giorni = giorni_da(r.creata_il);
  const sporco = stato !== r.stato || note_club !== (r.note_club ?? "");

  const salva = async () => {
    set_salvando(true);
    set_errore_salvataggio(null);
    try {
      const { data: auth_data, error: auth_error } = await supabase.auth.getUser();
      if (auth_error) throw auth_error;
      const { error } = await supabase
        .from("richieste_prova")
        .update({
          stato,
          note_club: note_club.trim() || null,
          gestita_da: auth_data.user?.id ?? null,
          gestita_il: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (error) throw error;
      on_salvata();
    } catch (e) {
      // Niente toast verde a metà: l'errore resta sulla riga, i valori non si perdono.
      set_errore_salvataggio(k("errore_salvataggio"));
      segnala_errore("TabProveGratuite", k("salva"), e, { richiesta_id: r.id }, "avviso");
    } finally {
      set_salvando(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            {r.nome} {r.cognome}
            {eta !== null && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {t("iscrizioni_stagione.prove.eta", { count: eta })}
              </span>
            )}
          </p>
          {r.genitore_nome && (
            <p className="text-sm text-muted-foreground">{k("accompagna", { nome: r.genitore_nome })}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {t("iscrizioni_stagione.prove.arrivata_da", { count: giorni })}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {r.telefono && (
          <a href={`tel:${r.telefono}`} className="inline-flex items-center gap-1.5 text-primary underline underline-offset-4">
            <Phone className="w-3.5 h-3.5" />
            {r.telefono}
          </a>
        )}
        {r.email && (
          <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 text-primary underline underline-offset-4 break-all">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            {r.email}
          </a>
        )}
      </div>

      {r.note && (
        <p className="text-sm text-muted-foreground border-l-2 border-border pl-3 whitespace-pre-wrap">{r.note}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 pt-1">
        <Select value={stato} onValueChange={(v) => set_stato(v as RichiestaProva["stato"])} disabled={!puo_gestire || salvando}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATI.map((s) => (
              <SelectItem key={s} value={s}>
                {k(`stato_${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          className="min-h-10"
          placeholder={k("note_club_placeholder")}
          value={note_club}
          onChange={(e) => set_note_club(e.target.value)}
          disabled={!puo_gestire || salvando}
        />
      </div>

      {errore_salvataggio && (
        <p className="text-sm text-destructive" role="alert">{errore_salvataggio}</p>
      )}

      {puo_gestire && sporco && (
        <div className="flex justify-end">
          <Button size="sm" onClick={salva} disabled={salvando}>
            {salvando ? k("salvataggio") : k("salva")}
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Linguetta «Prove gratuite»: le richieste arrivate dalla pagina pubblica
 * /prova/:slug, con cambio stato e note interne.
 */
const TabProveGratuite: React.FC<{ puo_gestire: boolean }> = ({ puo_gestire }) => {
  const { t } = useTranslation("atleti");
  const k = (s: string, o?: any) => t(`iscrizioni_stagione.prove.${s}`, o as any) as string;
  const query_client = useQueryClient();
  const richieste = use_richieste_prova();
  const [mostra_chiuse, set_mostra_chiuse] = useState(false);

  const visibili = useMemo(() => {
    const lista = richieste.data ?? [];
    return mostra_chiuse ? lista : lista.filter((r) => APERTE.includes(r.stato));
  }, [richieste.data, mostra_chiuse]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{k("sottotitolo")}</p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <Switch checked={mostra_chiuse} onCheckedChange={set_mostra_chiuse} />
          {k("mostra_chiuse")}
        </label>
      </div>

      {richieste.isLoading && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {richieste.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <p className="text-sm text-destructive">{k("errore_lettura")}</p>
          <Button variant="outline" onClick={() => richieste.refetch()}>
            {t("iscrizioni_stagione.comune.riprova")}
          </Button>
        </div>
      )}

      {richieste.isSuccess && visibili.length === 0 && (
        <div className="text-center py-12 border rounded-lg border-dashed border-border">
          <Footprints className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {mostra_chiuse ? k("nessuna") : k("nessuna_aperta")}
          </p>
        </div>
      )}

      {visibili.map((r) => (
        <RigaProva
          key={r.id}
          r={r}
          puo_gestire={puo_gestire}
          on_salvata={() => query_client.invalidateQueries({ queryKey: ["richieste_prova"] })}
        />
      ))}
    </div>
  );
};

export default TabProveGratuite;
