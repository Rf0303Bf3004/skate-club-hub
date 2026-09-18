import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUp, ArrowDown, Loader2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AREA_LABELS, type Tono } from "@/lib/paragraphGenerator";
import { AREE_ORDINATE, MODULI, type Stagione } from "@/lib/relazione/moduli";
import type { VocePannello } from "@/hooks/use-composizione-relazione";

interface Props {
  club_id: string;
  stagione: Stagione;
  tono: Tono;
  voci: VocePannello[];
  toggle: (voce: VocePannello, attivo: boolean) => void;
  sposta: (voce: VocePannello, direzione: -1 | 1) => void;
  moduli_in_caricamento: boolean;
}

export default function PannelloModuli({
  club_id, stagione, tono, voci, toggle, sposta, moduli_in_caricamento,
}: Props) {
  const { t } = useTranslation("dashboard");
  const mobili = voci.filter((v) => !v.bloccato);
  const moduli = voci.filter((v) => v.tipo === "modulo");

  return (
    <div className="space-y-5">
      {moduli_in_caricamento && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{t("relazione.caricamento")}</p>}
      {AREE_ORDINATE.map((area) => <section key={area} className="space-y-1"><h3 className="text-xs font-semibold uppercase text-muted-foreground">{AREA_LABELS[area]}</h3>{moduli.filter((v) => MODULI.find((m) => m.id === v.riferimento)?.area === area).map((v) => {
        const idx = mobili.findIndex((m) => m.id === v.id);
        const spento_per_dati = v.tipo === "modulo" && v.stato_modulo && v.stato_modulo !== "ok";
        return (
          <div
            key={v.id}
            className="flex min-h-9 items-center gap-2 border-b py-1"
          >
              <Checkbox
                checked={v.attivo}
                disabled={v.bloccato || !!spento_per_dati}
                onCheckedChange={(c) => toggle(v, c === true)}
                aria-label={v.titolo}
              />
              <span className="min-w-0 flex-1 truncate text-sm" title={v.titolo}>{v.titolo}</span>
              {spento_per_dati && !moduli_in_caricamento && <span title={v.motivo}><AlertTriangle className={v.stato_modulo === "errore" ? "h-3 w-3 text-destructive" : "h-3 w-3 text-amber-700"} /></span>}
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx <= 0}
                    title={t("relazione.moduli.su")} onClick={() => sposta(v, -1)}>
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx < 0 || idx >= mobili.length - 1}
                    title={t("relazione.moduli.giu")} onClick={() => sposta(v, 1)}>
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </div>
          </div>
        );
      })}</section>)}
    </div>
  );
}
