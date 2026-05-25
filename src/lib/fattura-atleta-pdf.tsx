import React from "react";
import { Document, Page, View, Text, StyleSheet, pdf } from "@react-pdf/renderer";

export type FatturaAtletaRiga = {
  descrizione: string;
  quantita?: number;
  prezzo_unitario?: number;
  importo: number;
};

export type FatturaAtletaData = {
  numero: string;
  periodo?: string;
  data_emissione: string;
  data_scadenza?: string | null;
  righe: FatturaAtletaRiga[];
  subtotale: number;
  sconto_importo: number;
  sconto_causale?: string | null;
  sconto_note?: string | null;
  totale: number;
  note?: string | null;
  intestatario: {
    nome?: string | null;
    cognome?: string | null;
    indirizzo?: string | null;
    cap?: string | null;
    citta?: string | null;
    cantone?: string | null;
    email?: string | null;
  };
  atleta: {
    nome: string;
    cognome: string;
    codice?: string | null;
    livello?: string | null;
  };
  club: {
    nome: string;
    logo_url?: string | null;
    indirizzo?: string | null;
    cap?: string | null;
    citta?: string | null;
    cantone?: string | null;
    email?: string | null;
    telefono?: string | null;
    partita_iva?: string | null;
    numero_iva_chf?: string | null;
    iban?: string | null;
    intestatario_iban?: string | null;
    twint_qr_url?: string | null;
  };
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  mittente: { fontSize: 9, lineHeight: 1.4 },
  mittenteName: { fontSize: 13, fontWeight: 700, marginBottom: 4, color: "#1e3a8a" },
  invoiceMeta: { textAlign: "right" },
  invoiceTitle: { fontSize: 22, fontWeight: 700, color: "#1e3a8a", marginBottom: 6 },
  small: { fontSize: 9, color: "#475569" },
  twoCols: { flexDirection: "row", gap: 20, marginBottom: 18 },
  col: { flex: 1 },
  blockLabel: { fontSize: 8, color: "#64748b", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  destName: { fontSize: 11, fontWeight: 700 },
  table: { marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#cbd5e1" },
  tHead: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 6, paddingHorizontal: 8 },
  tRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 0.5, borderColor: "#e2e8f0" },
  colDesc: { flex: 1 },
  colQty: { width: 40, textAlign: "right" },
  colPrice: { width: 70, textAlign: "right" },
  colAmt: { width: 80, textAlign: "right" },
  bold: { fontWeight: 700 },
  totRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  totLbl: { width: 140, textAlign: "right", paddingRight: 8 },
  totVal: { width: 90, textAlign: "right" },
  totaleFinale: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: "#cbd5e1" },
  totaleFinaleLbl: { width: 140, textAlign: "right", paddingRight: 8, fontWeight: 700, fontSize: 12 },
  totaleFinaleVal: { width: 90, textAlign: "right", fontSize: 14, fontWeight: 700, color: "#1e3a8a" },
  paySection: { marginTop: 22, padding: 12, backgroundColor: "#f8fafc", borderRadius: 4 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#94a3b8", borderTopWidth: 0.5, borderColor: "#e2e8f0", paddingTop: 6 },
});

export const FatturaAtletaDocument: React.FC<{ data: FatturaAtletaData }> = ({ data }) => {
  const intest = data.intestatario;
  const indirizzo_dest = [
    intest.indirizzo,
    [intest.cap, intest.citta].filter(Boolean).join(" "),
    intest.cantone,
  ].filter(Boolean) as string[];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.mittente}>
            <Text style={s.mittenteName}>{data.club.nome}</Text>
            {data.club.indirizzo ? <Text>{data.club.indirizzo}</Text> : null}
            {(data.club.cap || data.club.citta) ? <Text>{[data.club.cap, data.club.citta].filter(Boolean).join(" ")}</Text> : null}
            {data.club.cantone ? <Text>{data.club.cantone}</Text> : null}
            {data.club.email ? <Text>{data.club.email}</Text> : null}
            {data.club.telefono ? <Text>{data.club.telefono}</Text> : null}
            {data.club.partita_iva ? <Text>P.IVA: {data.club.partita_iva}</Text> : null}
            {data.club.numero_iva_chf ? <Text>IVA: {data.club.numero_iva_chf}</Text> : null}
          </View>
          <View style={s.invoiceMeta}>
            <Text style={s.invoiceTitle}>FATTURA</Text>
            <Text style={s.small}>N. {data.numero}</Text>
            {data.periodo ? <Text style={s.small}>Periodo: {data.periodo}</Text> : null}
            <Text style={s.small}>Emissione: {data.data_emissione}</Text>
            {data.data_scadenza ? <Text style={s.small}>Scadenza: {data.data_scadenza}</Text> : null}
          </View>
        </View>

        <View style={s.twoCols}>
          <View style={s.col}>
            <Text style={s.blockLabel}>Intestatario</Text>
            <Text style={s.destName}>{[intest.nome, intest.cognome].filter(Boolean).join(" ") || "—"}</Text>
            {indirizzo_dest.map((l, i) => <Text key={i}>{l}</Text>)}
            {intest.email ? <Text style={s.small}>{intest.email}</Text> : null}
          </View>
          <View style={s.col}>
            <Text style={s.blockLabel}>Atleta</Text>
            <Text style={s.destName}>{data.atleta.nome} {data.atleta.cognome}</Text>
            {data.atleta.codice ? <Text style={s.small}>Codice: {data.atleta.codice}</Text> : null}
            {data.atleta.livello ? <Text style={s.small}>Livello: {data.atleta.livello}</Text> : null}
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tHead}>
            <Text style={[s.colDesc, s.bold]}>Descrizione</Text>
            <Text style={[s.colQty, s.bold]}>Qta</Text>
            <Text style={[s.colPrice, s.bold]}>Prezzo</Text>
            <Text style={[s.colAmt, s.bold]}>Importo</Text>
          </View>
          {data.righe.map((r, i) => (
            <View key={i} style={s.tRow}>
              <Text style={s.colDesc}>{r.descrizione}</Text>
              <Text style={s.colQty}>{r.quantita ?? 1}</Text>
              <Text style={s.colPrice}>{(r.prezzo_unitario ?? r.importo).toFixed(2)}</Text>
              <Text style={s.colAmt}>{r.importo.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totRow}>
          <Text style={s.totLbl}>Subtotale CHF</Text>
          <Text style={s.totVal}>{data.subtotale.toFixed(2)}</Text>
        </View>
        {data.sconto_importo > 0 && (
          <View style={s.totRow}>
            <Text style={s.totLbl}>Sconto {data.sconto_causale ? `(${data.sconto_causale})` : ""}</Text>
            <Text style={s.totVal}>-{data.sconto_importo.toFixed(2)}</Text>
          </View>
        )}
        <View style={s.totaleFinale}>
          <Text style={s.totaleFinaleLbl}>TOTALE CHF</Text>
          <Text style={s.totaleFinaleVal}>{data.totale.toFixed(2)}</Text>
        </View>

        <View style={s.paySection}>
          <Text style={s.blockLabel}>Riferimento pagamento</Text>
          {data.club.iban ? <Text>IBAN: {data.club.iban}</Text> : <Text>IBAN non configurato</Text>}
          {data.club.intestatario_iban ? <Text>Intestatario: {data.club.intestatario_iban}</Text> : null}
          <Text>Causale: Fattura {data.numero}{data.periodo ? ` – ${data.periodo}` : ""}</Text>
          {data.data_scadenza ? <Text style={{ marginTop: 4 }}>Scadenza: {data.data_scadenza}</Text> : null}
          {data.club.twint_qr_url ? <Text style={{ marginTop: 4 }}>Twint disponibile</Text> : null}
        </View>

        {(data.note || data.sconto_note) ? (
          <View style={{ marginTop: 14 }}>
            <Text style={s.blockLabel}>Note</Text>
            {data.sconto_note ? <Text>{data.sconto_note}</Text> : null}
            {data.note ? <Text>{data.note}</Text> : null}
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          {data.club.nome}{data.club.partita_iva ? ` · P.IVA ${data.club.partita_iva}` : ""}{data.club.email ? ` · ${data.club.email}` : ""}
        </Text>
      </Page>
    </Document>
  );
};

export async function genera_fattura_atleta_blob(data: FatturaAtletaData): Promise<Blob> {
  return await pdf(<FatturaAtletaDocument data={data} />).toBlob();
}
