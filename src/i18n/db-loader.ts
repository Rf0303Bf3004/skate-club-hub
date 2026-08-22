/**
 * Caricamento traduzioni da DB (tabella `traduzioni_ui`).
 *
 * Le resource statiche bundlate in `src/locales` restano il fallback: qui
 * facciamo il merge (deep + overwrite) dei valori presenti a DB sopra di esse.
 * Se il fetch fallisce, l'app continua a funzionare con i soli file statici.
 */
import i18n, { SUPPORTED_LOCALES } from '@/i18n';
import { supabase } from '@/lib/supabase';

export interface RigaTraduzione {
  id?: string;
  namespace: string;
  chiave: string;
  it?: string | null;
  de?: string | null;
  fr?: string | null;
  rm?: string | null;
  en?: string | null;
}

/** Trasforma "list.title" -> { list: { title: valore } } */
function set_nested(target: Record<string, any>, chiave: string, valore: string) {
  const parti = chiave.split('.');
  let node = target;
  for (let i = 0; i < parti.length - 1; i++) {
    const p = parti[i];
    if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
    node = node[p];
  }
  node[parti[parti.length - 1]] = valore;
}

/** Applica una singola riga ai resource bundle i18next in memoria. */
export function applica_riga_i18n(riga: RigaTraduzione) {
  for (const lingua of SUPPORTED_LOCALES) {
    const valore = (riga as Record<string, any>)[lingua];
    if (typeof valore !== 'string' || valore.trim() === '') continue;
    const bundle: Record<string, any> = {};
    set_nested(bundle, riga.chiave, valore);
    i18n.addResourceBundle(lingua, riga.namespace, bundle, true, true);
  }
}

let gia_caricato = false;

/** Carica tutte le traduzioni dal DB e le fonde sopra le resource statiche. */
export async function carica_traduzioni_db(force = false): Promise<number> {
  if (gia_caricato && !force) return 0;
  gia_caricato = true;
  try {
    const righe: RigaTraduzione[] = [];
    const page_size = 1000;
    for (let from = 0; ; from += page_size) {
      const { data, error } = await supabase
        .from('traduzioni_ui')
        .select('namespace,chiave,it,de,fr,rm,en')
        .order('namespace', { ascending: true })
        .order('chiave', { ascending: true })
        .range(from, from + page_size - 1);
      if (error) throw error;
      const batch = (data ?? []) as RigaTraduzione[];
      righe.push(...batch);
      if (batch.length < page_size) break;
    }

    // Merge per (lingua, namespace) in un solo addResourceBundle per ridurre il lavoro.
    const per_bundle = new Map<string, Record<string, any>>();
    for (const riga of righe) {
      for (const lingua of SUPPORTED_LOCALES) {
        const valore = (riga as Record<string, any>)[lingua];
        if (typeof valore !== 'string' || valore.trim() === '') continue;
        const k = `${lingua}::${riga.namespace}`;
        if (!per_bundle.has(k)) per_bundle.set(k, {});
        set_nested(per_bundle.get(k)!, riga.chiave, valore);
      }
    }
    for (const [k, bundle] of per_bundle) {
      const [lingua, namespace] = k.split('::');
      i18n.addResourceBundle(lingua, namespace, bundle, true, true);
    }
    // Forza un re-render dei componenti già montati.
    i18n.emit('languageChanged', i18n.language);
    return righe.length;
  } catch {
    // Nessun blocco: si resta sulle resource statiche.
    return 0;
  }
}
