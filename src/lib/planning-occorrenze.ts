import { supabase } from "@/lib/supabase";

/**
 * Generazione occorrenze settimanali di un corso.
 * Riusa esattamente lo stesso schema dati del Planning classico
 * (planning_settimane + planning_corsi_settimana), ma in modo idempotente:
 * le occorrenze già presenti vengono saltate, mai duplicate né cancellate.
 */

export const GIORNI_OFFSET: Record<string, number> = {
  "Lunedì": 0,
  "Martedì": 1,
  "Mercoledì": 2,
  "Giovedì": 3,
  "Venerdì": 4,
  "Sabato": 5,
  "Domenica": 6,
};

export function format_local_iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function lunedi_di(data_iso: string): string {
  const d = new Date(`${data_iso}T00:00:00`);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return format_local_iso(d);
}

/** Elenco delle date (ISO) dello stesso giorno-settimana da `da` (esclusa) fino a `a` (inclusa). */
export function date_settimanali(da_iso: string, a_iso: string): string[] {
  const out: string[] = [];
  const cursore = new Date(`${da_iso}T00:00:00`);
  const fine = new Date(`${a_iso}T00:00:00`);
  cursore.setDate(cursore.getDate() + 7);
  while (cursore <= fine) {
    out.push(format_local_iso(cursore));
    cursore.setDate(cursore.getDate() + 7);
  }
  return out;
}

export async function ensure_settimana_planning(
  club_id: string,
  stagione_id: string,
  data_lunedi: string,
): Promise<string> {
  const { data: found, error } = await supabase
    .from("planning_settimane")
    .select("id,stagione_id")
    .eq("club_id", club_id)
    .eq("data_lunedi", data_lunedi)
    .maybeSingle();
  if (error) throw error;
  if (found) {
    if ((found as any).stagione_id !== stagione_id) {
      await supabase.from("planning_settimane").update({ stagione_id }).eq("id", (found as any).id);
    }
    return (found as any).id as string;
  }
  const { data: created, error: err_ins } = await supabase
    .from("planning_settimane")
    .insert({ club_id, data_lunedi, stagione_id, stato: "bozza" })
    .select("id")
    .single();
  if (err_ins) throw err_ins;
  return (created as any).id as string;
}

/**
 * Crea le occorrenze mancanti del corso per le date indicate.
 * Ritorna quante ne ha create e quante esistevano già.
 */
export async function genera_occorrenze_corso(params: {
  club_id: string;
  stagione_id: string;
  corso_id: string;
  date: string[];
  ora_inizio: string;
  ora_fine: string;
  istruttore_id?: string | null;
}): Promise<{ create: number; esistenti: number }> {
  const { club_id, stagione_id, corso_id, date, ora_inizio, ora_fine } = params;
  if (date.length === 0) return { create: 0, esistenti: 0 };

  const { data: gia_presenti, error: err_sel } = await supabase
    .from("planning_corsi_settimana")
    .select("data")
    .eq("corso_id", corso_id)
    .in("data", date);
  if (err_sel) throw err_sel;
  const set_presenti = new Set(((gia_presenti ?? []) as any[]).map((r) => r.data as string));

  const da_creare = date.filter((d) => !set_presenti.has(d));
  let create = 0;
  for (const d of da_creare) {
    const settimana_id = await ensure_settimana_planning(club_id, stagione_id, lunedi_di(d));
    const { error } = await supabase.from("planning_corsi_settimana").insert({
      settimana_id,
      corso_id,
      data: d,
      ora_inizio,
      ora_fine,
      istruttore_id: params.istruttore_id ?? null,
      annullato: false,
      is_evento_extra: false,
    } as any);
    if (error) {
      if (`${error.message}`.toLowerCase().includes("duplicate")) continue;
      throw error;
    }
    create += 1;
  }
  return { create, esistenti: date.length - create };
}
