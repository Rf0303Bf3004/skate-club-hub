import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Firma al volo i percorsi del bucket privato-in-arrivo `foto-atleti`.
 * Stesso schema già usato per `convenzioni` e `fatture-atleti`.
 * Piccola cache in memoria: la stessa foto non viene rifirmata a ogni render.
 */
const BUCKET = "foto-atleti";
const DURATA_SEC = 3600;
const MARGINE_MS = 5 * 60 * 1000;

const cache = new Map<string, { url: string; scade: number }>();
const in_corso = new Map<string, Promise<string | null>>();

function da_cache(path?: string | null): string | null {
  if (!path) return null;
  const voce = cache.get(path);
  return voce && voce.scade > Date.now() ? voce.url : null;
}

export async function firma_foto_atleta(path?: string | null): Promise<string | null> {
  if (!path) return null;
  const gia = da_cache(path);
  if (gia) return gia;
  const pendente = in_corso.get(path);
  if (pendente) return pendente;

  const p = supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, DURATA_SEC)
    .then(({ data }) => {
      const url = data?.signedUrl ?? null;
      if (url) cache.set(path, { url, scade: Date.now() + DURATA_SEC * 1000 - MARGINE_MS });
      return url;
    })
    .catch(() => null)
    .finally(() => {
      in_corso.delete(path);
    });

  in_corso.set(path, p);
  return p;
}

/** URL firmato della foto atleta (null finché non è pronto o se il percorso manca). */
export function useSignedPhoto(path?: string | null): string | null {
  const [url, set_url] = useState<string | null>(() => da_cache(path));

  useEffect(() => {
    let attivo = true;
    if (!path) {
      set_url(null);
      return;
    }
    const gia = da_cache(path);
    if (gia) {
      set_url(gia);
      return;
    }
    firma_foto_atleta(path).then((u) => {
      if (attivo) set_url(u);
    });
    return () => {
      attivo = false;
    };
  }, [path]);

  return url;
}
