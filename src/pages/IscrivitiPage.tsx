// Pagina pubblica /iscriviti/:token — domanda di iscrizione delle famiglie nuove.
// Una sola schermata scorrevole; l'atleta non viene creato qui: la domanda
// finisce in domande_iscrizione e la esamina la segreteria.
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { codice_errore_edge } from "@/lib/errore-edge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { type ArticoloContratto } from "@/lib/contratto-adesione";

const CANTONI_CH = [
  "AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH",
];

const messaggi_errore: Record<string, string> = {
  token_non_valido: "Questo link non è valido. Chiedi al club il link aggiornato.",
  iscrizioni_chiuse: "Le iscrizioni di questa stagione non sono aperte. Scrivi al club per informazioni.",
  atleta_incompleto: "Inserisci nome e cognome dell'atleta.",
  data_non_valida: "La data di nascita non è valida.",
  genitore_incompleto: "Inserisci nome e cognome del genitore o tutore.",
  email_non_valida: "Inserisci un indirizzo email valido.",
  contratto_non_accettato: "Devi accettare le condizioni del contratto di adesione.",
  contratto_cambiato:
    "Le condizioni del contratto sono cambiate mentre la pagina era aperta. Ricarica la pagina, rileggi il testo e invia di nuovo.",
  domanda_gia_inviata: "Abbiamo già ricevuto questa richiesta: è in attesa della segreteria.",
  troppe_richieste: "Troppe richieste inviate di recente. Riprova più tardi.",

  db_error: "Errore del server, riprova più tardi.",
  server_error: "Errore del server, riprova più tardi.",
};

const Campo: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {label}{required && " *"}
    </label>
    {children}
  </div>
);

const IscrivitiPage: React.FC = () => {
  const { token } = useParams();

  const [is_loading, set_is_loading] = useState(true);
  const [fatale, set_fatale] = useState<string | null>(null);
  const [errore, set_errore] = useState<string | null>(null);
  const [inviando, set_inviando] = useState(false);
  const [inviato, set_inviato] = useState<{ nome: string; email: string } | null>(null);

  const [club, set_club] = useState<{ nome: string; logo_url: string | null } | null>(null);
  const [stagione, set_stagione] = useState<{ nome: string; iscrizioni_aperte: boolean; iscrizioni_scadenza: string | null } | null>(null);
  const [livelli, set_livelli] = useState<string[]>([]);

  const [form, set_form] = useState<Record<string, any>>({
    nome: "", cognome: "", data_nascita: "", sesso: "",
    genitore1_nome: "", genitore1_cognome: "", genitore1_email: "", genitore1_telefono: "",
    genitore1_indirizzo: "", genitore1_cap: "", genitore1_citta: "", genitore1_cantone: "",
    esperienza: "", livello_dichiarato: "",
    consenso_foto_video: false, partecipa_gare: false, intende_test_livello: false,
  });
  const [contratto_ok, set_contratto_ok] = useState(false);
  // Il contratto arriva dal server: la pagina lo mostra e rimanda solo l'impronta.
  const [articoli, set_articoli] = useState<ArticoloContratto[]>([]);
  const [contratto_impronta, set_contratto_impronta] = useState<string | null>(null);


  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let vivo = true;
    const carica = async () => {
      set_is_loading(true);
      const { data, error } = await supabase.functions.invoke("iscrizione-pubblica", {
        body: { token: token ?? "", azione: "info" },
      });
      if (!vivo) return;
      const codice_errore = await codice_errore_edge(data, error);
      if (error || codice_errore) {
        set_fatale(messaggi_errore[codice_errore] ?? "Non è stato possibile aprire il modulo di iscrizione.");
      } else {
        set_club((data as any).club ?? null);
        set_stagione((data as any).stagione ?? null);
        set_livelli(((data as any).livelli ?? []) as string[]);
        const ctr = (data as any).contratto;
        set_articoli(((ctr?.articoli ?? []) as ArticoloContratto[]));
        set_contratto_impronta(ctr?.impronta ?? null);
      }
      set_is_loading(false);
    };
    carica();
    return () => { vivo = false; };
  }, [token]);

  const on_submit = async () => {
    if (!form.nome.trim() || !form.cognome.trim()) { set_errore(messaggi_errore.atleta_incompleto); return; }
    if (!form.data_nascita) { set_errore(messaggi_errore.data_non_valida); return; }
    if (!form.genitore1_nome.trim() || !form.genitore1_cognome.trim()) { set_errore(messaggi_errore.genitore_incompleto); return; }
    if (!form.genitore1_email.trim()) { set_errore(messaggi_errore.email_non_valida); return; }
    if (!contratto_ok) { set_errore(messaggi_errore.contratto_non_accettato); return; }
    if (!contratto_impronta) { set_errore(messaggi_errore.contratto_cambiato); return; }

    set_inviando(true);
    set_errore(null);
    const { data, error } = await supabase.functions.invoke("iscrizione-pubblica", {
      body: {
        token: token ?? "",
        azione: "invia",
        dati: { ...form, contratto_accettato: true, contratto_impronta },
      },
    });

    const codice_errore = await codice_errore_edge(data, error);
    if (error || codice_errore) {
      set_errore(messaggi_errore[codice_errore] ?? "Invio non riuscito, riprova.");
    } else {
      set_inviato({ nome: form.nome, email: form.genitore1_email });
    }
    set_inviando(false);
  };

  if (is_loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (fatale) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-sm w-full bg-card border rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">Iscrizione non disponibile</h1>
          <p className="text-sm text-muted-foreground">{fatale}</p>
        </div>
      </div>
    );
  }

  if (inviato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-sm w-full bg-card border rounded-2xl p-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h1 className="text-lg font-semibold">Richiesta inviata</h1>
          <p className="text-sm text-muted-foreground">
            Abbiamo ricevuto la richiesta per {inviato.nome}. Il club la esamina e ti scrive all'indirizzo {inviato.email}.
            Riceverai il codice di accesso al portale quando l'iscrizione sarà confermata.
          </p>
        </div>
      </div>
    );
  }

  if (!stagione?.iscrizioni_aperte) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-sm w-full bg-card border rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-lg font-semibold">Iscrizioni chiuse</h1>
          <p className="text-sm text-muted-foreground">
            {club?.nome ? `${club.nome} ` : ""}non sta raccogliendo iscrizioni in questo momento. Scrivi al club per informazioni.
          </p>
        </div>
      </div>
    );
  }

  const scadenza = stagione.iscrizioni_scadenza
    ? new Date(stagione.iscrizioni_scadenza + "T00:00:00").toLocaleDateString("it-CH")
    : null;

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex justify-center">
      <div className="w-full max-w-xl space-y-4 pb-10">
        <header className="text-center pt-4 space-y-2">
          {club?.logo_url && (
            <img src={club.logo_url} alt={`Logo di ${club.nome}`} className="h-16 mx-auto object-contain" />
          )}
          <h1 className="text-xl font-semibold">Iscrizione a {club?.nome ?? "il club"}</h1>
          <p className="text-sm text-muted-foreground">
            Stagione {stagione.nome}
            {scadenza ? ` · iscrizioni entro il ${scadenza}` : ""}
          </p>
        </header>

        {/* Atleta */}
        <section className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Atleta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Nome" required>
              <Input className="h-11" value={form.nome} onChange={(e) => set_val("nome", e.target.value)} />
            </Campo>
            <Campo label="Cognome" required>
              <Input className="h-11" value={form.cognome} onChange={(e) => set_val("cognome", e.target.value)} />
            </Campo>
            <Campo label="Data di nascita" required>
              <Input type="date" className="h-11" value={form.data_nascita} onChange={(e) => set_val("data_nascita", e.target.value)} />
            </Campo>
            <Campo label="Sesso">
              <select
                className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={form.sesso}
                onChange={(e) => set_val("sesso", e.target.value)}
              >
                <option value="">—</option>
                <option value="F">Femminile</option>
                <option value="M">Maschile</option>
              </select>
            </Campo>
          </div>
        </section>

        {/* Genitore */}
        <section className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Genitore / Tutore</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Nome" required>
              <Input className="h-11" value={form.genitore1_nome} onChange={(e) => set_val("genitore1_nome", e.target.value)} />
            </Campo>
            <Campo label="Cognome" required>
              <Input className="h-11" value={form.genitore1_cognome} onChange={(e) => set_val("genitore1_cognome", e.target.value)} />
            </Campo>
            <Campo label="Email" required>
              <Input className="h-11" type="email" value={form.genitore1_email} onChange={(e) => set_val("genitore1_email", e.target.value)} />
            </Campo>
            <Campo label="Telefono">
              <Input className="h-11" type="tel" value={form.genitore1_telefono} onChange={(e) => set_val("genitore1_telefono", e.target.value)} />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Indirizzo">
                <Input className="h-11" value={form.genitore1_indirizzo} onChange={(e) => set_val("genitore1_indirizzo", e.target.value)} />
              </Campo>
            </div>
            <Campo label="CAP">
              <Input className="h-11" value={form.genitore1_cap} onChange={(e) => set_val("genitore1_cap", e.target.value)} />
            </Campo>
            <Campo label="Località">
              <Input className="h-11" value={form.genitore1_citta} onChange={(e) => set_val("genitore1_citta", e.target.value)} />
            </Campo>
            <Campo label="Cantone">
              <select
                className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={form.genitore1_cantone}
                onChange={(e) => set_val("genitore1_cantone", e.target.value)}
              >
                <option value="">—</option>
                {CANTONI_CH.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Campo>
          </div>
        </section>

        {/* Esperienza */}
        <section className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Ha già pattinato?</h2>
          <Campo label="Esperienza">
            <Textarea
              rows={3}
              value={form.esperienza}
              onChange={(e) => set_val("esperienza", e.target.value)}
              placeholder="Racconta in poche righe se ha già pattinato, dove e per quanto tempo."
            />
          </Campo>
          <Campo label="Livello dichiarato">
            <select
              className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={form.livello_dichiarato}
              onChange={(e) => set_val("livello_dichiarato", e.target.value)}
            >
              <option value="">—</option>
              {livelli.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Campo>
          <p className="text-xs text-muted-foreground">
            Indicazione di massima: il livello lo assegna il club dopo averla vista in pista.
          </p>
        </section>

        {/* Dichiarazioni */}
        <section className="bg-card border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Dichiarazioni</h2>
          <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={!!form.consenso_foto_video} onChange={(e) => set_val("consenso_foto_video", e.target.checked)} />
            <span className="text-sm">Autorizzo l'uso di foto e video dell'atleta per la comunicazione istituzionale del Club (facoltativo, revocabile)</span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={!!form.partecipa_gare} onChange={(e) => set_val("partecipa_gare", e.target.checked)} />
            <span className="text-sm">L'atleta parteciperà a gare e competizioni</span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={!!form.intende_test_livello} onChange={(e) => set_val("intende_test_livello", e.target.checked)} />
            <span className="text-sm">L'atleta intende sostenere i test di livello</span>
          </label>
        </section>

        {/* Contratto */}
        <section className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Contratto di adesione</h2>
          <div className="max-h-80 overflow-y-auto rounded-xl border bg-muted/30 p-4 space-y-3">
            {articoli.map((a) => (
              <div key={a.numero}>
                <p className="text-xs font-bold text-foreground">Art. {a.numero} — {a.titolo}</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{a.testo}</p>
              </div>
            ))}
          </div>
          <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={contratto_ok} onChange={(e) => set_contratto_ok(e.target.checked)} />
            <span className="text-sm font-medium">Ho letto e accetto le condizioni del contratto di adesione *</span>
          </label>
        </section>

        {errore && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{errore}</p>
          </div>
        )}

        <Button className="w-full h-12 text-base" onClick={on_submit} disabled={inviando || !contratto_ok}>
          {inviando ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
          Invia la richiesta
        </Button>
      </div>
    </div>
  );
};

export default IscrivitiPage;
