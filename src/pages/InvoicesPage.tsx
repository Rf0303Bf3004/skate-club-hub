import React, { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import {
  use_fatture,
  use_atleti,
  use_setup_club,
  use_club,
  use_corsi,
  use_lezioni_private,
  get_atleta_name_from_list,
} from "@/hooks/use-supabase-data";
import {
  use_segna_fattura_pagata,
  use_genera_fatture_mensili,
  use_elimina_fattura,
  use_invia_email_fattura,
} from "@/hooks/use-supabase-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Trash2, X, Printer, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { get_fattura_stato_ui, get_fattura_stato_label, get_fattura_stato_classes } from "@/lib/fattura-status";

// ─── Swiss QR ─────────────────────────────────────────────
function genera_swiss_qr_payload(params: {
  iban: string;
  intestatario: string;
  indirizzo: string;
  cap: string;
  citta: string;
  paese: string;
  importo: number;
  descrizione: string;
  numero_fattura: string;
}): string {
  const { iban, intestatario, indirizzo, cap, citta, paese, importo, descrizione, numero_fattura } = params;
  const lines = [
    "SPC",
    "0200",
    "1",
    iban.replace(/\s/g, ""),
    "S",
    intestatario,
    indirizzo,
    `${cap} ${citta}`.trim(),
    "",
    paese,
    "",
    "",
    "",
    "",
    "",
    importo.toFixed(2),
    "CHF",
    "S",
    "",
    "",
    "",
    "",
    "",
    "NON",
    "",
    descrizione.slice(0, 140),
    "EPD",
    numero_fattura,
  ];
  return lines.join("\n");
}

const SwissQRCode: React.FC<{ payload: string; size?: number }> = ({ payload, size = 180 }) => {
  const encoded = encodeURIComponent(payload);
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&ecc=H`;
  return <img src={url} alt="QR Swiss" width={size} height={size} className="rounded border border-gray-300" />;
};

// ─── Fattura stampabile ────────────────────────────────────
const FatturaStampabile: React.FC<{
  fattura: any;
  atleta: any;
  setup: any;
  club: any;
  corsi: any[];
  lezioni: any[];
}> = ({ fattura, atleta, setup, club, corsi, lezioni }) => {
  const has_iban = !!setup?.iban;
  const voci: { descrizione: string; importo: number }[] = [];

  // ← FIX: controlli tipo con valori corretti del DB
  if (fattura.tipo === "Corso") {
    const corso = corsi.find((c: any) => c.id === fattura.riferimento_id);
    if (corso) {
      voci.push({
        descrizione: `Quota mensile — ${corso.nome} (${corso.giorno} ${corso.ora_inizio?.slice(0, 5)})`,
        importo: fattura.importo,
      });
    } else {
      voci.push({ descrizione: fattura.descrizione || "Quota corso", importo: fattura.importo });
    }
  } else if (fattura.tipo === "Lezione Privata") {
    const lezioni_atleta = lezioni.filter((l: any) => l.atleti_ids?.includes(atleta?.id) && !l.annullata);
    if (lezioni_atleta.length > 0) {
      lezioni_atleta.slice(0, 10).forEach((l: any) => {
        const data = new Date(l.data + "T00:00:00").toLocaleDateString("it-CH", { day: "2-digit", month: "short" });
        const quota = l.costo_totale / (l.atleti_ids?.length || 1);
        voci.push({
          descrizione: `Lezione privata ${data} ${l.ora_inizio?.slice(0, 5)}–${l.ora_fine?.slice(0, 5)} (${l.durata_minuti || 20} min)`,
          importo: quota,
        });
      });
    } else {
      voci.push({ descrizione: fattura.descrizione || "Lezioni private", importo: fattura.importo });
    }
  } else {
    voci.push({ descrizione: fattura.descrizione || "Servizi", importo: fattura.importo });
  }

  const totale = voci.reduce((s, v) => s + v.importo, 0);

  const qr_payload = has_iban
    ? genera_swiss_qr_payload({
        iban: setup.iban,
        intestatario: setup.intestatario_conto || club?.nome || "",
        indirizzo: setup.indirizzo_intestatario || "",
        cap: setup.cap_intestatario || "",
        citta: setup.citta_intestatario || "",
        paese: club?.paese || "CH",
        importo: totale,
        descrizione: fattura.descrizione || "",
        numero_fattura: fattura.numero,
      })
    : "";

  const atleta_nome = atleta ? `${atleta.nome} ${atleta.cognome}` : "—";
  const colore = club?.colore_primario || "#3B82F6";

  return (
    <div
      id="fattura-print"
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: 13,
        color: "#111",
        background: "#fff",
        padding: 40,
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      {/* Header club */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {club?.logo_url && (
            <img
              src={club.logo_url}
              alt="logo"
              style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8 }}
            />
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colore }}>{club?.nome || "Club"}</div>
            {club?.indirizzo && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{club.indirizzo}</div>}
            {club?.citta && <div style={{ fontSize: 11, color: "#666" }}>{club.citta}</div>}
            {club?.email && <div style={{ fontSize: 11, color: "#666" }}>{club.email}</div>}
            {club?.telefono && <div style={{ fontSize: 11, color: "#666" }}>{club.telefono}</div>}
            {club?.sito_web && <div style={{ fontSize: 11, color: "#666" }}>{club.sito_web}</div>}
            {club?.numero_tessera_federale && (
              <div style={{ fontSize: 11, color: "#666" }}>N. Fed: {club.numero_tessera_federale}</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: colore, letterSpacing: -0.5 }}>FATTURA</div>
          <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>{fattura.numero}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
            Emessa il: {fattura.data_emissione ? new Date(fattura.data_emissione).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>
            Scadenza:{" "}
            {fattura.data_scadenza || fattura.scadenza
              ? new Date(fattura.data_scadenza || fattura.scadenza).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "—"}
          </div>
          <div style={{ marginTop: 6 }}>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: fattura.stato === "pagata" ? "#dcfce7" : "#fee2e2",
                color: fattura.stato === "pagata" ? "#16a34a" : "#dc2626",
              }}
            >
              {fattura.stato === "pagata" ? "✓ PAGATA" : "DA PAGARE"}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${colore}, transparent)`,
          marginBottom: 24,
          borderRadius: 2,
        }}
      />

      {/* Destinatario */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          Fatturato a
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{atleta_nome}</div>
        {atleta?.genitore1_nome && (
          <div style={{ fontSize: 12, color: "#555" }}>
            {atleta.genitore1_nome} {atleta.genitore1_cognome}
          </div>
        )}
        {atleta?.genitore1_email && <div style={{ fontSize: 11, color: "#888" }}>{atleta.genitore1_email}</div>}
      </div>

      {/* Tabella voci */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ background: colore, color: "#fff" }}>
            <th
              style={{
                textAlign: "left",
                padding: "10px 14px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                borderRadius: "4px 0 0 4px",
              }}
            >
              Descrizione
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "10px 14px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                borderRadius: "0 4px 4px 0",
              }}
            >
              Importo CHF
            </th>
          </tr>
        </thead>
        <tbody>
          {voci.map((v, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#fff", borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "10px 14px", fontSize: 12 }}>{v.descrizione}</td>
              <td
                style={{ padding: "10px 14px", fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              >
                {v.importo.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f3f4f6", borderTop: "2px solid #e5e7eb" }}>
            <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13 }}>TOTALE</td>
            <td
              style={{
                padding: "12px 14px",
                fontWeight: 800,
                fontSize: 15,
                textAlign: "right",
                color: colore,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              CHF {totale.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Dati bancari + QR */}
      {has_iban && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            marginTop: 16,
            padding: 16,
            background: "#f0f9ff",
            borderRadius: 8,
            border: "1px solid #bae6fd",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#0369a1",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              Dati per il pagamento
            </div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#111", marginBottom: 4 }}>{setup.iban}</div>
            <div style={{ fontSize: 11, color: "#555" }}>{setup.intestatario_conto}</div>
            {setup.indirizzo_intestatario && (
              <div style={{ fontSize: 11, color: "#555" }}>{setup.indirizzo_intestatario}</div>
            )}
            {(setup.cap_intestatario || setup.citta_intestatario) && (
              <div style={{ fontSize: 11, color: "#555" }}>
                {setup.cap_intestatario} {setup.citta_intestatario}
              </div>
            )}
            {setup.banca && <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{setup.banca}</div>}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", marginTop: 8 }}>
              Causale: {fattura.numero}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <SwissQRCode payload={qr_payload} size={120} />
            <div style={{ fontSize: 9, color: "#888", marginTop: 4 }}>Swiss QR Code</div>
          </div>
        </div>
      )}

      {/* TWINT payment link */}
      {has_iban && setup?.twint_paylink && (
        <div style={{ marginTop: 12, padding: 10, border: "2px solid #000", borderRadius: 8, textAlign: "center" }}>
          <img src="https://www.twint.ch/wp-content/uploads/2021/09/TWINT_Logo_RGB.png" height="30" alt="TWINT" style={{ display: "inline-block" }} />
          <p style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Paga con TWINT</p>
          <a
            href={`${setup.twint_paylink}?amount=${totale.toFixed(2)}&reference=${fattura.numero}`}
            style={{ fontSize: 12, color: "#0369a1", textDecoration: "underline", marginTop: 4, display: "inline-block" }}
          >
            Apri link TWINT
          </a>
        </div>
      )}

      {/* Missing IBAN banner */}
      {!has_iban && (
        <div style={{ marginTop: 16, padding: 12, background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
          ⚠️ Configura i dati bancari nelle impostazioni club per abilitare il QR Bill e i pagamenti TWINT.
        </div>
      )}

      {fattura.note && (
        <div style={{ marginTop: 20, fontSize: 11, color: "#666" }}>
          <strong>Note:</strong> {fattura.note}
        </div>
      )}

      <div
        style={{
          marginTop: 32,
          paddingTop: 12,
          borderTop: "1px solid #e5e7eb",
          fontSize: 10,
          color: "#aaa",
          textAlign: "center",
        }}
      >
        {club?.nome} — {club?.indirizzo} {club?.citta} — {club?.email}
      </div>
    </div>
  );
};

// ─── Modal fattura ─────────────────────────────────────────
const FatturaModal: React.FC<{
  fattura: any;
  atleta: any;
  setup: any;
  club: any;
  corsi: any[];
  lezioni: any[];
  on_close: () => void;
  on_paga: () => void;
  on_elimina: () => void;
  on_invia_email: () => void;
  paying: boolean;
  deleting: boolean;
  sending_email: boolean;
}> = ({ fattura, atleta, setup, club, corsi, lezioni, on_close, on_paga, on_elimina, on_invia_email, paying, deleting, sending_email }) => {
  const [confirm_delete, set_confirm_delete] = useState(false);
  const [show_anteprima, set_show_anteprima] = useState(false);
  const print_ref = useRef<HTMLDivElement>(null);

  const handle_stampa = () => {
    const content = document.getElementById("fattura-print");
    if (!content) return;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><title>${fattura.numero}</title><style>body{margin:0;padding:0;}</style></head><body>${content.outerHTML}</body></html>`,
    );
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  const atleta_nome = atleta ? `${atleta.nome} ${atleta.cognome}` : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">{fattura.numero}</h2>
            <p className="text-xs text-muted-foreground">{atleta_nome}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => set_show_anteprima((v) => !v)}
              className="gap-1.5 text-xs h-8"
            >
              <FileText className="w-3.5 h-3.5" />
              {show_anteprima ? "Nascondi" : "Anteprima"}
            </Button>
            {show_anteprima && (
              <Button size="sm" onClick={handle_stampa} className="gap-1.5 text-xs h-8 bg-primary hover:bg-primary/90">
                <Printer className="w-3.5 h-3.5" /> Stampa / PDF
              </Button>
            )}
            <button onClick={on_close} className="text-muted-foreground hover:text-foreground ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            {(() => {
              const s = get_fattura_stato_ui(fattura);
              const icon = s === "pagata" ? "✅" : s === "scaduta" ? "⚠️" : "⏳";
              return (
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${get_fattura_stato_classes(s)}`}>
                  {icon} {get_fattura_stato_label(s)}
                </span>
              );
            })()}
            {fattura.stato === "pagata" && fattura.data_pagamento && (
              <span className="text-xs text-muted-foreground">
                Pagata il {new Date(fattura.data_pagamento).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </span>
            )}
          </div>

          {show_anteprima && (
            <div className="border border-border rounded-xl overflow-hidden bg-white" ref={print_ref}>
              <FatturaStampabile
                fattura={fattura}
                atleta={atleta}
                setup={setup}
                club={club}
                corsi={corsi}
                lezioni={lezioni}
              />
            </div>
          )}

          {!show_anteprima && (
            <div className="bg-muted/30 rounded-xl px-4 py-4 space-y-3">
              {[
                { label: "Descrizione", value: fattura.descrizione || "—" },
                { label: "Importo", value: `CHF ${Number(fattura.importo).toFixed(2)}`, bold: true },
                {
                  label: "Emissione",
                  value: fattura.data_emissione ? new Date(fattura.data_emissione).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—",
                },
                {
                  label: "Scadenza",
                  value:
                    fattura.data_scadenza || fattura.scadenza
                      ? new Date(fattura.data_scadenza || fattura.scadenza).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
                      : "—",
                },
                { label: "Tipo", value: fattura.tipo || "—" },
              ].map(({ label, value, bold }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
                  <span className={`text-sm text-right ${bold ? "font-bold text-foreground" : "text-foreground"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border space-y-2 flex-shrink-0">
          {fattura.stato !== "pagata" && (
            <Button onClick={on_paga} disabled={paying} className="w-full bg-success hover:bg-success/90 text-white">
              {paying ? "..." : "✅ Segna come pagata"}
            </Button>
          )}
          {(() => {
            const email_destinatario =
              atleta?.genitore1_email || atleta?.genitore2_email || "";
            const ha_email = !!email_destinatario;
            const inviata = !!fattura.email_inviata_at;
            return (
              <Button
                variant="outline"
                onClick={on_invia_email}
                disabled={!ha_email || sending_email}
                className="w-full"
                title={ha_email ? `Invia a ${email_destinatario}` : "Nessuna email genitore configurata"}
              >
                <Mail className="w-4 h-4 mr-2" />
                {sending_email
                  ? "Invio..."
                  : inviata
                  ? `📧 Reinvia email (ultimo: ${new Date(fattura.email_inviata_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })})`
                  : ha_email
                  ? `Invia email a ${email_destinatario}`
                  : "Email non disponibile"}
              </Button>
            );
          })()}
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

// ─── Main Page ─────────────────────────────────────────────
const InvoicesPage: React.FC = () => {
  const { t } = useI18n();
  const { data: fatture = [], isLoading } = use_fatture();
  const { data: atleti = [] } = use_atleti();
  const { data: setup } = use_setup_club();
  const { data: club } = use_club();
  const { data: corsi = [] } = use_corsi();
  const { data: lezioni = [] } = use_lezioni_private();
  const segna_pagata = use_segna_fattura_pagata();
  const genera = use_genera_fatture_mensili();
  const elimina = use_elimina_fattura();
  const invia_email = use_invia_email_fattura();
  const [status_filter, set_status_filter] = useState("tutti");
  const [selected_fattura, set_selected_fattura] = useState<any>(null);

  const today_iso = new Date().toISOString().split("T")[0];
  const filtered = fatture.filter((f: any) => {
    if (status_filter === "tutti") return true;
    return get_fattura_stato_ui(f, today_iso) === status_filter;
  });

  const non_pagate = fatture.filter((f: any) => f.stato !== "pagata");
  const totale_da_pagare = non_pagate.reduce((s: number, f: any) => s + Number(f.importo), 0);
  const scadute_count = non_pagate.filter((f: any) => get_fattura_stato_ui(f, today_iso) === "scaduta").length;
  const in_arrivo_count = non_pagate.length - scadute_count;

  const handle_genera = async () => {
    try {
      const count = await genera.mutateAsync(undefined);
      toast({ title: `✅ ${count} fatture generate` });
    } catch (err: any) {
      toast({ title: "Errore generazione", description: err?.message, variant: "destructive" });
    }
  };

  const handle_paga = async () => {
    if (!selected_fattura) return;
    try {
      await segna_pagata.mutateAsync(selected_fattura.id);
      set_selected_fattura(null);
      toast({ title: "✅ Fattura segnata come pagata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  const handle_elimina = async () => {
    if (!selected_fattura) return;
    try {
      await elimina.mutateAsync(selected_fattura.id);
      set_selected_fattura(null);
      toast({ title: "🗑️ Fattura eliminata" });
    } catch (err: any) {
      toast({ title: "Errore eliminazione", description: err?.message, variant: "destructive" });
    }
  };

  const handle_invia_email = async () => {
    if (!selected_fattura) return;
    const atleta = atleti.find((a: any) => a.id === selected_fattura.atleta_id);
    const email = atleta?.genitore1_email || atleta?.genitore2_email || "";
    if (!email) {
      toast({ title: "Email non disponibile", description: "Configura email genitore", variant: "destructive" });
      return;
    }
    try {
      await invia_email.mutateAsync({ fattura_id: selected_fattura.id, email });
      toast({ title: `📧 Email registrata per ${email}` });
      set_selected_fattura((prev: any) => prev ? { ...prev, email_inviata_at: new Date().toISOString() } : prev);
    } catch (err: any) {
      toast({ title: "Errore invio email", description: err?.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const atleta_selected = selected_fattura ? atleti.find((a: any) => a.id === selected_fattura.atleta_id) : null;

  return (
    <>
      {selected_fattura && (
        <FatturaModal
          fattura={selected_fattura}
          atleta={atleta_selected}
          setup={setup}
          club={club}
          corsi={corsi}
          lezioni={lezioni}
          on_close={() => set_selected_fattura(null)}
          on_paga={handle_paga}
          on_elimina={handle_elimina}
          on_invia_email={handle_invia_email}
          paying={segna_pagata.isPending}
          deleting={elimina.isPending}
          sending_email={invia_email.isPending}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t("fatture")}</h1>
            {totale_da_pagare > 0 && (
              <p
                className="text-sm text-muted-foreground mt-0.5"
                title={`${scadute_count} scadute / ${in_arrivo_count} in arrivo`}
              >
                Da incassare: <span className="font-bold text-foreground">CHF {totale_da_pagare.toFixed(2)}</span>
                {scadute_count > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                    · {scadute_count} scadute
                  </span>
                )}
              </p>
            )}
          </div>
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
            <SelectItem value="scaduta">Scadute</SelectItem>
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
                        {f.data_scadenza || f.scadenza
                          ? new Date(f.data_scadenza || f.scadenza).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const s = get_fattura_stato_ui(f, today_iso);
                          return (
                            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${get_fattura_stato_classes(s)}`}>
                              {get_fattura_stato_label(s)}
                            </span>
                          );
                        })()}
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
