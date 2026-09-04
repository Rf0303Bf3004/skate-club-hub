// Stagione di riferimento del club: unica fonte per limitare la generazione
// della Griglia e per legare i dati (blocchi, configurazione ghiaccio) alla
// stagione corretta. Nessuna generazione deve superare `data_fine`.
import { supabase, get_current_club_id } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export interface StagioneCorrente {
  id: string;
  nome: string;
  data_inizio: string;
  data_fine: string;
  attiva: boolean;
}

/** Stagione attiva del club; se nessuna è marcata attiva, la più recente. */
export async function carica_stagione_attiva(club_id?: string): Promise<StagioneCorrente | null> {
  const id_club = club_id ?? get_current_club_id();
  if (!id_club) return null;
  const { data, error } = await supabase
    .from("stagioni")
    .select("id,nome,data_inizio,data_fine,attiva")
    .eq("club_id", id_club)
    .order("data_inizio", { ascending: false });
  if (error) throw error;
  const lista = (data ?? []) as any[];
  const st = lista.find((s) => s.attiva) ?? lista[0] ?? null;
  return st ? ({ ...st, attiva: !!st.attiva } as StagioneCorrente) : null;
}

export function use_stagione_attiva() {
  const club_id = get_current_club_id();
  return useQuery({
    queryKey: ["stagione_attiva", club_id],
    enabled: !!club_id,
    queryFn: () => carica_stagione_attiva(club_id),
  });
}

/** Date (ISO) che cadono fuori dall'intervallo della stagione. */
export function date_fuori_stagione(date: string[], stagione: StagioneCorrente | null): string[] {
  if (!stagione) return [];
  return (date ?? []).filter((d) => d < stagione.data_inizio || d > stagione.data_fine);
}

/** Errore tipizzato: la ricorrenza uscirebbe dalla stagione. */
export class ErroreDateFuoriStagione extends Error {
  date_fuori: string[];
  stagione: StagioneCorrente;
  constructor(date_fuori: string[], stagione: StagioneCorrente) {
    super(`${date_fuori.length} date fuori dalla stagione ${stagione.nome}`);
    this.name = "ErroreDateFuoriStagione";
    this.date_fuori = date_fuori;
    this.stagione = stagione;
  }
}

/** Numero di settimane intere fra due date ISO (minimo 1). */
export function settimane_fra(da: string, a: string): number {
  const d1 = new Date(`${da}T00:00:00`).getTime();
  const d2 = new Date(`${a}T00:00:00`).getTime();
  const sett = Math.floor((d2 - d1) / (7 * 24 * 3600 * 1000));
  return Math.max(1, Math.min(52, sett));
}
