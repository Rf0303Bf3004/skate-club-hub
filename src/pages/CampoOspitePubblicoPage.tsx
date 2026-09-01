import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OspitiImportWizard from "@/components/campi/OspitiImportWizard";
import type { EsitoImportOspite, RigaOspiteInput } from "@/hooks/use-campi-interclub";
import { supabase } from "@/lib/supabase";
import { format_data_completa } from "@/lib/format-data";

type InfoCampo = {
  evento: {
    nome: string | null;
    data_inizio: string | null;
    data_fine: string | null;
    luogo: string | null;
    descrizione: string | null;
  } | null;
  club_provenienza: string;
  gruppi: { id: string; nome: string }[];
  atleti_registrati: number;
};

/**
 * Pagina pubblica (link con token) per i club ospitati che non usano il portale:
 * caricano l'elenco dei propri atleti da Excel o a mano. Nessuna autenticazione:
 * il token nell'URL è la credenziale, tutta la logica sta nella edge function.
 */
const CampoOspitePubblicoPage: React.FC = () => {
  const { token = "" } = useParams();
  const [info, set_info] = useState<InfoCampo | null>(null);
  const [errore, set_errore] = useState<string | null>(null);
  const [gruppo_id, set_gruppo_id] = useState<string>("");

  useEffect(() => {
    let annullato = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("campo-ospite", {
        body: { azione: "info", token },
      });
      if (annullato) return;
      if (error || (data as any)?.error) {
        set_errore((data as any)?.error ?? error?.message ?? "token_non_valido");
        return;
      }
      set_info(data as InfoCampo);
    })();
    return () => {
      annullato = true;
    };
  }, [token]);

  const registra = async (elenco: RigaOspiteInput[]): Promise<EsitoImportOspite[]> => {
    const { data, error } = await supabase.functions.invoke("campo-ospite", {
      body: { azione: "registra", token, elenco, gruppo_id: gruppo_id || null },
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).dettaglio ?? (data as any).error);
    return ((data as any)?.risultato ?? []) as EsitoImportOspite[];
  };

  if (errore) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Link non valido</CardTitle>
            <CardDescription>
              Questo link non è più attivo. Chiedi al club organizzatore di generarne uno nuovo.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </main>
    );
  }

  const e = info.evento;
  return (
    <main className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{e?.nome ?? "Campo"}</h1>
          <p className="text-sm text-muted-foreground">
            {[
              info.club_provenienza,
              e?.luogo,
              e?.data_inizio ? `${format_data_completa(e.data_inizio)}${e?.data_fine ? ` – ${format_data_completa(e.data_fine)}` : ""}` : null,
            ]
              .filter(Boolean)
              .join(" • ")}
          </p>
          {e?.descrizione && <p className="text-sm text-muted-foreground">{e.descrizione}</p>}
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Elenco atleti</CardTitle>
            <CardDescription>
              Carica il file Excel con i tuoi atleti oppure inseriscili a mano. Atleti già registrati:{" "}
              {info.atleti_registrati}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {info.gruppi.length > 0 && (
              <div className="space-y-1.5 max-w-sm">
                <Label>Gruppo</Label>
                <Select value={gruppo_id} onValueChange={set_gruppo_id}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {info.gruppi.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <OspitiImportWizard on_submit={registra} consenti_manuale />
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default CampoOspitePubblicoPage;
