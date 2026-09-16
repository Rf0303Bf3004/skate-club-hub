import React from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { segnala_errore } from "@/lib/errori";

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function maschera(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const senza_prefisso = clean.startsWith("PI") ? clean.slice(2) : clean;
  let out = "PI";
  if (senza_prefisso.length > 0) out += "-" + senza_prefisso.slice(0, 4);
  if (senza_prefisso.length > 4) out += "-" + senza_prefisso.slice(4, 8);
  return out;
}

function completo(codice: string): boolean {
  return /^PI-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codice);
}

/** Accesso del tablet di bordo pista: un codice del club, non l'account di una persona. */
const PistaLoginPage: React.FC = () => {
  const { t } = useTranslation("common");
  const [codice, set_codice] = React.useState("PI-");
  const [in_corso, set_in_corso] = React.useState(false);
  const [errore, set_errore] = React.useState<string | null>(null);

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

  const entra = async () => {
    if (!completo(codice) || in_corso) return;
    set_in_corso(true);
    set_errore(null);
    try {
      const { data, error } = await supabase.functions.invoke("pista-login", {
        body: { codice },
      });
      const corpo: any = data ?? {};
      if (error || corpo?.error) {
        const motivo = corpo?.message || corpo?.error || error?.message || "";
        set_errore(
          corpo?.error === "too_many_attempts"
            ? corpo?.message || t("pista_login.troppi_tentativi")
            : t("pista_login.codice_errato"),
        );
        segnala_errore("PistaLoginPage", "pista-login", new Error(String(motivo)), undefined, "avviso");
        return;
      }
      if (!corpo?.access_token || !corpo?.refresh_token) {
        set_errore(t("pista_login.codice_errato"));
        return;
      }
      const { error: err_sessione } = await supabase.auth.setSession({
        access_token: corpo.access_token,
        refresh_token: corpo.refresh_token,
      });
      if (err_sessione) {
        segnala_errore("PistaLoginPage", "setSession", err_sessione);
        set_errore(err_sessione.message);
        return;
      }
      window.location.replace("/pista");
    } catch (e) {
      segnala_errore("PistaLoginPage", "pista-login", e);
      set_errore(e instanceof Error ? e.message : String(e));
    } finally {
      set_in_corso(false);
    }
  };

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
            if (e.key === "Enter") void entra();
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
            disabled={!completo(codice) || in_corso}
            onClick={() => void entra()}
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
