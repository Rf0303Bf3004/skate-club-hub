import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  use_fatture,
  use_atleti,
  use_setup_club,
  use_club,
  get_atleta_name_from_list,
} from "@/hooks/use-supabase-data";
import {
  use_segna_fattura_pagata,
  use_genera_fatture_mensili,
  use_elimina_fattura,
} from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Check, Trash2, ArrowLeft, QrCode, X } from "lucide-react";
import { toast } from "sonner";

// ─── QR Swiss Generator ────────────────────────────────────────────────────────
// Genera il payload Swiss QR Code secondo standard ISO 20022
function genera_swiss_qr_payload(params: {
  iban: string;
  intestatario: string;
  indirizzo: string;
  citta: string;
  paese: string;
  importo: number;
  descrizione: string;
  numero_fattura: string;
}): string {
  const { iban, intestatario, indirizzo, citta, paese, importo, descrizione, numero_fattura } = params;
  const importo_str = importo.toFixed(2);
  // Swiss QR payload format
  const lines = [
    "SPC", // QR Type
    "0200", // Version
    "1", // Coding
    iban.replace(/\s/g, ""), // IBAN
    "S", // Creditor address type
    intestatario, // Creditor name
    indirizzo, // Creditor street
    citta, // Creditor city
    paese, // Creditor country
    "", // Ultimate creditor (empty)
    "",
    "",
    "",
    "",
    importo_str, // Amount
    "CHF", // Currency
    "S", // Debtor address type (empty = unknown)
    "", // Debtor name
    "", // Debtor street
    "", // Debtor city
    "", // Debtor country
    "NON", // Reference type (NON = no reference)
    "", // Reference
    descrizione.slice(0, 140), // Unstructured message
    "EPD", // Trailer
    numero_fattura, // Alternative procedure
  ];
  return lines.join("\n");
}

// Componente QR Code usando API pubblica
const SwissQRCode: React.FC<{ payload: string; size?: number }> = ({ payload, size = 200 }) => {
  const encoded = encodeURIComponent(payload);
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&ecc=M`;
  return (
    <div className="flex flex-col items-center gap-2">
      <img src={url} alt="QR Swiss" width={size} height={size} className="rounded-lg border border-border" />
      <p className="text-[10px] text-muted-foreground text-center">Swiss QR Code</p>
    </div>
  );
};

// ─── Modal dettaglio fattura ───────────────────────────────────────────────────
const FatturaModal: React.FC<{
  fattura: any;
  atleta_nome: string;
  setup: any;
  club: any;
  on_close: () => void;
  on_paga: () => void;
  on_elimina: () => void;
  paying: boolean;
  deleting: boolean;
}> = ({ fattura, atleta_nome, setup, club, on_close, on_paga, on_elimina, paying, deleting }) => {
  const [show_qr, set_show_qr] = useState(false);
  const [confirm_delete, set_confirm_delete] = useState(false);

  const has_iban = !!setup?.iban;

  const qr_payload = has_iban
    ? genera_swiss_qr_payload({
        iban: setup.iban,
        intestatario: setup.intestatario_conto || club?.nome || "",
        indirizzo: setup.indirizzo_banca?.split(",")[0] || "",
        citta: setup.indirizzo_banca?.split(",")[1]?.trim() || "",
        paese: club?.paese || "CH",
        importo: fattura.importo,
        descrizione: fattura.descrizione || "",
        numero_fattura: fattura.numero,
      })
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">{fattura.numero}</h2>
            <p className="text-xs text-muted-foreground">{atleta_nome}</p>
          </div>
          <button onClick={on_close} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Stato */}
          <div className="flex items-center justify-between">
            <Badge variant={fattura.stato === "pagata" ? "default" : "destructive"} className="text-sm px-3 py-1">
              {fattura.stato === "pagata" ? "✅ Pagata" : "⏳ Da pagare"}
            </Badge>
            {fattura.stato === "pagata" && fattura.data_pagamento && (
              <span className="text-xs text-muted-foreground">
                Pagata il {new Date(fattura.data_pagamento).toLocaleDateString("it-CH")}
              </span>
            )}
          </div>

          {/* Dettagli */}
          <div className="bg-muted/30 rounded-xl px-4 py-4 space-y-3">
            <Row label="Descrizione" value={fattura.descrizione || "—"} />
            <Row label="Importo" value={`CHF ${Number(fattura.importo).toFixed(2)}`} bold />
            <Row
              label="Scadenza"
              value={fattura.scadenza ? new Date(fattura.scadenza).toLocaleDateString("it-CH") : "—"}
            />
            <Row
              label="Data emissione"
              value={fattura.data_emissione ? new Date(fattura.data_emissione).toLocaleDateString("it-CH") : "—"}
            />
            <Row label="Tipo" value={fattura.tipo || "—"} />
          </div>

          {/* Dati bancari */}
          {has_iban && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-xs font-bold text-primary uppercase tracking-wide">Dati per il pagamento</p>
              <p className="text-sm font-mono text-foreground">{setup.iban}</p>
              <p className="text-xs text-muted-foreground">{setup.intestatario_conto}</p>
              {setup.banca && <p className="text-xs text-muted-foreground">{setup.banca}</p>}
              <p className="text-xs text-muted-foreground font-medium">Causale: {fattura.numero}</p>
            </div>
          )}

          {/* QR Swiss */}
          {has_iban && (
            <div>
              {show_qr ? (
                <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-border">
                  <SwissQRCode payload={qr_payload} size={220} />
                  <p className="text-xs text-muted-foreground text-center">
                    Scansiona con l'app della tua banca svizzera
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => set_show_qr(false)} className="text-xs">
                    Nascondi QR
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => set_show_qr(true)} className="w-full gap-2">
                  <QrCode className="w-4 h-4" />
                  Mostra QR Swiss per pagamento
                </Button>
              )}
            </div>
          )}

          {!has_iban && (
            <p className="text-xs text-muted-foreground italic text-center">
              Configura IBAN in <span className="font-medium">Configurazione Club</span> per abilitare il QR Swiss.
            </p>
          )}
        </div>

        {/* Footer azioni */}
        <div className="px-6 py-4 border-t border-border space-y-2">
          {fattura.stato !== "pagata" && (
            <Button onClick={on_paga} disabled={paying} className="w-full bg-success hover:bg-success/90 text-white">
              {paying ? "..." : "✅ Segna come pagata"}
            </Button>
          )}

          {confirm_delete ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => set_confirm_delete(false)} className="flex-1">
                Annulla
              </Button>
              <Button variant="destructive" size="sm" onClick={on_elimina} disabled={deleting} className="flex-1">
                {deleting ? "..." : "🗑️ Elimina definitivamente"}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set_confirm_delete(true)}
              className="w-full text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Elimina fattura
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div className="flex justify-between items-start gap-2">
    <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
    <span className={`text-sm text-right ${bold ? "font-bold text-foreground" : "text-foreground"}`}>{value}</span>
  </div>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
const InvoicesPage: React.FC = () => {
  const { t } = useI18n();
  const { data: fatture = [], isLoading } = use_fatture();
  const { data: atleti = [] } = use_atleti();
  const { data: setup } = use_setup_club();
  const { data: club } = use_club();
  const segna_pagata = use_segna_fattura_pagata();
  const genera = use_genera_fatture_mensili();
  const elimina = use_elimina_fattura();
  const [status_filter, set_status_filter] = useState("tutti");
  const [selected_fattura, set_selected_fattura] = useState<any>(null);

  const filtered = fatture.filter((f: any) => status_filter === "tutti" || f.stato === status_filter);

  const handle_genera = async () => {
    const count = await genera.mutateAsync();
    toast.success(`${count} fatture generate`);
  };

  const handle_paga = async () => {
    if (!selected_fattura) return;
    await segna_pagata.mutateAsync(selected_fattura.id);
    set_selected_fattura(null);
    toast.success("Fattura segnata come pagata");
  };

  const handle_elimina = async () => {
    if (!selected_fattura) return;
    try {
      await elimina.mutateAsync(selected_fattura.id);
      set_selected_fattura(null);
      toast.success("Fattura eliminata");
    } catch (err: any) {
      toast.error(err?.message || "Errore eliminazione");
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <>
      {selected_fattura && (
        <FatturaModal
          fattura={selected_fattura}
          atleta_nome={get_atleta_name_from_list(atleti, selected_fattura.atleta_id)}
          setup={setup}
          club={club}
          on_close={() => set_selected_fattura(null)}
          on_paga={handle_paga}
          on_elimina={handle_elimina}
          paying={segna_pagata.isPending}
          deleting={elimina.isPending}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("fatture")}</h1>
          <Button className="bg-primary hover:bg-primary/90" onClick={handle_genera} disabled={genera.isPending}>
            <FileText className="w-4 h-4 mr-2" /> {genera.isPending ? "..." : t("genera_fatture")}
          </Button>
        </div>

        <Select value={status_filter} onValueChange={set_status_filter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("stato")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">{t("tutti")}</SelectItem>
            <SelectItem value="pagata">{t("pagata")}</SelectItem>
            <SelectItem value="da_pagare">{t("da_pagare")}</SelectItem>
          </SelectContent>
        </Select>

        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("numero_fattura")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("nome")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    {t("descrizione")}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("importo")}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    {t("scadenza")}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {t("stato")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Nessuna fattura trovata.
                    </td>
                  </tr>
                ) : (
                  filtered.map((f: any) => (
                    <tr
                      key={f.id}
                      onClick={() => set_selected_fattura(f)}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium tabular-nums text-foreground">{f.numero}</td>
                      <td className="px-4 py-3 text-foreground">{get_atleta_name_from_list(atleti, f.atleta_id)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                        {f.descrizione}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                        CHF {Number(f.importo).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                        {f.scadenza ? new Date(f.scadenza).toLocaleDateString("it-CH") : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={f.stato === "pagata" ? "default" : "destructive"} className="text-xs">
                          {t(f.stato)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoicesPage;
