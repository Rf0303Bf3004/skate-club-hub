import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { segnala_errore } from "@/lib/errori";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import DateInput from "@/components/forms/DateInput";

interface Props {
  atleta_id: string;
  club_id: string;
}

interface Richiesta {
  id: string;
  istruttore_id: string | null;
  data_preferita: string | null;
  fascia_preferita: string | null;
  note_richiesta: string | null;
  note_risposta: string | null;
  stato: string;
  created_at: string;
}

const RichiestePrivateSezione: React.FC<Props> = ({ atleta_id, club_id }) => {
  const { t, i18n } = useTranslation("common");
  const qc = useQueryClient();
  const anno = new Date().getFullYear();

  const [form_open, set_form_open] = useState(false);
  const [istruttore_id, set_istruttore_id] = useState<string>("");
  const [data_preferita, set_data_preferita] = useState<string>("");
  const [fascia, set_fascia] = useState<string>("");
  const [nota, set_nota] = useState<string>("");
  const [salvando, set_salvando] = useState(false);

  const istruttori_query = useQuery({
    queryKey: ["portale_istruttori", club_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("istruttori")
        .select("id, nome, cognome")
        .eq("club_id", club_id)
        .eq("attivo", true)
        .order("cognome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; cognome: string }[];
    },
    enabled: !!club_id,
  });

  const richieste_query = useQuery({
    queryKey: ["portale_richieste_private", atleta_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("richieste_lezioni_private")
        .select("id, istruttore_id, data_preferita, fascia_preferita, note_richiesta, note_risposta, stato, created_at")
        .eq("atleta_id", atleta_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Richiesta[];
    },
    enabled: !!atleta_id,
  });

  const istruttori = istruttori_query.data ?? [];
  const richieste = richieste_query.data ?? [];

  const etichetta_stato = (s: string) => {
    if (s === "accettata") return t("richieste_private.stato_accettata");
    if (s === "rifiutata") return t("richieste_private.stato_rifiutata");
    if (s === "annullata") return t("richieste_private.stato_annullata");
    return t("richieste_private.stato_in_attesa");
  };
  const etichetta_fascia = (f: string | null) => {
    if (f === "mattina") return t("richieste_private.fascia_mattina");
    if (f === "pomeriggio") return t("richieste_private.fascia_pomeriggio");
    if (f === "sera") return t("richieste_private.fascia_sera");
    return t("richieste_private.nessuna_preferenza");
  };
  const nome_istruttore = (id: string | null) => {
    if (!id) return t("richieste_private.nessuna_preferenza");
    const i = istruttori.find((x) => x.id === id);
    return i ? `${i.nome} ${i.cognome}` : t("richieste_private.nessuna_preferenza");
  };

  const invia = async () => {
    set_salvando(true);
    try {
      const { error } = await supabase.from("richieste_lezioni_private").insert({
        club_id,
        atleta_id,
        istruttore_id: istruttore_id || null,
        data_preferita: data_preferita || null,
        fascia_preferita: fascia || null,
        note_richiesta: nota.trim() || null,
        stato: "in_attesa",
      });
      if (error) throw error;
      toast.success(t("richieste_private.inviata_ok"));
      set_form_open(false);
      set_istruttore_id("");
      set_data_preferita("");
      set_fascia("");
      set_nota("");
      await qc.invalidateQueries({ queryKey: ["portale_richieste_private", atleta_id] });
    } catch (e) {
      await segnala_errore("RichiestePrivateSezione", t("richieste_private.invia"), e, { atleta_id });
    } finally {
      set_salvando(false);
    }
  };

  const ritira = async (id: string) => {
    set_salvando(true);
    try {
      const { error } = await supabase
        .from("richieste_lezioni_private")
        .update({ stato: "annullata" })
        .eq("id", id)
        .eq("atleta_id", atleta_id)
        .eq("stato", "in_attesa");
      if (error) throw error;
      toast.success(t("richieste_private.ritirata_ok"));
      await qc.invalidateQueries({ queryKey: ["portale_richieste_private", atleta_id] });
    } catch (e) {
      await segnala_errore("RichiestePrivateSezione", t("richieste_private.ritira"), e, { id });
    } finally {
      set_salvando(false);
    }
  };

  const campo_cls =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400";

  return (
    <div className="space-y-4">
      <Button className="w-full bg-sky-500 hover:bg-sky-600" onClick={() => set_form_open((v) => !v)}>
        <Plus className="w-4 h-4 mr-1" /> {t("richieste_private.chiedi")}
      </Button>

      {form_open && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <p className="font-semibold text-slate-800">{t("richieste_private.form_titolo")}</p>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">{t("richieste_private.istruttore_preferito")}</label>
            <select className={campo_cls} value={istruttore_id} onChange={(e) => set_istruttore_id(e.target.value)}>
              <option value="">{t("richieste_private.nessuna_preferenza")}</option>
              {istruttori.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome} {i.cognome}
                </option>
              ))}
            </select>
            {(istruttori_query.isError || (istruttori_query.isSuccess && istruttori.length === 0)) && (
              <p className="text-xs text-amber-600">{t("richieste_private.nessun_istruttore")}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">{t("richieste_private.data_preferita")}</label>
            <DateInput
              value={data_preferita}
              onChange={set_data_preferita}
              min_year={anno}
              max_year={anno + 2}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">{t("richieste_private.fascia_preferita")}</label>
            <select className={campo_cls} value={fascia} onChange={(e) => set_fascia(e.target.value)}>
              <option value="">{t("richieste_private.nessuna_preferenza")}</option>
              <option value="mattina">{t("richieste_private.fascia_mattina")}</option>
              <option value="pomeriggio">{t("richieste_private.fascia_pomeriggio")}</option>
              <option value="sera">{t("richieste_private.fascia_sera")}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">{t("richieste_private.nota_richiesta")}</label>
            <textarea
              rows={3}
              className={`${campo_cls} resize-none`}
              value={nota}
              placeholder={t("richieste_private.nota_richiesta_placeholder")}
              onChange={(e) => set_nota(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={salvando} onClick={() => set_form_open(false)}>
              {t("richieste_private.annulla")}
            </Button>
            <Button className="bg-sky-500 hover:bg-sky-600" disabled={salvando} onClick={invia}>
              {t("richieste_private.invia")}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="font-semibold text-slate-800">{t("richieste_private.le_mie_richieste")}</p>

        {richieste_query.isError ? (
          <div className="bg-white border border-red-200 rounded-2xl p-4 space-y-2">
            <p className="flex items-start gap-2 text-sm text-red-600">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {t("richieste_private.errore_lettura")}
            </p>
            <Button variant="outline" size="sm" onClick={() => richieste_query.refetch()}>
              {t("richieste_private.riprova")}
            </Button>
          </div>
        ) : !richieste_query.isSuccess ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
          </div>
        ) : richieste.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500">
            {t("richieste_private.nessuna_richiesta")}
          </div>
        ) : (
          richieste.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{nome_istruttore(r.istruttore_id)}</span>
                <span className="text-xs font-bold text-slate-500">{etichetta_stato(r.stato)}</span>
              </div>
              <p className="text-xs text-slate-500">
                {r.data_preferita
                  ? new Date(`${r.data_preferita}T00:00:00`).toLocaleDateString(i18n.language)
                  : t("richieste_private.nessuna_preferenza")}{" "}
                · {etichetta_fascia(r.fascia_preferita)}
              </p>
              {r.note_richiesta && <p className="text-sm text-slate-700">{r.note_richiesta}</p>}
              {r.stato === "rifiutata" && r.note_risposta && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">
                    {t("richieste_private.risposta_club")}
                  </p>
                  <p className="text-sm text-amber-900">{r.note_risposta}</p>
                </div>
              )}
              {r.stato === "in_attesa" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={salvando || !richieste_query.isSuccess}
                  onClick={() => {
                    if (window.confirm(t("richieste_private.ritira_conferma"))) ritira(r.id);
                  }}
                >
                  {t("richieste_private.ritira")}
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RichiestePrivateSezione;
