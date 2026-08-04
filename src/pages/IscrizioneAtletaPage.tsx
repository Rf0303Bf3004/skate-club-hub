import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, CheckCircle2, Loader2, AlertCircle, Send } from "lucide-react";
import { build_contratto, type DatiContratto } from "@/lib/contratto-adesione";
import { get_livello_display } from "@/lib/atleta-livello";

const MAX_BYTES = 2 * 1024 * 1024;
const TIPI_OK = ["image/jpeg", "image/jpg", "image/png"];

const CANTONI_CH = [
  "AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH",
];

const messaggi_errore: Record<string, string> = {
  codice_non_trovato: "Codice non trovato, verifica con il tuo club.",
  formato_non_valido: "Formato non valido: sono accettati solo file JPG o PNG.",
  file_troppo_grande: "Il file supera i 2MB. Scegli una foto più leggera.",
  upload_fallito: "Caricamento della foto non riuscito, riprova.",
  contratto_non_accettato: "Devi accettare le condizioni del contratto di adesione.",
  data_non_valida: "La data di nascita non è valida.",
  dati_non_validi: "Dati non validi, ricontrolla il modulo.",
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

const ReadOnly: React.FC<{ label: string; valore?: string | null }> = ({ label, valore }) => (
  <div className="rounded-xl bg-muted/60 px-3 py-2">
    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-sm font-medium text-foreground">{valore || "—"}</p>
  </div>
);

const IscrizioneAtletaPage: React.FC = () => {
  const { codice_atleta } = useParams();
  const input_ref = useRef<HTMLInputElement>(null);

  const [is_loading, set_is_loading] = useState(true);
  const [atleta, set_atleta] = useState<any>(null);
  const [contesto, set_contesto] = useState<DatiContratto>({});
  const [errore, set_errore] = useState<string | null>(null);
  const [fatale, set_fatale] = useState<string | null>(null);
  const [salvando, set_salvando] = useState(false);
  const [successo, set_successo] = useState(false);

  const [form, set_form] = useState<Record<string, any>>({});
  const [contratto_ok, set_contratto_ok] = useState(false);
  const [file, set_file] = useState<File | null>(null);
  const [anteprima, set_anteprima] = useState<string | null>(null);

  const set_val = (k: string, v: any) => set_form((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let vivo = true;
    const carica = async () => {
      set_is_loading(true);
      const { data, error } = await supabase.functions.invoke("iscrizione-atleta", {
        body: { codice_atleta: codice_atleta ?? "", azione: "lookup" },
      });
      if (!vivo) return;
      const codice_errore = (data as any)?.error;
      if (error || codice_errore) {
        set_fatale(messaggi_errore[codice_errore] ?? "Codice non trovato, verifica con il tuo club.");
      } else {
        const a = (data as any).atleta;
        set_atleta(a);
        set_contesto((data as any).contesto ?? {});
        set_form({
          nome: a.nome ?? "",
          cognome: a.cognome ?? "",
          data_nascita: a.data_nascita ?? "",
          genitore1_nome: a.genitore1_nome ?? "",
          genitore1_cognome: a.genitore1_cognome ?? "",
          genitore1_telefono: a.genitore1_telefono ?? "",
          genitore1_email: a.genitore1_email ?? "",
          genitore1_indirizzo: a.genitore1_indirizzo ?? "",
          genitore1_cap: a.genitore1_cap ?? "",
          genitore1_citta: a.genitore1_citta ?? "",
          genitore1_cantone: a.genitore1_cantone ?? "",
          partecipa_gare: !!a.partecipa_gare,
          intende_test_livello: !!a.intende_test_livello,
          consenso_foto_video: !!a.consenso_foto_video,
        });
      }
      set_is_loading(false);
    };
    carica();
    return () => { vivo = false; };
  }, [codice_atleta]);

  useEffect(() => {
    if (!file) { set_anteprima(null); return; }
    const url = URL.createObjectURL(file);
    set_anteprima(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const articoli = useMemo(() => build_contratto(contesto), [contesto]);

  const on_select_file = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!TIPI_OK.includes(f.type)) { set_errore(messaggi_errore.formato_non_valido); return; }
    if (f.size > MAX_BYTES) { set_errore(messaggi_errore.file_troppo_grande); return; }
    set_errore(null);
    set_file(f);
  };

  const nome_bloccato = !!atleta?.nome;
  const cognome_bloccato = !!atleta?.cognome;
  const nascita_bloccata = !!atleta?.data_nascita;

  const on_submit = async () => {
    if (!contratto_ok) { set_errore(messaggi_errore.contratto_non_accettato); return; }
    if (!nome_bloccato && !form.nome?.trim()) { set_errore("Inserisci il nome dell'atleta."); return; }
    if (!cognome_bloccato && !form.cognome?.trim()) { set_errore("Inserisci il cognome dell'atleta."); return; }
    if (!form.genitore1_nome?.trim() || !form.genitore1_cognome?.trim()) { set_errore("Inserisci nome e cognome del genitore/tutore."); return; }
    if (!form.genitore1_email?.trim()) { set_errore("Inserisci l'email del genitore/tutore."); return; }

    set_salvando(true);
    set_errore(null);
    const dati = { ...form, contratto_accettato: true };
    const body = new FormData();
    body.append("codice_atleta", codice_atleta ?? "");
    body.append("azione", "salva");
    body.append("dati", JSON.stringify(dati));
    if (file) body.append("file", file);

    const { data, error } = await supabase.functions.invoke("iscrizione-atleta", { body });
    const codice_errore = (data as any)?.error;
    if (error || codice_errore) {
      set_errore(messaggi_errore[codice_errore] ?? "Invio non riuscito, riprova.");
    } else {
      set_successo(true);
      set_file(null);
    }
    set_salvando(false);
  };

  if (is_loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (fatale || !atleta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-sm w-full bg-card border rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">Atleta non trovato</h1>
          <p className="text-sm text-muted-foreground">{fatale}</p>
        </div>
      </div>
    );
  }

  if (successo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-sm w-full bg-card border rounded-2xl p-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h1 className="text-lg font-semibold">Iscrizione completata</h1>
          <p className="text-sm text-muted-foreground">
            Grazie! I dati di {form.nome} {form.cognome} sono stati registrati e l'iscrizione è attiva.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex justify-center">
      <div className="w-full max-w-xl space-y-4 pb-10">
        <header className="text-center pt-4">
          <h1 className="text-xl font-semibold">Iscrizione atleta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contesto.club_nome || "Il tuo club"}
            {contesto.stagione_nome ? ` · ${contesto.stagione_nome}` : ""}
          </p>
        </header>

        {/* Atleta */}
        <section className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Atleta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {nome_bloccato ? <ReadOnly label="Nome" valore={atleta.nome} /> : (
              <Campo label="Nome" required>
                <Input className="h-11" value={form.nome} onChange={(e) => set_val("nome", e.target.value)} />
              </Campo>
            )}
            {cognome_bloccato ? <ReadOnly label="Cognome" valore={atleta.cognome} /> : (
              <Campo label="Cognome" required>
                <Input className="h-11" value={form.cognome} onChange={(e) => set_val("cognome", e.target.value)} />
              </Campo>
            )}
            {nascita_bloccata ? (
              <ReadOnly label="Data di nascita" valore={new Date(atleta.data_nascita + "T00:00:00").toLocaleDateString("it-CH")} />
            ) : (
              <Campo label="Data di nascita">
                <Input type="date" className="h-11" value={form.data_nascita} onChange={(e) => set_val("data_nascita", e.target.value)} />
              </Campo>
            )}
            <ReadOnly label="Livello attuale (assegnato dal Club)" valore={get_livello_display(atleta as any)} />
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
            <Campo label="Telefono">
              <Input className="h-11" type="tel" value={form.genitore1_telefono} onChange={(e) => set_val("genitore1_telefono", e.target.value)} />
            </Campo>
            <Campo label="Email" required>
              <Input className="h-11" type="email" value={form.genitore1_email} onChange={(e) => set_val("genitore1_email", e.target.value)} />
            </Campo>
            <div className="sm:col-span-2">
              <Campo label="Indirizzo">
                <Input className="h-11" value={form.genitore1_indirizzo} onChange={(e) => set_val("genitore1_indirizzo", e.target.value)} />
              </Campo>
            </div>
            <Campo label="CAP">
              <Input className="h-11" value={form.genitore1_cap} onChange={(e) => set_val("genitore1_cap", e.target.value)} />
            </Campo>
            <Campo label="Città">
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

        {/* Dichiarazioni */}
        <section className="bg-card border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Dichiarazioni</h2>
          <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={!!form.partecipa_gare} onChange={(e) => set_val("partecipa_gare", e.target.checked)} />
            <span className="text-sm">L'atleta parteciperà a gare e competizioni</span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={!!form.intende_test_livello} onChange={(e) => set_val("intende_test_livello", e.target.checked)} />
            <span className="text-sm">L'atleta intende sostenere i test di livello (cammino sportivo)</span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={!!form.consenso_foto_video} onChange={(e) => set_val("consenso_foto_video", e.target.checked)} />
            <span className="text-sm">Autorizzo l'uso di foto e video dell'atleta per la comunicazione istituzionale del Club (facoltativo, revocabile)</span>
          </label>
        </section>

        {/* Foto profilo */}
        <section className="bg-card border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Foto profilo</h2>
          <div className="flex flex-col items-center gap-3">
            {anteprima ? (
              <img src={anteprima} alt="Anteprima nuova foto profilo" className="w-28 h-28 rounded-full object-cover border-4 border-primary/20" />
            ) : atleta.foto_url ? (
              <img src={atleta.foto_url} alt={`Foto attuale di ${atleta.nome ?? ""}`} className="w-28 h-28 rounded-full object-cover border-4 border-muted" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
                {(form.nome?.[0] ?? "")}{(form.cognome?.[0] ?? "")}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Sfondo bianco · Busto e viso · JPG/PNG · max 2MB</p>
          </div>
          <input ref={input_ref} type="file" accept="image/jpeg,image/png" capture="user" className="hidden" onChange={on_select_file} />
          <Button variant="outline" className="w-full h-12 text-base" onClick={() => input_ref.current?.click()} disabled={salvando}>
            <Camera className="w-5 h-5 mr-2" />
            {file ? "Scegli un'altra foto" : "Scatta o scegli una foto"}
          </Button>
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

        <Button className="w-full h-12 text-base" onClick={on_submit} disabled={salvando || !contratto_ok}>
          {salvando ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
          Invia iscrizione
        </Button>
      </div>
    </div>
  );
};

export default IscrizioneAtletaPage;
