// Pagina pubblica /prova/:slug — «vieni a provare»: la famiglia lascia i
// recapiti, il club richiama per fissare il giorno. Pensata per essere aperta
// da un volantino di carta con il telefono in mano: un campo per riga, testo
// grande, bottone largo. Nessuna autenticazione: il club si risolve dallo
// slug, l'invio passa dalla funzione richiedi_prova che convalida tutto lei.
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import DateInput from "@/components/forms/DateInput";
import { AlertCircle, CheckCircle2, Loader2, Mail, Phone, Send } from "lucide-react";

interface ClubPubblico {
  club_id: string;
  nome: string;
  citta: string | null;
  email: string | null;
  telefono: string | null;
  logo_url: string | null;
  colore_primario: string | null;
  sito_web: string | null;
}

const Campo: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="block text-base font-semibold text-foreground">{label}</span>
    {children}
  </label>
);

const ProvaGratuitaPage: React.FC = () => {
  const { slug } = useParams();
  const { t } = useTranslation("common");
  const k = (s: string, o?: Record<string, unknown>) => t(`prova_gratuita.${s}`, o as any) as string;

  const [is_loading, set_is_loading] = useState(true);
  const [club, set_club] = useState<ClubPubblico | null>(null);
  const [inviando, set_inviando] = useState(false);
  const [errore, set_errore] = useState<string | null>(null);
  const [inviato, set_inviato] = useState(false);

  const [nome, set_nome] = useState("");
  const [cognome, set_cognome] = useState("");
  const [data_nascita, set_data_nascita] = useState("");
  const [genitore_nome, set_genitore_nome] = useState("");
  const [telefono, set_telefono] = useState("");
  const [email, set_email] = useState("");
  const [note, set_note] = useState("");

  useEffect(() => {
    let vivo = true;
    const carica = async () => {
      set_is_loading(true);
      const { data, error } = await supabase.rpc("club_pubblico_da_slug", { p_slug: slug ?? "" });
      if (!vivo) return;
      // Errore di lettura o slug sconosciuto: in entrambi i casi niente modulo,
      // ma la pagina lo dice apertamente.
      set_club(!error && Array.isArray(data) && data.length > 0 ? (data[0] as ClubPubblico) : null);
      set_is_loading(false);
    };
    carica();
    return () => {
      vivo = false;
    };
  }, [slug]);

  const on_submit = async () => {
    set_inviando(true);
    set_errore(null);
    const { error } = await supabase.rpc("richiedi_prova", {
      p_slug: slug ?? "",
      p_nome: nome.trim(),
      p_cognome: cognome.trim(),
      p_data_nascita: data_nascita || null,
      p_genitore_nome: genitore_nome.trim(),
      p_email: email.trim(),
      p_telefono: telefono.trim(),
      p_note: note.trim(),
    });
    set_inviando(false);
    if (error) {
      // I messaggi della funzione sono già in italiano leggibile: si mostrano
      // così come arrivano e i campi restano compilati.
      set_errore(error.message || k("errore_generico"));
      return;
    }
    // Anche un doppio invio entro 24 ore torna qui: per la famiglia è un
    // successo normale, la richiesta c'è già.
    set_inviato(true);
  };

  if (is_loading) {
    return (
      <div className="min-h-mobile flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-mobile flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-sm w-full bg-card border rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
          <h1 className="text-lg font-semibold">{k("club_non_trovato_titolo")}</h1>
          <p className="text-base text-muted-foreground">{k("club_non_trovato_testo")}</p>
        </div>
      </div>
    );
  }

  if (inviato) {
    return (
      <div className="min-h-mobile flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-sm w-full bg-card border rounded-2xl p-6 text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
          <h1 className="text-xl font-semibold">{k("conferma_titolo")}</h1>
          <p className="text-base text-muted-foreground">
            {k("conferma_testo", { club: club.nome })}
          </p>
          {(club.telefono || club.email) && (
            <div className="pt-2 space-y-2">
              {club.telefono && (
                <a
                  href={`tel:${club.telefono}`}
                  className="flex items-center justify-center gap-2 text-base font-medium text-primary underline underline-offset-4"
                >
                  <Phone className="w-4 h-4" />
                  {club.telefono}
                </a>
              )}
              {club.email && (
                <a
                  href={`mailto:${club.email}`}
                  className="flex items-center justify-center gap-2 text-base font-medium text-primary underline underline-offset-4"
                >
                  <Mail className="w-4 h-4" />
                  {club.email}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-mobile bg-muted/30 px-4 py-6 flex justify-center">
      <div className="w-full max-w-md space-y-5 pb-10">
        <header className="text-center space-y-3 pt-2">
          {club.logo_url && (
            <img src={club.logo_url} alt={club.nome} className="h-20 mx-auto object-contain" />
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            {k("titolo", { club: club.nome })}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">{k("intro")}</p>
        </header>

        <section className="bg-card border rounded-2xl p-5 space-y-4">
          <Campo label={k("campo_nome")}>
            <Input className="h-12 text-base" value={nome} onChange={(e) => set_nome(e.target.value)} autoComplete="off" />
          </Campo>
          <Campo label={k("campo_cognome")}>
            <Input className="h-12 text-base" value={cognome} onChange={(e) => set_cognome(e.target.value)} autoComplete="off" />
          </Campo>
          <Campo label={k("campo_nascita")}>
            <DateInput value={data_nascita} onChange={set_data_nascita} min_year={1920} max_year={new Date().getFullYear()} />
          </Campo>
          <Campo label={k("campo_accompagnatore")}>
            <Input className="h-12 text-base" value={genitore_nome} onChange={(e) => set_genitore_nome(e.target.value)} autoComplete="name" />
          </Campo>
          <Campo label={k("campo_telefono")}>
            <Input className="h-12 text-base" type="tel" inputMode="tel" value={telefono} onChange={(e) => set_telefono(e.target.value)} autoComplete="tel" />
          </Campo>
          <Campo label={k("campo_email")}>
            <Input className="h-12 text-base" type="email" inputMode="email" value={email} onChange={(e) => set_email(e.target.value)} autoComplete="email" />
          </Campo>
          <p className="text-sm text-muted-foreground">{k("almeno_un_recapito")}</p>
          <Campo label={k("campo_note")}>
            <Textarea className="text-base min-h-20" value={note} onChange={(e) => set_note(e.target.value)} />
          </Campo>

          {errore && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2" role="alert">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-base text-destructive">{errore}</p>
            </div>
          )}

          <Button size="lg" className="w-full h-14 text-lg gap-2" onClick={on_submit} disabled={inviando}>
            {inviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {inviando ? k("invio_in_corso") : k("invia")}
          </Button>
        </section>
      </div>
    </div>
  );
};

export default ProvaGratuitaPage;
