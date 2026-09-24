import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, Copy, Check, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  codice_atleta: string;
}

const CalendarioTelefonoRiquadro: React.FC<Props> = ({ codice_atleta }) => {
  const { t } = useTranslation("portale");
  const [copiato, set_copiato] = useState(false);

  const https_url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/calendario-ics?codice=${encodeURIComponent(codice_atleta)}`;
  const webcal_url = https_url.replace(/^https:\/\//, "webcal://");

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(https_url);
      set_copiato(true);
      toast.success(t("calendario_telefono.copiato"));
      window.setTimeout(() => set_copiato(false), 2500);
    } catch {
      toast.error(t("calendario_telefono.errore_copia"));
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white flex items-center justify-center">
          <CalendarPlus className="w-5 h-5" />
        </div>
        <h2 className="font-bold text-slate-800 text-lg">{t("calendario_telefono.titolo")}</h2>
      </div>
      <p className="text-sm text-slate-600">{t("calendario_telefono.spiegazione")}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <a href={webcal_url}>
            <CalendarPlus className="w-4 h-4 mr-2" />
            {t("calendario_telefono.aggiungi")}
          </a>
        </Button>
        <Button variant="outline" className="min-h-11" onClick={copia}>
          {copiato ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {t("calendario_telefono.copia")}
        </Button>
      </div>
      <p className="flex items-start gap-2 text-sm font-medium text-amber-700">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        {t("calendario_telefono.riservatezza")}
      </p>
      <p className="text-xs text-slate-500">{t("calendario_telefono.ritardo")}</p>
    </section>
  );
};

export default CalendarioTelefonoRiquadro;
