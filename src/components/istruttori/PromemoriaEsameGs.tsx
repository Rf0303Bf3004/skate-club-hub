import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { use_referto_gs, type RigaRefertoGs } from "@/hooks/use-supabase-data";

type Persona = { id?: string; user_id?: string | null };

interface Props {
  /** Elenco dello staff del club: serve solo per collegare l'utente collegato alla sua scheda. */
  istruttori: Persona[];
  /** Se valorizzato, il riquadro mostra solo la riga di questa persona. */
  solo_user_id?: string | null;
}

const classe_esito = (esito: string) =>
  esito === "DA SISTEMARE"
    ? "border-destructive/40 bg-destructive/5 text-destructive"
    : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200";

/** Data ISO come numero confrontabile; le righe senza data finiscono in fondo. */
function quando(entro: string | null): number | null {
  if (!entro) return null;
  const d = new Date(`${String(entro).slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Prima i «da sistemare» con un termine già passato (dal più vecchio),
 * poi gli altri «da sistemare», infine gli «attenzione» con la data più vicina.
 */
function ordina(righe: RigaRefertoGs[]): RigaRefertoGs[] {
  const adesso = Date.now();
  const peso = (r: RigaRefertoGs) => {
    const t = quando(r.entro);
    if (r.esito === "DA SISTEMARE") return t !== null && t < adesso ? 0 : 1;
    return 2;
  };
  return [...righe].sort((a, b) => {
    const pa = peso(a);
    const pb = peso(b);
    if (pa !== pb) return pa - pb;
    const ta = quando(a.entro);
    const tb = quando(b.entro);
    if (ta === null && tb === null) return a.chi.localeCompare(b.chi);
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
}

/**
 * Promemoria della situazione G+S. La regola vive nella funzione SQL `referto_gs`:
 * qui non si calcola nessun termine e non si ricompone nessun testo.
 */
const PromemoriaEsameGs: React.FC<Props> = ({ istruttori, solo_user_id }) => {
  const { t } = useTranslation("istruttori");
  const navigate = useNavigate();
  const referto = use_referto_gs();

  // Una lettura fallita non è «nessuno da ricordare»: si dice, e si può riprovare.
  if (referto.isError) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4" />
            {solo_user_id ? t("promemoria.personale_titolo") : t("promemoria.titolo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <p className="text-sm text-destructive">{t("gs.referto_errore")}</p>
          <Button size="sm" variant="outline" onClick={() => referto.refetch()}>
            {t("gs.riprova")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!referto.isSuccess) return null;
  const da_sistemare = (referto.data ?? []).filter((r) => r.esito !== "OK");

  // Vista personale: solo la propria posizione, collegata per identificativo.
  if (solo_user_id) {
    const io = (istruttori ?? []).find((i) => i.user_id && i.user_id === solo_user_id);
    const riga = io?.id ? da_sistemare.find((r) => r.id === io.id) : undefined;
    if (!riga) return null;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4" />
            {t("promemoria.personale_titolo")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`rounded-lg border p-3 text-sm ${classe_esito(riga.esito)}`}>{riga.motivo}</div>
        </CardContent>
      </Card>
    );
  }

  if (da_sistemare.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-4 w-4" />
          {t("promemoria.titolo")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ordina(da_sistemare).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => navigate(`/istruttori?id=${r.id}`)}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-opacity hover:opacity-80 ${classe_esito(r.esito)}`}
          >
            <span className="font-semibold">{r.chi}</span>
            <span className="ml-2">{r.motivo}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};

export default PromemoriaEsameGs;
