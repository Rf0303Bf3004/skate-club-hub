import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import DateInput from "@/components/forms/DateInput";
import { use_approva_richiesta_privata, type EsitoApprovazione } from "@/hooks/use-approva-richiesta-privata";

export interface DatiRichiestaDaApprovare {
  id: string;
  atleta_id: string;
  istruttore_id: string | null;
  data_preferita: string | null;
  note_richiesta: string | null;
}

interface Props {
  richiesta: DatiRichiestaDaApprovare;
  nome_atleta: string;
  istruttori: { id: string; nome: string; cognome: string; costo_minuto_lezione_privata?: number | null }[];
  durata_default: number;
  on_close: () => void;
  on_esito: (esito: EsitoApprovazione) => void;
  on_errore: (e: unknown) => void;
}

const RIPETIZIONI_PROPOSTE = [4, 8, 12];

function oggi_iso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function aggiungi_giorni(data_iso: string, giorni: number): string {
  const d = new Date(`${data_iso}T00:00:00`);
  d.setDate(d.getDate() + giorni);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ApprovaRichiestaDialog: React.FC<Props> = ({
  richiesta,
  nome_atleta,
  istruttori,
  durata_default,
  on_close,
  on_esito,
  on_errore,
}) => {
  const { t, i18n } = useTranslation("common");

  const [istruttore_id, set_istruttore_id] = useState<string>(richiesta.istruttore_id ?? "");
  const [data, set_data] = useState<string>(richiesta.data_preferita ?? oggi_iso());
  const [ora_inizio, set_ora_inizio] = useState<string>("17:00");
  const [durata, set_durata] = useState<number>(durata_default);
  const [ricorrenza, set_ricorrenza] = useState<"una_tantum" | "settimanale">("una_tantum");
  const [ripetizioni, set_ripetizioni] = useState<number>(4);
  const [ripetizioni_libere, set_ripetizioni_libere] = useState(false);

  const istruttore = istruttori.find((i) => i.id === istruttore_id);
  const costo_suggerito = Math.round((istruttore?.costo_minuto_lezione_privata || 0) * durata * 100) / 100;
  const [costo_str, set_costo_str] = useState<string>("");
  const costo = costo_str === "" ? costo_suggerito : Number(costo_str.replace(",", "."));

  const n_lezioni = ricorrenza === "settimanale" ? Math.min(52, Math.max(1, ripetizioni || 1)) : 1;

  const date_previste = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: n_lezioni }, (_, i) => aggiungi_giorni(data, i * 7));
  }, [data, n_lezioni]);

  const elenco_date = useMemo(() => {
    return date_previste
      .map((d, i) =>
        new Date(`${d}T00:00:00`).toLocaleDateString(i18n.language, {
          weekday: i === 0 ? "long" : undefined,
          day: "numeric",
          month: "long",
        }),
      )
      .join(", ");
  }, [date_previste, i18n.language]);

  const approva = use_approva_richiesta_privata({
    onSuccess: (esito) => on_esito(esito),
    onError: (e) => on_errore(e),
  });

  const valido =
    !!istruttore_id && !!data && /^\d{2}:\d{2}$/.test(ora_inizio) && durata > 0 && Number.isFinite(costo) && costo >= 0;

  const conferma = () => {
    if (!valido || approva.isPending) return;
    approva.mutate({
      richiesta_id: richiesta.id,
      istruttore_id,
      data,
      ora_inizio,
      durata_minuti: durata,
      ricorrenza,
      ripetizioni: n_lezioni,
      costo_totale: costo,
      note: richiesta.note_richiesta,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{t("approva_richiesta.titolo")}</h2>
          <p className="text-sm text-muted-foreground">{t("approva_richiesta.sottotitolo", { nome: nome_atleta })}</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("approva_richiesta.istruttore")}
          </label>
          <Select value={istruttore_id} onValueChange={set_istruttore_id}>
            <SelectTrigger>
              <SelectValue placeholder={t("approva_richiesta.istruttore_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {istruttori.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.nome} {i.cognome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("approva_richiesta.data")}
            </label>
            <DateInput value={data} onChange={(v) => set_data(v)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("approva_richiesta.ora")}
            </label>
            <input
              type="time"
              value={ora_inizio}
              onChange={(e) => set_ora_inizio(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("approva_richiesta.durata")}
            </label>
            <input
              type="number"
              min={5}
              step={5}
              value={durata}
              onChange={(e) => set_durata(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("approva_richiesta.ricorrenza")}
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={ricorrenza === "una_tantum" ? "default" : "outline"}
              onClick={() => set_ricorrenza("una_tantum")}
            >
              {t("approva_richiesta.una_tantum")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={ricorrenza === "settimanale" ? "default" : "outline"}
              onClick={() => set_ricorrenza("settimanale")}
            >
              {t("approva_richiesta.settimanale")}
            </Button>
          </div>
          {ricorrenza === "settimanale" && (
            <div className="flex items-center gap-2 flex-wrap">
              {RIPETIZIONI_PROPOSTE.map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={!ripetizioni_libere && ripetizioni === n ? "default" : "outline"}
                  onClick={() => {
                    set_ripetizioni_libere(false);
                    set_ripetizioni(n);
                  }}
                >
                  {n}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={ripetizioni_libere ? "default" : "outline"}
                onClick={() => set_ripetizioni_libere(true)}
              >
                {t("approva_richiesta.altro_numero")}
              </Button>
              {ripetizioni_libere && (
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={ripetizioni}
                  onChange={(e) => set_ripetizioni(Math.min(52, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("approva_richiesta.costo")}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={costo_str === "" ? String(costo_suggerito) : costo_str}
            onChange={(e) => set_costo_str(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <p className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2">
          {ricorrenza === "settimanale"
            ? t("approva_richiesta.anteprima_ricorrente", {
                count: n_lezioni,
                date: elenco_date,
                ora: ora_inizio,
              })
            : t("approva_richiesta.anteprima_singola", { date: elenco_date, ora: ora_inizio })}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={approva.isPending} onClick={on_close}>
            {t("approva_richiesta.annulla")}
          </Button>
          <Button disabled={!valido || approva.isPending} onClick={conferma}>
            {approva.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("approva_richiesta.conferma")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApprovaRichiestaDialog;
