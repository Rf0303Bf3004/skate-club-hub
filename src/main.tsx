import { createRoot } from "react-dom/client";
import "@/i18n"; // inizializza react-i18next prima di qualunque componente
import { carica_traduzioni_db } from "@/i18n/db-loader";
import App from "./App.tsx";
import "./index.css";

// Le traduzioni gestite dal superadmin (tabella `traduzioni_ui`) hanno priorità
// sui file statici. Caricamento non bloccante: se fallisce restano i JSON bundlati.
void carica_traduzioni_db();

// ---------------------------------------------------------------------------
// Ripresa automatica dopo una pubblicazione.
//
// Un tablet (o qualunque schermo rimasto aperto) può avere in memoria la pagina
// della versione precedente: i file con il vecchio hash non esistono più e lo
// schermo resta bianco. Due reti di sicurezza, entrambe con protezione dal
// ciclo di ricariche infinite.
// ---------------------------------------------------------------------------

const MARCATORE_RICARICA = "app_reload_chunk";
const FINESTRA_RICARICA_MS = 60_000;

/** Ricarica la pagina, ma mai più di una volta al minuto. */
function ricarica_con_freno(): void {
  try {
    const ultima = Number(sessionStorage.getItem(MARCATORE_RICARICA) ?? 0);
    if (Date.now() - ultima < FINESTRA_RICARICA_MS) return;
    sessionStorage.setItem(MARCATORE_RICARICA, String(Date.now()));
  } catch {
    // sessionStorage non disponibile: meglio non ricaricare a ripetizione.
    return;
  }
  window.location.reload();
}

// 1) Un pezzo dell'applicazione non si carica più (chunk sparito dopo una
//    pubblicazione): si ricarica da sola.
const MESSAGGI_CHUNK_PERSO = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "Loading chunk",
];

function e_chunk_perso(testo: unknown): boolean {
  if (typeof testo !== "string") return false;
  return MESSAGGI_CHUNK_PERSO.some((m) => testo.includes(m));
}

window.addEventListener("vite:preloadError", (evento) => {
  evento.preventDefault();
  ricarica_con_freno();
});

window.addEventListener("error", (evento) => {
  if (e_chunk_perso(evento.message) || e_chunk_perso(evento.error?.message)) {
    ricarica_con_freno();
  }
});

window.addEventListener("unhandledrejection", (evento) => {
  const motivo = evento.reason;
  const testo =
    typeof motivo === "string"
      ? motivo
      : ((motivo as { message?: string } | null)?.message ?? String(motivo ?? ""));
  if (e_chunk_perso(testo)) ricarica_con_freno();
});

// 2) Controllo periodico: se è uscita una versione nuova, questa è vecchia.
//    Si ricarica SOLO mentre la pagina è nascosta. Mai quando è visibile: chi
//    torna sulla scheda dopo un'assenza troverebbe i moduli a metà cancellati
//    senza preavviso (il tempo di inattività da solo non distingue «nessuno»
//    da «sono appena rientrato»).
const hash_in_esecuzione: string | null = (() => {
  const src = document.querySelector<HTMLScriptElement>("script[type=module]")?.src ?? "";
  const trovato = /assets\/index-[^/]+\.js/.exec(src);
  return trovato ? trovato[0] : null;
})();

async function controlla_versione(): Promise<void> {
  if (!hash_in_esecuzione) return;
  try {
    const risposta = await fetch("/index.html", { cache: "no-store" });
    if (!risposta.ok) return;
    const html = await risposta.text();
    const trovato = /assets\/index-[^/]+\.js/.exec(html);
    if (!trovato || trovato[0] === hash_in_esecuzione) return;
    // Versione nuova pubblicata: ricarica solo se la pagina è nascosta.
    // Una pagina visibile non si ricarica mai da sola, neppure se inattiva.
    if (document.hidden) ricarica_con_freno();
  } catch {
    // Rete assente o instabile: non è un problema, si riprova al prossimo giro.
  }
}

window.setInterval(() => void controlla_versione(), 10 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void controlla_versione();
});

createRoot(document.getElementById("root")!).render(<App />);
