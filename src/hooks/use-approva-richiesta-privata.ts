import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";

/**
 * Approvazione di una richiesta di lezione privata.
 * Non si approva la lezione: si approva la richiesta. Le lezioni nascono
 * dalla funzione del database `approva_richiesta_privata`, già valide.
 */

export type EsitoApprovazione = {
  lezioni_create: number;
  prima_lezione: string | null;
  problemi: string[];
};

export type ParametriApprovazione = {
  richiesta_id: string;
  istruttore_id: string;
  data: string;
  ora_inizio: string;
  durata_minuti: number;
  ricorrenza: "una_tantum" | "settimanale";
  ripetizioni: number;
  costo_totale: number;
  note: string | null;
  /** Ente che fattura le lezioni create. `undefined` = non gestito dal club. */
  ragione_sociale_id?: string | null;
};

/** Tutte le letture che cambiano quando una richiesta viene approvata. */
function invalida_tutto(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["richieste_lezioni_private"] });
  qc.invalidateQueries({ queryKey: ["lezioni_private"] });
  qc.invalidateQueries({ queryKey: ["lezioni_richiesta"] });
  qc.invalidateQueries({ queryKey: ["planning_private_settimana"] });
  qc.invalidateQueries({ queryKey: ["planning_unificato"] });
}

export function use_approva_richiesta_privata(opts?: {
  onSuccess?: (esito: EsitoApprovazione) => void;
  onError?: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: ParametriApprovazione): Promise<EsitoApprovazione> => {
      const { data, error } = await supabase.rpc("approva_richiesta_privata", {
        p_richiesta_id: p.richiesta_id,
        p_istruttore_id: p.istruttore_id,
        p_data: p.data,
        p_ora_inizio: p.ora_inizio,
        p_durata_minuti: p.durata_minuti,
        p_ricorrenza: p.ricorrenza,
        p_ripetizioni: p.ripetizioni,
        p_costo_totale: p.costo_totale,
        p_note: p.note,
      });
      if (error) throw error;
      const esito = (data ?? {}) as Record<string, unknown>;
      const problemi: string[] = Array.isArray(esito.problemi) ? (esito.problemi as string[]) : [];

      // Le lezioni esistono già: un fallimento qui non si nasconde e non
      // annulla l'approvazione, si riporta come riuscita a metà.
      if (p.ragione_sociale_id !== undefined) {
        const { error: err_ente } = await supabase
          .from("lezioni_private")
          .update({ ragione_sociale_id: p.ragione_sociale_id })
          .eq("richiesta_id", p.richiesta_id);
        if (err_ente) {
          await segnala_errore(
            "use_approva_richiesta_privata",
            "lezioni_private.ragione_sociale_id",
            err_ente,
            { richiesta_id: p.richiesta_id },
            "avviso",
          );
          problemi.push(err_ente.message);
        }
      }

      return {
        lezioni_create: Number(esito.lezioni_create ?? 0),
        prima_lezione: (esito.prima_lezione as string | null) ?? null,
        problemi,
      };
    },
    onSuccess: (esito) => {
      // Anche a metà strada le letture vanno aggiornate: quello che è stato
      // creato deve comparire, altrimenti si riprova e si duplica.
      invalida_tutto(qc);
      opts?.onSuccess?.(esito);
    },
    onError: (e) => {
      invalida_tutto(qc);
      opts?.onError?.(e);
    },
  });
}
