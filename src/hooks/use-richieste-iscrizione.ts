import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { use_gestisci_richiesta } from "@/hooks/use-supabase-mutations";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { segnala_errore } from "@/lib/errori";

/**
 * Unica versione della decisione su una richiesta di iscrizione.
 * Usata dalla pagina Richieste e dalla home della segreteria: chi approva o
 * rifiuta da un punto qualunque produce esattamente le stesse scritture.
 */

export interface RichiestaDaGestire {
  id: string;
  atleta_id: string;
  atleta_nome: string;
  corso_id: string;
  corso_nome: string;
}

export function use_gestione_richieste() {
  const { t } = useTranslation("atleti");
  const { session } = useAuth();
  const gestisci = use_gestisci_richiesta();
  const qc = useQueryClient();

  /**
   * Esegue l'azione su una o più richieste.
   * Ritorna gli esiti: chi chiama può chiudere la finestra solo a cose fatte.
   */
  const esegui = async (
    richieste: RichiestaDaGestire[],
    azione: "approvata" | "rifiutata",
    note_risposta: string,
  ) => {
    let ok = 0;
    let ko = 0;
    for (const r of richieste) {
      try {
        await gestisci.mutateAsync({
          richiesta_id: r.id,
          azione,
          atleta_id: r.atleta_id,
          atleta_nome: r.atleta_nome || t("richieste_iscrizione.default_atleta_label"),
          corso_id: r.corso_id,
          corso_nome: r.corso_nome || t("richieste_iscrizione.default_corso_label"),
          note_risposta,
          gestita_da: session?.email || "",
        });
        ok++;
      } catch (e) {
        ko++;
        segnala_errore("use_gestione_richieste", "gestisci_richiesta", e);
      }
    }

    // Anche a operazione parziale le liste vanno aggiornate: il bollino del menu
    // e la home della segreteria devono smettere di mostrare ciò che è deciso.
    qc.invalidateQueries({ queryKey: ["richieste_iscrizione_pendenti_count"] });
    qc.invalidateQueries({ queryKey: ["segreteria_home_richieste"] });

    toast({
      title:
        ko === 0
          ? t(
              azione === "approvata"
                ? "richieste_iscrizione.toast.approvate"
                : "richieste_iscrizione.toast.rifiutate",
              { count: ok },
            )
          : t("richieste_iscrizione.toast.completate_errori", { ok, ko }),
      variant: ko > 0 ? "destructive" : undefined,
    });

    return { ok, ko };
  };

  return { esegui, is_pending: gestisci.isPending };
}
