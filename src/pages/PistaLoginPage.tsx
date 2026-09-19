import React from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { segnala_errore } from "@/lib/errori";
import {
  accedi_pista_con_codice,
  codice_pista_completo,
  salva_codice_pista,
} from "@/lib/pista-codice";

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const ID_RIQUADRO_QR = "pista-lettore-qr";

/** La fotocamera esiste solo in contesto sicuro (HTTPS): altrimenti niente bottone. */
const fotocamera_disponibile = (): boolean =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === "function";

/** Dal contenuto del QR ricava il codice: indirizzo con parametro `c`, oppure codice nudo. */
function codice_da_qr(testo: string): string | null {
  let grezzo = testo.trim();
  try {
    const url = new URL(grezzo);
    const c = url.searchParams.get("c");
    if (!c) return null;
    grezzo = c;
  } catch {
    /* non è un indirizzo: si prova come codice nudo */
  }
  return grezzo;
}

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

  // ---- Lettura del QR con la fotocamera posteriore -------------------------
  const [lettore_aperto, set_lettore_aperto] = React.useState(false);
  const [errore_fotocamera, set_errore_fotocamera] = React.useState<string | null>(null);
  const [avviso_qr, set_avviso_qr] = React.useState<string | null>(null);
  const lettore = React.useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const mostra_bottone_qr = React.useMemo(() => fotocamera_disponibile(), []);

  /** Spegne davvero la fotocamera: nessuna traccia viva dopo la chiusura. */
  const spegni_fotocamera = React.useCallback(async () => {
    const attivo = lettore.current;
    lettore.current = null;
    if (attivo) {
      try {
        await attivo.stop();
        attivo.clear();
      } catch {
        /* se era già ferma non c'è altro da fare */
      }
    }
    const contenitore = document.getElementById(ID_RIQUADRO_QR);
    contenitore?.querySelectorAll("video").forEach((video) => {
      const flusso = video.srcObject as MediaStream | null;
      flusso?.getTracks().forEach((traccia) => traccia.stop());
      video.srcObject = null;
    });
  }, []);

  const chiudi_lettore = React.useCallback(async () => {
    await spegni_fotocamera();
    set_lettore_aperto(false);
    set_avviso_qr(null);
  }, [spegni_fotocamera]);

  // Allo smontaggio la fotocamera non resta accesa.
  React.useEffect(() => {
    return () => {
      void spegni_fotocamera();
    };
  }, [spegni_fotocamera]);

  const avvia_lettore = React.useCallback(async () => {
    set_errore(null);
    set_errore_fotocamera(null);
    set_avviso_qr(null);
    set_lettore_aperto(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      // Il riquadro deve esistere nel DOM prima di avviare la fotocamera.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const istanza = new Html5Qrcode(ID_RIQUADRO_QR, { verbose: false });
      lettore.current = istanza as unknown as { stop: () => Promise<void>; clear: () => void };
      await istanza.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (testo) => {
          const grezzo = codice_da_qr(testo);
          if (!grezzo) {
            set_avviso_qr(t("pista_login.qr_non_valido"));
            return; // un QR qualunque non chiude il lettore: si continua a leggere
          }
          const pulito = maschera(grezzo);
          if (!codice_pista_completo(pulito)) {
            set_avviso_qr(t("pista_login.qr_non_valido"));
            return;
          }
          set_codice(pulito);
          void (async () => {
            await chiudi_lettore();
            await entra(pulito);
          })();
        },
        () => {
          /* fotogramma senza QR: normale, non è un errore */
        },
      );
    } catch (e) {
      await spegni_fotocamera();
      set_lettore_aperto(false);
      const nome = (e as { name?: string } | null)?.name ?? "";
      const negato = nome === "NotAllowedError" || nome === "SecurityError";
      set_errore_fotocamera(
        negato ? t("pista_login.qr_permesso_negato") : t("pista_login.qr_fotocamera_assente"),
      );
      segnala_errore("PistaLoginPage", "pista-login-qr", e, undefined, "avviso");
    }
  }, [chiudi_lettore, entra, spegni_fotocamera, t]);


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

        {/* Due porte pari: il codice digitato e il QR inquadrato. */}
        {mostra_bottone_qr && !lettore_aperto && (
          <Button
            variant="outline"
            size="lg"
            className="mt-4 h-16 w-full text-lg"
            onClick={() => void avvia_lettore()}
          >
            <Camera className="mr-2 h-6 w-6" />
            {t("pista_login.qr_inquadra")}
          </Button>
        )}

        {errore_fotocamera && (
          <p className="mt-3 rounded-xl border-2 border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-base font-medium text-destructive">
            {errore_fotocamera}
          </p>
        )}

        {lettore_aperto && (
          <div className="mt-4 rounded-2xl border-2 border-border bg-card p-3">
            <div id={ID_RIQUADRO_QR} className="w-full overflow-hidden rounded-xl" />
            {avviso_qr && (
              <p className="mt-3 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-base font-medium text-amber-700 dark:text-amber-400">
                {avviso_qr}
              </p>
            )}
            <Button
              variant="outline"
              size="lg"
              className="mt-3 h-14 w-full text-lg"
              onClick={() => void chiudi_lettore()}
            >
              {t("pista_login.qr_chiudi")}
            </Button>
          </div>
        )}


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

        {/* Via d'uscita per chi non è il tablet: la rotta esiste già ma oggi
            la trova solo chi conosce l'indirizzo a memoria. */}
        <p className="mt-2 text-center">
          <a href="/staff" className="text-sm text-muted-foreground underline underline-offset-4">
            {t("pista_login.accesso_staff")}
          </a>
        </p>
      </div>
    </div>
  );
};

export default PistaLoginPage;
