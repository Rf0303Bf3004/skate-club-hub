import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Tag, MapPin, Calendar, Ticket } from "lucide-react";

interface ConvenzionePubblica {
  id: string;
  azienda: string;
  titolo: string;
  descrizione: string | null;
  logo_url: string | null;
  immagine_url: string | null;
  indirizzo: string | null;
  geo_citta: string | null;
  geo_cantone: string | null;
  validita_da: string | null;
  validita_a: string | null;
  codice_sconto: string | null;
  stato: string;
  qr_token: string;
  valore_proposta: string | null;
  convenzioni_aree?: { nome: string } | null;
  convenzioni_tipi_proposta?: { nome: string; formato: string | null } | null;
}

function format_proposta(formato: string | null | undefined, valore: string | null | undefined): string | null {
  const v = (valore ?? "").trim();
  if (!v) return null;
  if (formato === "percentuale") return `-${v}%`;
  if (formato === "importo") return `-${v} CHF`;
  return v;
}

function useSignedUrl(path: string | null) {
  const [url, set_url] = useState<string | null>(null);
  useEffect(() => {
    let attivo = true;
    if (!path) { set_url(null); return; }
    supabase.storage.from("convenzioni").createSignedUrl(path, 3600).then(({ data }) => {
      if (attivo) set_url(data?.signedUrl ?? null);
    });
    return () => { attivo = false; };
  }, [path]);
  return url;
}

export default function ConvenzionePubblicaPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, set_loading] = useState(true);
  const [data, set_data] = useState<ConvenzionePubblica | null>(null);
  const [not_found, set_not_found] = useState(false);

  useEffect(() => {
    let attivo = true;
    if (!token) { set_loading(false); set_not_found(true); return; }
    (async () => {
      const { data: row } = await supabase
        .from("convenzioni")
        .select("*, convenzioni_aree(nome), convenzioni_tipi_proposta(nome, formato)")
        .eq("qr_token", token)
        .maybeSingle();
      if (!attivo) return;
      if (!row || row.stato !== "attiva") {
        set_not_found(true);
        set_loading(false);
        return;
      }
      set_data(row as any);
      set_loading(false);

      // Registra scansione (best-effort)
      try {
        const { data: sess } = await supabase.auth.getSession();
        const user_id = sess?.session?.user?.id ?? null;
        let club_id: string | null = null;
        let atleta_id: string | null = null;
        if (user_id) {
          const { data: uc } = await supabase
            .from("utenti_club")
            .select("club_id")
            .eq("user_id", user_id)
            .maybeSingle();
          club_id = uc?.club_id ?? null;
        }
        // Mobile parent JWT exposes atleta_id in app_metadata via custom claims;
        // fallback: leave null (we don't try to guess on web)
        const meta: any = sess?.session?.user?.app_metadata ?? {};
        if (meta?.atleta_id) atleta_id = meta.atleta_id;
        if (meta?.club_id && !club_id) club_id = meta.club_id;

        await supabase.from("convenzioni_scansioni").insert({
          qr_token: token,
          convenzione_id: row.id,
          club_id,
          atleta_id,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        });
      } catch {
        // ignora errori di tracking
      }
    })();
    return () => { attivo = false; };
  }, [token]);

  const logo_url = useSignedUrl(data?.logo_url ?? null);
  const imm_url = useSignedUrl(data?.immagine_url ?? null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-400" />
      </div>
    );
  }

  if (not_found || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-lg border border-slate-200 p-8 text-center shadow-sm">
          <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-slate-900 mb-1">Convenzione non disponibile</h1>
          <p className="text-sm text-slate-500">
            La convenzione che stai cercando non esiste oppure non è più attiva.
          </p>
        </div>
      </div>
    );
  }

  const lbl = format_proposta(data.convenzioni_tipi_proposta?.formato, data.valore_proposta);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {imm_url && (
            <div className="aspect-video bg-slate-100">
              <img src={imm_url} alt={data.azienda} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 space-y-5">
            <div className="flex gap-4 items-start">
              <div className="w-20 h-20 shrink-0 border border-slate-200 rounded bg-slate-50 flex items-center justify-center overflow-hidden">
                {logo_url
                  ? <img src={logo_url} alt={data.azienda} className="w-full h-full object-contain" />
                  : <span className="text-2xl font-bold text-slate-400">{data.azienda.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-slate-900">{data.azienda}</h1>
                <p className="text-sm text-slate-600 mt-0.5">{data.titolo}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {data.convenzioni_aree?.nome && (
                    <Badge variant="outline">{data.convenzioni_aree.nome}</Badge>
                  )}
                  {lbl && <Badge className="bg-blue-600 text-white hover:bg-blue-600">{lbl}</Badge>}
                </div>
              </div>
            </div>

            {data.descrizione && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.descrizione}</p>
            )}

            <div className="space-y-2 text-sm">
              {(data.indirizzo || data.geo_citta || data.geo_cantone) && (
                <div className="flex gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {[data.indirizzo, data.geo_citta, data.geo_cantone].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {(data.validita_da || data.validita_a) && (
                <div className="flex gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>Validità: {data.validita_da ?? "—"} → {data.validita_a ?? "—"}</span>
                </div>
              )}
              {data.codice_sconto && (
                <div className="flex gap-2 items-center">
                  <Ticket className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-700">Codice sconto:</span>
                  <code className="bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-sm font-mono">
                    {data.codice_sconto}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400 text-center mt-4">
          Convenzione riservata ai soci dei club aderenti.
        </p>
      </div>
    </div>
  );
}
