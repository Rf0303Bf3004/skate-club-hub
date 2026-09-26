import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, AlertTriangle, Loader2 } from "lucide-react";

/**
 * Una voce selezionabile. `active_id` e `data` sono ESATTAMENTE quelli che
 * l'elemento trascinabile corrispondente consegna al rilascio: il pannello
 * non assegna niente da sé, passa la voce allo stesso `esegui_drop`.
 */
export interface VocePannello {
  chiave: string;
  tipo: "gruppo" | "atleta" | "istruttore";
  etichetta: string;
  /** Titolo della sezione in cui compare (box sorgente o «Istruttori»). */
  sezione: string;
  /** Solo per gli atleti: la voce di gruppo sotto cui compaiono. */
  gruppo_chiave?: string;
  /** Solo per gli istruttori: stato per l'orario della sessione. */
  stato?: { tipo: "libero" | "fuori" | "occupato"; testo: string };
  active_id: string;
  data: any;
}

export type StatoEsito = "in_coda" | "in_corso" | "aggiunto" | "in_attesa" | "non_aggiunto" | "errore";
export interface EsitoVoce {
  etichetta: string;
  stato: StatoEsito;
  dettaglio?: string;
}

interface Props {
  open: boolean;
  on_close: () => void;
  titolo_sessione: string;
  voci: VocePannello[];
  on_conferma: (voci: VocePannello[]) => void;
  /** Riepilogo persona per persona dopo la conferma (null = non ancora confermato). */
  esiti: Record<string, EsitoVoce> | null;
  in_corso: boolean;
}

const ORDINE: Record<string, number> = { libero: 0, fuori: 1, occupato: 2 };

const AggiungiPersonePanel: React.FC<Props> = ({
  open,
  on_close,
  titolo_sessione,
  voci,
  on_conferma,
  esiti,
  in_corso,
}) => {
  const { t } = useTranslation("planning");
  const [q, set_q] = useState("");
  const [scelte, set_scelte] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && !esiti) {
      set_q("");
      set_scelte(new Set());
    }
  }, [open, esiti]);

  const filtrate = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return voci;
    // Un gruppo resta visibile se il suo nome o uno dei suoi atleti corrisponde.
    const gruppi_con_match = new Set(
      voci.filter((v) => v.tipo === "atleta" && v.etichetta.toLowerCase().includes(term)).map((v) => v.gruppo_chiave),
    );
    return voci.filter(
      (v) =>
        v.etichetta.toLowerCase().includes(term) || (v.tipo === "gruppo" && gruppi_con_match.has(v.chiave)),
    );
  }, [voci, q]);

  const sezioni = useMemo(() => {
    const map = new Map<string, VocePannello[]>();
    for (const v of filtrate) map.set(v.sezione, [...(map.get(v.sezione) ?? []), v]);
    for (const [k, lista] of map) {
      if (lista.every((v) => v.tipo === "istruttore")) {
        map.set(k, [...lista].sort((a, b) => ORDINE[a.stato?.tipo ?? "libero"] - ORDINE[b.stato?.tipo ?? "libero"]));
      }
    }
    return Array.from(map.entries());
  }, [filtrate]);

  const toggle = (chiave: string) =>
    set_scelte((prev) => {
      const n = new Set(prev);
      if (n.has(chiave)) n.delete(chiave);
      else n.add(chiave);
      return n;
    });

  const conferma = () => on_conferma(voci.filter((v) => scelte.has(v.chiave)));

  const icona_esito = (s: StatoEsito) => {
    if (s === "aggiunto") return <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />;
    if (s === "in_attesa") return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
    if (s === "in_corso") return <Loader2 className="w-4 h-4 animate-spin shrink-0" />;
    if (s === "in_coda") return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
    return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && on_close()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-3">
        <SheetHeader>
          <SheetTitle>{t("griglia_guida.pannello_titolo")}</SheetTitle>
          <SheetDescription>{t("griglia_guida.pannello_descrizione", { sessione: titolo_sessione })}</SheetDescription>
        </SheetHeader>

        {esiti ? (
          <div className="flex-1 overflow-y-auto space-y-2" aria-live="polite">
            <p className="text-sm font-semibold">{t("griglia_guida.riepilogo_titolo")}</p>
            <ul className="space-y-1.5">
              {Object.entries(esiti).map(([k, e]) => (
                <li key={k} className="flex gap-2 text-sm rounded-md border px-2 py-1.5">
                  {icona_esito(e.stato)}
                  <span>
                    <span className="font-medium">{e.etichetta}</span>
                    {" — "}
                    {t(`griglia_guida.esito_${e.stato}`)}
                    {e.dettaglio ? <span className="block text-xs text-muted-foreground">{e.dettaglio}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            <Button className="w-full mt-2" onClick={on_close} disabled={in_corso}>
              {t("griglia_guida.pannello_chiudi")}
            </Button>
          </div>
        ) : (
          <>
            <Input
              autoFocus
              value={q}
              onChange={(e) => set_q(e.target.value)}
              placeholder={t("griglia_guida.pannello_cerca")}
              aria-label={t("griglia_guida.pannello_cerca")}
            />
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {sezioni.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("griglia_guida.pannello_nessuno")}</p>
              )}
              {sezioni.map(([sezione, lista]) => (
                <fieldset key={sezione} className="space-y-1">
                  <legend className="text-sm font-semibold mb-1">{sezione}</legend>
                  {lista.map((v) => {
                    const id_campo = `voce-${v.chiave}`;
                    return (
                      <div
                        key={v.chiave}
                        className={cn(
                          "flex items-start gap-2 rounded-md px-2 py-1.5",
                          v.tipo === "gruppo" && "bg-muted/40",
                          v.tipo === "atleta" && v.gruppo_chiave && "ml-5",
                          v.stato?.tipo === "fuori" && "border-l-4 border-amber-500",
                          v.stato?.tipo === "occupato" && "border-l-4 border-destructive",
                        )}
                      >
                        <Checkbox
                          id={id_campo}
                          checked={scelte.has(v.chiave)}
                          onCheckedChange={() => toggle(v.chiave)}
                          className="mt-0.5"
                        />
                        <label htmlFor={id_campo} className="text-sm leading-tight cursor-pointer">
                          <span className={cn(v.tipo === "gruppo" && "font-medium")}>
                            {v.tipo === "gruppo"
                              ? t("griglia_guida.pannello_gruppo", {
                                  nome: v.etichetta,
                                  count: (v.data?.atleta_ids ?? []).length,
                                })
                              : v.etichetta}
                          </span>
                          {v.stato && v.stato.tipo !== "libero" && (
                            <span
                              className={cn(
                                "block text-xs",
                                v.stato.tipo === "fuori" ? "text-amber-700" : "text-destructive",
                              )}
                            >
                              {v.stato.testo}
                            </span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </fieldset>
              ))}
            </div>
            <Button onClick={conferma} disabled={scelte.size === 0 || in_corso}>
              {t("griglia_guida.pannello_conferma", { count: scelte.size })}
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default AggiungiPersonePanel;
