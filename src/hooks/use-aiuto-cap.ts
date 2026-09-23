import { useEffect, useRef, useState } from "react";
import { cerca_nap } from "@/lib/formato-testo";

type Valori = { citta: string; cantone: string };

/**
 * Aiuto CAP svizzero, unico per tutti i moduli con indirizzo.
 * - Si attiva solo con paese CH e CAP di 4 cifre.
 * - Riempie cantone e (se unica) località, ma solo se il campo è vuoto o contiene
 *   ancora il valore messo dall'aiuto stesso: quello scritto a mano non si tocca.
 * - Con più località restituisce l'elenco da proporre, senza sceglierne una.
 * - Se la lettura fallisce non succede niente.
 */
export function use_aiuto_cap(
  cap: string | null | undefined,
  paese: string | null | undefined,
  valori: Valori,
  applica: (patch: Partial<Valori>) => void,
): string[] {
  const [localita, set_localita] = useState<string[]>([]);
  const valori_ref = useRef(valori);
  valori_ref.current = valori;
  const applica_ref = useRef(applica);
  applica_ref.current = applica;
  const ultimo_auto = useRef<Valori>({ citta: "", cantone: "" });

  const c = String(cap ?? "").trim();
  const attivo = (paese || "CH") === "CH" && /^\d{4}$/.test(c);

  useEffect(() => {
    if (!attivo) {
      set_localita([]);
      return;
    }
    let vivo = true;
    cerca_nap(c).then((info) => {
      if (!vivo) return;
      if (!info) {
        set_localita([]);
        return;
      }
      const attuali = valori_ref.current;
      const libero = (v: string, auto: string) => !v.trim() || (auto !== "" && v === auto);
      const patch: Partial<Valori> = {};
      if (libero(attuali.cantone ?? "", ultimo_auto.current.cantone)) {
        patch.cantone = info.cantone;
        ultimo_auto.current.cantone = info.cantone;
      }
      if (libero(attuali.citta ?? "", ultimo_auto.current.citta)) {
        const nuova = info.localita.length === 1 ? info.localita[0] : "";
        patch.citta = nuova;
        ultimo_auto.current.citta = nuova;
      }
      set_localita(info.localita.length > 1 ? info.localita : []);
      if (Object.keys(patch).length) applica_ref.current(patch);
    });
    return () => {
      vivo = false;
    };
  }, [attivo, c]);

  return localita;
}
