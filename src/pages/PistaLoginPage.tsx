import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { segnala_errore } from "@/lib/errori";
import {
  accedi_pista_con_codice,
  codice_pista_completo,
  salva_codice_pista,
} from "@/lib/pista-codice";

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function maschera(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const senza_prefisso = clean.startsWith("PI") ? clean.slice(2) : clean;
  let out = "PI";
  if (senza_prefisso.length > 0) out += "-" + senza_prefisso.slice(0, 4);
  if (senza_prefisso.length > 4) out += "-" + senza_prefisso.slice(4, 8);
  return out;
}

/** Accesso del tablet di bordo pista: un codice del club, non l'account di una persona. */
const PistaLoginPage: React.FC = () => {
  const { t } = useTranslation("common");
  const [codice, set_codice] = React.useState("PI-");
  const [in_corso, set_in_corso] = React.useState(false);
  const [errore, set_errore] = React.useState<string | null>(null);
  const [automatico, set_automatico] = React.useState(false);
  const tentato = React.useRef(false);

  const entra = React.useCallback(
    async (valore: string, silenzioso = false) => {
      if (!codice_pista_completo(valore)) return;
      set_in_corso(true);
      set_errore(null);
      const esito = await accedi_pista_con_codice(valore);
      if (esito.ok === true) {
        salva_codice_pista(valore);
        window.location.replace("/pista");
        return;
      }
      const motivo = esito.motivo;
      const messaggio = esito.messaggio;
      set_automatico(false);
      set_in_corso(false);
      set_errore(
        motivo === "troppi_tentativi"
          ? messaggio || t("pista_login.troppi_tentativi")
          : motivo === "guasto"
            ? messaggio || t("pista_login.codice_errato")
            : t("pista_login.codice_errato"),
      );
      segnala_errore(
        "PistaLoginPage",
        silenzioso ? "pista-login-collegamento" : "pista-login",
        new Error(messaggio || motivo),
        undefined,
        "avviso",
      );
    },
    [t],
  );

  // Codice passato nell'indirizzo (QR o collegamento): si tenta da soli e si
  // toglie subito dalla barra, così non resta nella cronologia del tablet.
  React.useEffect(() => {
    if (tentato.current) return;
    tentato.current = true;
    const params = new URLSearchParams(window.location.search);
    const dal_link = params.get("c");
    const motivo = params.get("motivo");
    if (dal_link || motivo) {
      try {
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        /* se la cronologia non si può riscrivere si prosegue comunque */
      }
    }
    if (motivo === "codice_cambiato") set_errore(t("pista_login.codice_cambiato"));
    if (dal_link) {
      const pulito = maschera(dal_link);
      set_codice(pulito);
      if (codice_pista_completo(pulito)) {
        set_automatico(true);
        void entra(pulito, true);
      } else {
        set_errore(t("pista_login.codice_errato"));
      }
    }
  }, [entra, t]);

  const digita = (car: string) => {
    set_errore(null);
    set_codice((v) => maschera(v + car));
  };

  const cancella = () => {
    set_errore(null);
    set_codice((v) => {
      const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const senza_prefisso = clean.startsWith("PI") ? clean.slice(2) : clean;
      return maschera("PI" + senza_prefisso.slice(0, -1));
    });
  };

  if (automatico && in_corso) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        <p className="text-lg text-muted-foreground">{t("pista_login.accesso_in_corso")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-center">{t("pista_login.titolo")}</h1>
        <p className="mt-2 text-center text-lg text-muted-foreground">{t("pista_login.sottotitolo")}</p>

        <input
          value={codice}
          onChange={(e) => {
            set_errore(null);
            set_codice(maschera(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void entra(codice);
          }}
          maxLength={12}
          inputMode="text"
          autoComplete="off"
          aria-label={t("pista_login.titolo")}
          className="mt-6 w-full h-20 rounded-2xl border-2 border-border bg-card text-center font-mono text-4xl tracking-[0.2em] uppercase focus:border-primary focus:outline-none"
        />

        {errore && (
          <p className="mt-3 rounded-xl border-2 border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-base font-medium text-destructive">
            {errore}
          </p>
        )}

        {/* Tastiera grande: un tablet, un dito. Solo l'alfabeto del codice. */}
        <div className="mt-6 grid grid-cols-6 gap-2">
          {ALFABETO.split("").map((car) => (
            <button
              key={car}
              type="button"
              onClick={() => digita(car)}
              className="h-14 rounded-xl border-2 border-border bg-card text-2xl font-semibold active:bg-muted"
            >
              {car}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" className="h-16 text-lg" onClick={cancella}>
            {t("pista_login.cancella")}
          </Button>
          <Button
            size="lg"
            className="h-16 text-lg"
            disabled={!codice_pista_completo(codice) || in_corso}
            onClick={() => void entra(codice)}
          >
            {in_corso ? t("pista_login.accesso_in_corso") : t("pista_login.entra")}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">{t("pista_login.aiuto")}</p>
      </div>
    </div>
  );
};

export default PistaLoginPage;
