import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, FileSpreadsheet, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { use_club } from "@/hooks/use-supabase-data";
import { use_ragioni_sociali } from "@/hooks/use-ragioni-sociali";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import DateInput from "@/components/forms/DateInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { segnala_errore } from "@/lib/errori";
import {
  use_impostazioni_contabilita,
  risolvi_impostazioni,
  type FormatoContabilita,
} from "@/hooks/use-impostazioni-contabilita";
import {
  componi_file,
  iva_nella_riga,
  nome_file,
  scarica_file,
  type RigaContabile,
} from "@/lib/export-contabilita";

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

const EsportaContabilitaPage: React.FC = () => {
  const { t } = useTranslation("fatture");
  const { puo_gestire_fatture } = usePermessiAzione();
  const club_id = get_current_club_id();
  const { data: club } = use_club();
  const { data: ragioni_sociali = [] } = use_ragioni_sociali();
  const { modalita } = useModalitaArea("fatturazione");
  const impostazioni_q = use_impostazioni_contabilita();

  const oggi = new Date();
  const mese_scorso_inizio = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
  const mese_scorso_fine = new Date(oggi.getFullYear(), oggi.getMonth(), 0);

  const [dal, set_dal] = useState(iso(mese_scorso_inizio));
  const [al, set_al] = useState(iso(mese_scorso_fine));
  const [ente, set_ente] = useState<string>("tutti");
  const [incassi, set_incassi] = useState(true);
  const [formato_scelto, set_formato_scelto] = useState<FormatoContabilita | null>(null);
  const [scaricando, set_scaricando] = useState(false);

  const multi_enti = modalita === "multi_ragione_sociale";
  const ragioni_attive = useMemo(
    () => ragioni_sociali.filter((r) => r.attivo).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)),
    [ragioni_sociali],
  );

  const righe_impostazioni = impostazioni_q.data;
  const risolte = useMemo(
    () =>
      righe_impostazioni
        ? risolvi_impostazioni(righe_impostazioni, ente !== "tutti" && ente !== "club" ? ente : null)
        : null,
    [righe_impostazioni, ente],
  );
  // Formato: la scelta dell'utente vince, altrimenti il programma preferito nelle impostazioni.
  const formato: FormatoContabilita = formato_scelto ?? risolte?.formato ?? "banana";

  const periodo_valido = /^\d{4}-\d{2}-\d{2}$/.test(dal) && /^\d{4}-\d{2}-\d{2}$/.test(al) && dal <= al;

  const anteprima = useQuery({
    queryKey: ["esporta_contabilita", club_id, dal, al, ente, incassi, iva_nella_riga(formato)],
    enabled: !!club_id && periodo_valido,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("esporta_contabilita" as any, {
        p_club: club_id,
        p_dal: dal,
        p_al: al,
        p_ragione_sociale: ente !== "tutti" && ente !== "club" ? ente : null,
        p_includi_incassi: incassi,
        p_iva_nella_riga: iva_nella_riga(formato),
      } as any);
      if (error) throw error;
      return (data ?? []) as RigaContabile[];
    },
  });

  React.useEffect(() => {
    if (anteprima.isError) {
      segnala_errore("EsportaContabilitaPage", t("esporta.errore_lettura"), anteprima.error);
    }
  }, [anteprima.isError, anteprima.error, t]);

  React.useEffect(() => {
    if (impostazioni_q.isError) {
      segnala_errore(
        "EsportaContabilitaPage",
        t("esporta.errore_impostazioni"),
        impostazioni_q.error,
        undefined,
        "avviso",
      );
    }
  }, [impostazioni_q.isError, impostazioni_q.error, t]);

  const righe = anteprima.data ?? [];
  const totale = righe.reduce((s, r) => s + (Number(r.importo) || 0), 0);

  function scorciatoia(tipo: "mese" | "trimestre" | "anno") {
    const y = oggi.getFullYear();
    if (tipo === "mese") {
      set_dal(iso(new Date(y, oggi.getMonth() - 1, 1)));
      set_al(iso(new Date(y, oggi.getMonth(), 0)));
    } else if (tipo === "trimestre") {
      const t_corrente = Math.floor(oggi.getMonth() / 3);
      const inizio = new Date(y, (t_corrente - 1) * 3, 1);
      set_dal(iso(inizio));
      set_al(iso(new Date(inizio.getFullYear(), inizio.getMonth() + 3, 0)));
    } else {
      set_dal(iso(new Date(y - 1, 0, 1)));
      set_al(iso(new Date(y - 1, 11, 31)));
    }
  }

  async function scarica() {
    if (!periodo_valido || !club_id) return;
    set_scaricando(true);
    try {
      const { data, error } = await supabase.rpc("esporta_contabilita" as any, {
        p_club: club_id,
        p_dal: dal,
        p_al: al,
        p_ragione_sociale: ente !== "tutti" && ente !== "club" ? ente : null,
        p_includi_incassi: incassi,
        p_iva_nella_riga: iva_nella_riga(formato),
      } as any);
      if (error) throw error;
      const tutte = (data ?? []) as RigaContabile[];
      const contenuto = componi_file(formato, tutte);
      scarica_file(formato, contenuto, nome_file(club?.nome ?? "club", dal, al, formato));
    } catch (err) {
      await segnala_errore("EsportaContabilitaPage", t("esporta.errore_download"), err);
    } finally {
      set_scaricando(false);
    }
  }

  if (!puo_gestire_fatture) {
    return (
      <div className="p-6">
        <NotaPermesso testo="Solo la segreteria e il presidente possono esportare la contabilità." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div className="space-y-1">
        <Link to="/fatture" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> {t("esporta.torna_fatture")}
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("esporta.titolo")}</h1>
        <p className="text-sm text-muted-foreground">{t("esporta.sottotitolo")}</p>
      </div>

      {/* Avviso: impostazioni mai compilate. Il file resta scaricabile con i conti proposti. */}
      {righe_impostazioni && risolte && !risolte.configurato && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p>{t("esporta.avviso_non_configurato")}</p>
            <Link to="/setup-club" className="underline font-medium">
              {t("esporta.vai_setup")}
            </Link>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        {/* Periodo */}
        <div className="space-y-2">
          <Label>{t("esporta.periodo")}</Label>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{t("esporta.dal")}</span>
              <DateInput value={dal} onChange={set_dal} />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{t("esporta.al")}</span>
              <DateInput value={al} onChange={set_al} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => scorciatoia("mese")}>
                {t("esporta.mese_scorso")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => scorciatoia("trimestre")}>
                {t("esporta.trimestre")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => scorciatoia("anno")}>
                {t("esporta.anno")}
              </Button>
            </div>
          </div>
          {!periodo_valido && <p className="text-xs text-destructive">{t("esporta.periodo_non_valido")}</p>}
        </div>

        {/* Ente */}
        {multi_enti && ragioni_attive.length > 0 && (
          <div className="space-y-2 max-w-sm">
            <Label>{t("esporta.ente")}</Label>
            <Select value={ente} onValueChange={set_ente}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">{t("esporta.ente_tutti")}</SelectItem>
                <SelectItem value="club">{club?.nome || t("invoices_page.enti.club_fallback")}</SelectItem>
                {ragioni_attive.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Incassi */}
        <div className="flex items-center justify-between gap-4 max-w-md">
          <div>
            <Label>{t("esporta.incassi")}</Label>
            <p className="text-xs text-muted-foreground">{t("esporta.incassi_desc")}</p>
          </div>
          <Switch checked={incassi} onCheckedChange={set_incassi} />
        </div>

        {/* Formato */}
        <div className="space-y-2 max-w-sm">
          <Label>{t("esporta.formato")}</Label>
          <Select value={formato} onValueChange={(v) => set_formato_scelto(v as FormatoContabilita)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="banana">{t("esporta.formati.banana")}</SelectItem>
              <SelectItem value="cresus">{t("esporta.formati.cresus")}</SelectItem>
              <SelectItem value="csv">{t("esporta.formati.csv")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t(`esporta.aiuto.${formato}`)}</p>
        </div>
      </div>

      {/* Anteprima */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-base font-bold text-foreground">{t("esporta.anteprima_titolo")}</h2>

        {!periodo_valido ? (
          <p className="text-sm text-muted-foreground">{t("esporta.periodo_non_valido")}</p>
        ) : anteprima.isError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">{t("esporta.errore_lettura")}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => anteprima.refetch()}>
              {t("esporta.riprova")}
            </Button>
          </div>
        ) : anteprima.isPending || anteprima.isFetching ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {t("esporta.caricamento")}
          </p>
        ) : righe.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("esporta.nessuna_riga")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("esporta.righe_totali", { count: righe.length })} ·{" "}
              <span className="font-bold text-foreground">CHF {totale.toFixed(2)}</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left border-b border-border">
                    <th className="py-1 pr-3">{t("esporta.col.data")}</th>
                    <th className="py-1 pr-3">{t("esporta.col.numero")}</th>
                    <th className="py-1 pr-3">{t("esporta.col.descrizione")}</th>
                    <th className="py-1 pr-3">{t("esporta.col.dare")}</th>
                    <th className="py-1 pr-3">{t("esporta.col.avere")}</th>
                    <th className="py-1 pr-3 text-right">{t("esporta.col.importo")}</th>
                    <th className="py-1 pr-3">{t("esporta.col.tipo")}</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.slice(0, 20).map((r, i) => (
                    <tr key={`${r.id_esterno ?? ""}-${i}`} className="border-b border-border/50">
                      <td className="py-1 pr-3 tabular-nums">{String(r.data ?? "").slice(0, 10)}</td>
                      <td className="py-1 pr-3">{r.numero}</td>
                      <td className="py-1 pr-3">{r.descrizione}</td>
                      <td className="py-1 pr-3 tabular-nums">{r.conto_dare}</td>
                      <td className="py-1 pr-3 tabular-nums">{r.conto_avere}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">
                        {(Number(r.importo) || 0).toFixed(2)}
                      </td>
                      <td className="py-1 pr-3">{r.tipo_riga}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {righe.length > 20 && (
              <p className="text-xs text-muted-foreground">
                {t("esporta.altre_righe", { count: righe.length - 20 })}
              </p>
            )}
          </>
        )}

        <Button onClick={scarica} disabled={!periodo_valido || scaricando}>
          {scaricando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {t("esporta.scarica")}
        </Button>
      </div>
    </div>
  );
};

export default EsportaContabilitaPage;
