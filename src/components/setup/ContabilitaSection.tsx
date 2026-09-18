import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { segnala_errore } from "@/lib/errori";
import { usePermessiAzione } from "@/hooks/use-permessi-azione";
import NotaPermesso from "@/components/common/NotaPermesso";
import { use_ragioni_sociali } from "@/hooks/use-ragioni-sociali";
import { useModalitaArea } from "@/hooks/useModalitaArea";
import {
  CONTI_PROPOSTI,
  VOCI_CONTABILI,
  use_impostazioni_contabilita,
  use_salva_impostazioni_contabilita,
  type FormatoContabilita,
} from "@/hooks/use-impostazioni-contabilita";

interface Modulo {
  formato: FormatoContabilita;
  conto_debitori: string;
  conto_banca: string;
  conto_ricavi_default: string;
  conto_iva: string;
  conto_sconti: string;
  codice_iva: string;
  conti_per_voce: Record<string, string>;
}

const VUOTO: Modulo = {
  formato: "banana",
  conto_debitori: "",
  conto_banca: "",
  conto_ricavi_default: "",
  conto_iva: "",
  conto_sconti: "",
  codice_iva: "",
  conti_per_voce: {},
};

const ContabilitaSection: React.FC = () => {
  const { t } = useTranslation("fatture");
  const { puo_gestire_fatture } = usePermessiAzione();
  const { data: ragioni_sociali = [] } = use_ragioni_sociali();
  const { modalita } = useModalitaArea("fatturazione");
  const q = use_impostazioni_contabilita();
  const salva = use_salva_impostazioni_contabilita();

  const [ente, set_ente] = useState<string>("club");
  const [modulo, set_modulo] = useState<Modulo>(VUOTO);

  const ragioni_attive = useMemo(
    () => ragioni_sociali.filter((r) => r.attivo).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)),
    [ragioni_sociali],
  );
  const multi_enti = modalita === "multi_ragione_sociale" && ragioni_attive.length > 0;

  // Il modulo si popola dai dati letti (mai dentro la queryFn): al rientro da cache resta corretto.
  useEffect(() => {
    if (!q.data) return;
    const id_ente = ente === "club" ? null : ente;
    const riga = q.data.find((r) => r.ragione_sociale_id === id_ente);
    set_modulo({
      formato: riga?.formato ?? "banana",
      conto_debitori: riga?.conto_debitori ?? "",
      conto_banca: riga?.conto_banca ?? "",
      conto_ricavi_default: riga?.conto_ricavi_default ?? "",
      conto_iva: riga?.conto_iva ?? "",
      conto_sconti: riga?.conto_sconti ?? "",
      codice_iva: riga?.codice_iva ?? "",
      conti_per_voce: { ...(riga?.conti_per_voce ?? {}) },
    });
  }, [q.data, ente]);

  useEffect(() => {
    if (q.isError) {
      segnala_errore("ContabilitaSection", t("contabilita.errore_lettura"), q.error, undefined, "avviso");
    }
  }, [q.isError, q.error, t]);

  if (!puo_gestire_fatture) {
    return <NotaPermesso testo="Solo la segreteria e il presidente possono cambiare le impostazioni contabili." />;
  }

  // Lettura non riuscita o non ancora arrivata: non si salva al buio.
  const pronto = q.isSuccess;

  async function salva_ora() {
    if (!pronto) return;
    const mappa: Record<string, string> = {};
    for (const [k, v] of Object.entries(modulo.conti_per_voce)) {
      if (v && v.trim()) mappa[k] = v.trim();
    }
    try {
      await salva.mutateAsync({
        ragione_sociale_id: ente === "club" ? null : ente,
        formato: modulo.formato,
        conto_debitori: modulo.conto_debitori.trim() || null,
        conto_banca: modulo.conto_banca.trim() || null,
        conto_ricavi_default: modulo.conto_ricavi_default.trim() || null,
        conto_iva: modulo.conto_iva.trim() || null,
        conto_sconti: modulo.conto_sconti.trim() || null,
        codice_iva: modulo.codice_iva.trim() || null,
        conti_per_voce: mappa,
      });
      toast.success(t("contabilita.salvato"));
    } catch (err) {
      await segnala_errore("ContabilitaSection", t("contabilita.errore_salvataggio"), err);
    }
  }

  const campo = (
    chiave: keyof Modulo,
    etichetta: string,
    proposto: string,
  ) => (
    <div className="space-y-1">
      <Label className="text-xs">{etichetta}</Label>
      <Input
        value={String(modulo[chiave] ?? "")}
        placeholder={proposto}
        onChange={(e) => set_modulo((m) => ({ ...m, [chiave]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Calculator className="w-5 h-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">{t("contabilita.titolo")}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{t("contabilita.descrizione")}</p>

      {q.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="text-destructive">{t("contabilita.errore_lettura")}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => q.refetch()}>
            {t("contabilita.riprova")}
          </Button>
        </div>
      )}

      {multi_enti && (
        <div className="space-y-1">
          <Tabs value={ente} onValueChange={set_ente}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="club">{t("contabilita.scheda_club")}</TabsTrigger>
              {ragioni_attive.map((r) => (
                <TabsTrigger key={r.id} value={r.id}>
                  {r.nome}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {ente !== "club" && <p className="text-xs text-muted-foreground">{t("contabilita.nota_ente")}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campo("conto_debitori", t("contabilita.conti.debitori"), CONTI_PROPOSTI.conto_debitori)}
        {campo("conto_banca", t("contabilita.conti.banca"), CONTI_PROPOSTI.conto_banca)}
        {campo("conto_ricavi_default", t("contabilita.conti.ricavi"), CONTI_PROPOSTI.conto_ricavi_default)}
        {campo("conto_iva", t("contabilita.conti.iva"), CONTI_PROPOSTI.conto_iva)}
        {campo("conto_sconti", t("contabilita.conti.sconti"), CONTI_PROPOSTI.conto_sconti)}
      </div>

      <div className="space-y-1 max-w-xs">
        <Label className="text-xs">{t("contabilita.codice_iva")}</Label>
        <Input
          value={modulo.codice_iva}
          onChange={(e) => set_modulo((m) => ({ ...m, codice_iva: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">{t("contabilita.codice_iva_nota")}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{t("contabilita.mappa_titolo")}</Label>
        <p className="text-xs text-muted-foreground">{t("contabilita.mappa_nota")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {VOCI_CONTABILI.map((voce) => (
            <div key={voce} className="space-y-1">
              <span className="text-xs text-muted-foreground">{voce}</span>
              <Input
                value={modulo.conti_per_voce[voce] ?? ""}
                placeholder={modulo.conto_ricavi_default || CONTI_PROPOSTI.conto_ricavi_default}
                onChange={(e) =>
                  set_modulo((m) => ({
                    ...m,
                    conti_per_voce: { ...m.conti_per_voce, [voce]: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1 max-w-xs">
        <Label className="text-xs">{t("contabilita.formato_preferito")}</Label>
        <Select
          value={modulo.formato}
          onValueChange={(v) => set_modulo((m) => ({ ...m, formato: v as FormatoContabilita }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="banana">{t("esporta.formati.banana")}</SelectItem>
            <SelectItem value="cresus">{t("esporta.formati.cresus")}</SelectItem>
            <SelectItem value="csv">{t("esporta.formati.csv")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={salva_ora} disabled={!pronto || salva.isPending}>
        {salva.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {t("contabilita.salva")}
      </Button>
      {!pronto && !q.isError && <p className="text-xs text-muted-foreground">{t("contabilita.caricamento")}</p>}
    </div>
  );
};

export default ContabilitaSection;
