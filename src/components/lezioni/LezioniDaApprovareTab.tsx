import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, CalendarClock, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { segnala_errore } from "@/lib/errori";
import { useI18n } from "@/lib/i18n";
import { locale_to_bcp47 } from "@/lib/format-data";
import {
  use_lezioni_da_approvare,
  use_approva_lezione_privata,
  use_rifiuta_lezione_privata,
  type LezioneDaApprovare,
} from "@/hooks/use-lezioni-da-approvare";

function fmt_ora(v?: string | null): string {
  return v ? v.slice(0, 5) : "—";
}

function fmt_data(data_iso: string, locale_code: string): string {
  const dt = new Date(data_iso + "T00:00:00");
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(locale_code, { weekday: "long", day: "numeric", month: "long" });
}

const LezioniDaApprovareTab: React.FC<{ puo_gestire: boolean }> = ({ puo_gestire }) => {
  const { t } = useTranslation("common");
  const { locale } = useI18n();
  const locale_code = locale_to_bcp47(locale);
  const [rifiuto_id, set_rifiuto_id] = useState<string | null>(null);
  const [motivo, set_motivo] = useState("");

  const { data, isLoading, isError, error: errore_query, isFetching, refetch } = use_lezioni_da_approvare();

  React.useEffect(() => {
    if (isError) {
      void segnala_errore("LezioniDaApprovareTab", "lettura lezioni da approvare", errore_query, undefined, "avviso");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError]);

  const approva = use_approva_lezione_privata({
    onSuccess: () => toast({ title: t("lezioni_da_approvare.toast_approvata") }),
    onError: (e: any) =>
      toast({ title: t("lezioni_da_approvare.toast_errore"), description: e?.message, variant: "destructive" }),
  });

  const rifiuta = use_rifiuta_lezione_privata({
    onSuccess: () => {
      toast({ title: t("lezioni_da_approvare.toast_rifiutata") });
      set_rifiuto_id(null);
      set_motivo("");
    },
    onError: (e: any) =>
      toast({ title: t("lezioni_da_approvare.toast_errore"), description: e?.message, variant: "destructive" }),
  });

  const righe: LezioneDaApprovare[] = data ?? [];

  return (
    <div className="bg-card rounded-2xl shadow-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">{t("lezioni_da_approvare.titolo")}</h2>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
          title={t("lezioni_da_approvare.aggiorna")}
          aria-label={t("lezioni_da_approvare.aggiorna")}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 space-y-1">
          <p className="text-sm text-amber-900">{t("lezioni_da_approvare.errore_lettura")}</p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => refetch()}>
            {t("lezioni_da_approvare.riprova")}
          </Button>
        </div>
      ) : righe.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{t("lezioni_da_approvare.vuoto")}</p>
      ) : (
        <div className="space-y-3">
          {righe.map((l) => (
            <div key={l.id} className="border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {fmt_data(l.data, locale_code)} · {fmt_ora(l.ora_inizio)}–{fmt_ora(l.ora_fine)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("lezioni_da_approvare.istruttore")}:{" "}
                    {l.istruttore ? `${l.istruttore.nome} ${l.istruttore.cognome}` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("lezioni_da_approvare.atlete")}:{" "}
                    {l.atleti.length
                      ? l.atleti.map((a) => `${a.nome} ${a.cognome}`).join(", ")
                      : t("lezioni_da_approvare.nessuna_atleta")}
                  </p>
                </div>
                {l.ricorrente && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {t("lezioni_da_approvare.ricorrente")}
                  </span>
                )}
              </div>

              {l.note && <p className="text-xs text-muted-foreground italic">"{l.note}"</p>}

              {!puo_gestire ? null : rifiuto_id === l.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={motivo}
                    onChange={(e) => set_motivo(e.target.value)}
                    placeholder={t("lezioni_da_approvare.motivo_rifiuto")}
                    className="w-full min-h-[60px] text-xs"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={rifiuta.isPending || !motivo.trim()}
                      onClick={() => rifiuta.mutate({ id: l.id, note_attuale: l.note, motivo })}
                    >
                      {t("lezioni_da_approvare.conferma_rifiuto")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        set_rifiuto_id(null);
                        set_motivo("");
                      }}
                    >
                      {t("lezioni_da_approvare.annulla")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2"
                    disabled={approva.isPending}
                    onClick={() => approva.mutate(l.id)}
                  >
                    <Check className="w-3 h-3 mr-1" /> {t("lezioni_da_approvare.approva")}
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => set_rifiuto_id(l.id)}>
                    <X className="w-3 h-3 mr-1" /> {t("lezioni_da_approvare.rifiuta")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LezioniDaApprovareTab;
