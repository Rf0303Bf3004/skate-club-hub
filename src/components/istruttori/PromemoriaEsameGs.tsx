import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format_data_completa } from "@/lib/format-data";
import {
  staff_da_ricordare,
  segnalazione_esame_gs,
  termine_esame_gs,
  giorni_al_termine_gs,
  type IstruttoreGs,
} from "@/lib/istruttore-gs";

type Persona = IstruttoreGs & { id?: string; user_id?: string | null };

interface Props {
  /** Elenco dello staff del club. */
  istruttori: Persona[];
  /** Se valorizzato, il riquadro mostra solo la riga di questa persona. */
  solo_user_id?: string | null;
}

const classe_gravita = (gravita: "rosso" | "ambra" | "info") =>
  gravita === "rosso"
    ? "border-destructive/40 bg-destructive/5 text-destructive"
    : gravita === "ambra"
      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
      : "border-border bg-muted/40 text-muted-foreground";

/**
 * Promemoria degli esami G+S ancora da sostenere.
 * Se non c'è niente da ricordare il componente non rende nulla: niente riquadri vuoti.
 */
const PromemoriaEsameGs: React.FC<Props> = ({ istruttori, solo_user_id }) => {
  const { t } = useTranslation("istruttori");
  const navigate = useNavigate();

  // Vista personale: solo la propria posizione, mai quella degli altri.
  if (solo_user_id) {
    const io = (istruttori ?? []).find((i) => i.user_id && i.user_id === solo_user_id);
    if (!io) return null;
    const segnalazione = segnalazione_esame_gs(io, t);
    const termine = termine_esame_gs(io);
    if (!segnalazione || !termine) return null;
    const giorni = giorni_al_termine_gs(io) ?? 0;
    const data = format_data_completa(termine.data);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4" />
            {t("promemoria.personale_titolo")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`rounded-lg border p-3 text-sm ${classe_gravita(segnalazione.gravita)}`}>
            <p>{giorni < 0 ? t("promemoria.personale_scaduto", { data }) : t("promemoria.personale_testo", { data })}</p>
            <p className="mt-1 text-xs">
              {giorni < 0
                ? t("gs.scaduto_da_giorni", { count: Math.abs(giorni) })
                : t("gs.restano_giorni", { count: giorni })}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const righe = staff_da_ricordare(istruttori ?? [], t);
  if (righe.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-4 w-4" />
          {t("promemoria.titolo")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {righe.map((r, idx) => (
          <button
            key={r.istruttore.id ?? idx}
            type="button"
            onClick={() => navigate(`/istruttori?id=${r.istruttore.id ?? ""}`)}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-opacity hover:opacity-80 ${classe_gravita(r.segnalazione.gravita)}`}
          >
            <span className="font-semibold">
              {r.istruttore.nome} {r.istruttore.cognome}
            </span>
            <span className="ml-2">
              {r.termine
                ? `${format_data_completa(r.termine)} · ${
                    (r.giorni ?? 0) < 0
                      ? t("gs.scaduto_da_giorni", { count: Math.abs(r.giorni ?? 0) })
                      : t("gs.restano_giorni", { count: r.giorni ?? 0 })
                  }`
                : t("promemoria.senza_termine")}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};

export default PromemoriaEsameGs;
