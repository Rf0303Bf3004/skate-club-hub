import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, Loader2, AlertCircle, Upload } from "lucide-react";

const MAX_BYTES = 2 * 1024 * 1024;
const TIPI_OK = ["image/jpeg", "image/jpg", "image/png"];

const messaggi_errore: Record<string, string> = {
  codice_non_trovato: "Codice non trovato, verifica con il tuo club.",
  atleta_non_attivo: "Questo atleta non risulta attivo. Contatta il tuo club.",
  formato_non_valido: "Formato non valido: sono accettati solo file JPG o PNG.",
  file_troppo_grande: "Il file supera i 2MB. Scegli una foto più leggera.",
  upload_fallito: "Caricamento non riuscito, riprova.",
  db_error: "Errore del server, riprova più tardi.",
  server_error: "Errore del server, riprova più tardi.",
};

const CaricaFotoPage: React.FC = () => {
  const { codice_atleta } = useParams();
  const input_ref = useRef<HTMLInputElement>(null);

  const [is_loading, set_is_loading] = useState(true);
  const [atleta, set_atleta] = useState<{ nome: string; cognome: string; foto_url: string | null } | null>(null);
  const [errore, set_errore] = useState<string | null>(null);
  const [file, set_file] = useState<File | null>(null);
  const [anteprima, set_anteprima] = useState<string | null>(null);
  const [is_uploading, set_is_uploading] = useState(false);
  const [successo, set_successo] = useState(false);

  useEffect(() => {
    let attivo = true;
    const carica = async () => {
      set_is_loading(true);
      const { data, error } = await supabase.functions.invoke("upload-foto-atleta", {
        body: { codice_atleta: codice_atleta ?? "" },
      });
      if (!attivo) return;
      const codice_errore = (data as any)?.error;
      if (error || codice_errore) {
        set_errore(messaggi_errore[codice_errore] ?? "Codice non trovato, verifica con il tuo club.");
      } else {
        set_atleta((data as any).atleta);
      }
      set_is_loading(false);
    };
    carica();
    return () => {
      attivo = false;
    };
  }, [codice_atleta]);

  useEffect(() => {
    if (!file) {
      set_anteprima(null);
      return;
    }
    const url = URL.createObjectURL(file);
    set_anteprima(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const on_select = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!TIPI_OK.includes(f.type)) {
      set_errore(messaggi_errore.formato_non_valido);
      return;
    }
    if (f.size > MAX_BYTES) {
      set_errore(messaggi_errore.file_troppo_grande);
      return;
    }
    set_errore(null);
    set_successo(false);
    set_file(f);
  };

  const on_upload = async () => {
    if (!file) return;
    set_is_uploading(true);
    set_errore(null);
    const form = new FormData();
    form.append("codice_atleta", codice_atleta ?? "");
    form.append("file", file);
    const { data, error } = await supabase.functions.invoke("upload-foto-atleta", { body: form });
    const codice_errore = (data as any)?.error;
    if (error || codice_errore) {
      set_errore(messaggi_errore[codice_errore] ?? messaggi_errore.upload_fallito);
    } else {
      set_successo(true);
      set_file(null);
      set_atleta((prec) => (prec ? { ...prec, foto_url: (data as any).foto_url } : prec));
    }
    set_is_uploading(false);
  };

  if (is_loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!atleta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-sm w-full bg-card border rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">Atleta non trovato</h1>
          <p className="text-sm text-muted-foreground">{errore}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex justify-center">
      <div className="w-full max-w-md space-y-4">
        <header className="text-center pt-4">
          <h1 className="text-xl font-semibold">Carica la foto profilo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stai caricando la foto di <span className="font-semibold text-foreground">{atleta.nome} {atleta.cognome}</span>
          </p>
        </header>

        <div className="bg-card border rounded-2xl p-5 space-y-5">
          <div className="flex flex-col items-center gap-3">
            {anteprima ? (
              <img src={anteprima} alt="Anteprima nuova foto profilo" className="w-32 h-32 rounded-full object-cover border-4 border-primary/20" />
            ) : atleta.foto_url ? (
              <img src={atleta.foto_url} alt={`Foto attuale di ${atleta.nome} ${atleta.cognome}`} className="w-32 h-32 rounded-full object-cover border-4 border-muted" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
                {atleta.nome?.[0]}{atleta.cognome?.[0]}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{anteprima ? "Anteprima nuova foto" : atleta.foto_url ? "Foto attuale" : "Nessuna foto caricata"}</p>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Requisiti foto</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Sfondo bianco · Busto e viso · JPG/PNG min 300px · Max 2MB
            </p>
          </div>

          {errore && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{errore}</p>
            </div>
          )}

          {successo && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700">Foto caricata correttamente. Grazie!</p>
            </div>
          )}

          <input
            ref={input_ref}
            type="file"
            accept="image/jpeg,image/png"
            capture="user"
            className="hidden"
            onChange={on_select}
          />

          <div className="space-y-2">
            <Button variant="outline" className="w-full h-12 text-base" onClick={() => input_ref.current?.click()} disabled={is_uploading}>
              <Camera className="w-5 h-5 mr-2" />
              {file ? "Scegli un'altra foto" : "Scatta o scegli una foto"}
            </Button>
            <Button className="w-full h-12 text-base" onClick={on_upload} disabled={!file || is_uploading}>
              {is_uploading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
              Conferma e carica
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-6">
          In questa pagina puoi aggiornare solo la foto profilo.
        </p>
      </div>
    </div>
  );
};

export default CaricaFotoPage;
