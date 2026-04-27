// Solo helper utility. Tutti i dati mock (atleti/istruttori/corsi/...) sono stati
// rimossi: il portale legge esclusivamente dal database Supabase reale.

export function calculate_age(data_nascita: string): number {
  const birth = new Date(data_nascita);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function days_until(date_str: string): number {
  const target = new Date(date_str);
  const today = new Date();
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
