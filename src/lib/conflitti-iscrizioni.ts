import { supabase } from "@/lib/supabase";
import { registra_silenzioso } from "@/lib/errori";

export interface ConflittoIscrizione {
  corso_id: string;
  nome_corso: string;
  giorno: string;
  ora_inizio: string;
  ora_fine: string;
}

const to_min = (hhmm?: string | null): number => {
  if (!hhmm) return NaN;
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m ?? 0);
};

const normalizza_giorno = (g?: string | null) => (g ?? "").trim().toLowerCase();

/**
 * Avviso SOFT (non bloccante) sulle iscrizioni: verifica se l'atleta è già
 * iscritto a un altro corso attivo con orario sovrapposto nello stesso giorno
 * della settimana. Restituisce l'elenco dei corsi in conflitto (vuoto = ok).
 */
export async function verifica_conflitti_iscrizione(
  atleta_id: string,
  corso_id: string,
): Promise<ConflittoIscrizione[]> {
  const { data: corso, error: e_corso } = await supabase
    .from("corsi")
    .select("id,nome,giorno,ora_inizio,ora_fine")
    .eq("id", corso_id)
    .maybeSingle();
  if (e_corso || !corso) return [];

  const giorno = normalizza_giorno((corso as any).giorno);
  const inizio = to_min((corso as any).ora_inizio);
  const fine = to_min((corso as any).ora_fine);
  // Corso non pianificato (giorno o orario mancanti): nessun confronto possibile.
  if (!giorno || Number.isNaN(inizio) || Number.isNaN(fine)) return [];

  const { data: iscrizioni, error } = await supabase
    .from("iscrizioni_corsi")
    .select("corso_id,attiva,corsi(id,nome,giorno,ora_inizio,ora_fine,attivo)")
    .eq("atleta_id", atleta_id);
  if (error) {
    await registra_silenzioso("conflitti-iscrizioni", "Lettura iscrizioni per conflitti", error, { atleta_id, corso_id });
    return [];
  }

  const conflitti: ConflittoIscrizione[] = [];
  for (const r of (iscrizioni ?? []) as any[]) {
    if (r.attiva === false) continue;
    const c = r.corsi;
    if (!c || c.id === corso_id || c.attivo === false) continue;
    if (normalizza_giorno(c.giorno) !== giorno) continue;
    const c_in = to_min(c.ora_inizio);
    const c_out = to_min(c.ora_fine);
    if (Number.isNaN(c_in) || Number.isNaN(c_out)) continue;
    // Sovrapposizione oraria stretta (fine == inizio non è un conflitto).
    if (c_in < fine && c_out > inizio) {
      conflitti.push({
        corso_id: c.id,
        nome_corso: c.nome ?? "Corso",
        giorno: c.giorno ?? giorno,
        ora_inizio: (c.ora_inizio ?? "").slice(0, 5),
        ora_fine: (c.ora_fine ?? "").slice(0, 5),
      });
    }
  }
  return conflitti;
}
