import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const MITTENTE = {
  ragione_sociale: "Ice Arena Manager Sagl",
  indirizzo: "Via Cantonale 1",
  cap_citta: "6500 Bellinzona (TI)",
  paese: "Svizzera",
  partita_iva: "CHE-XXX.XXX.XXX",
  iva: "CHE-XXX.XXX.XXX MWST",
  iban: "CH00 0000 0000 0000 0000 0",
  email: "fatture@icearena.ch",
};

export type FatturaRiga = { descrizione: string; importo: number };

export type FatturaClubData = {
  numero: string;
  periodo: string;
  data_emissione: string;
  data_scadenza: string;
  righe: FatturaRiga[];
  totale: number;
  note?: string;
  club: {
    nome: string;
    indirizzo?: string;
    cap?: string;
    citta?: string;
    cantone?: string;
    paese?: string;
    partita_iva?: string;
    numero_iva_chf?: string;
    iban?: string;
  };
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  mittente: { fontSize: 9, lineHeight: 1.4 },
  mittenteName: { fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#1e3a8a" },
  invoiceMeta: { textAlign: "right" },
  invoiceTitle: { fontSize: 22, fontWeight: 700, color: "#1e3a8a", marginBottom: 6 },
  small: { fontSize: 9, color: "#475569" },
  block: { marginBottom: 18 },
  blockLabel: { fontSize: 8, color: "#64748b", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  destName: { fontSize: 11, fontWeight: 700 },
  table: { marginTop: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#cbd5e1" },
  tHead: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 6, paddingHorizontal: 8 },
  tRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 0.5, borderColor: "#e2e8f0" },
  colDesc: { flex: 1 },
  colAmt: { width: 90, textAlign: "right" },
  bold: { fontWeight: 700 },
  totaleBox: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totaleLbl: { width: 130, textAlign: "right", paddingRight: 8, fontWeight: 700 },
  totaleVal: { width: 100, textAlign: "right", fontSize: 13, fontWeight: 700, color: "#1e3a8a" },
  paySection: { marginTop: 24, padding: 12, backgroundColor: "#f8fafc", borderRadius: 4 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#94a3b8", borderTopWidth: 0.5, borderColor: "#e2e8f0", paddingTop: 6 },
});

export const FatturaClubDocument: React.FC<{ data: FatturaClubData }> = ({ data }) => {
  const dest = data.club;
  const indirizzo_dest = [
    dest.indirizzo,
    [dest.cap, dest.citta].filter(Boolean).join(" "),
    [dest.cantone, dest.paese || "CH"].filter(Boolean).join(" – "),
  ].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.mittente}>
            <Text style={s.mittenteName}>{MITTENTE.ragione_sociale}</Text>
            <Text>{MITTENTE.indirizzo}</Text>
            <Text>{MITTENTE.cap_citta}</Text>
            <Text>{MITTENTE.paese}</Text>
            <Text>P.IVA: {MITTENTE.partita_iva}</Text>
            <Text>IVA: {MITTENTE.iva}</Text>
          </View>
          <View style={s.invoiceMeta}>
            <Text style={s.invoiceTitle}>FATTURA</Text>
            <Text style={s.small}>N. {data.numero}</Text>
            <Text style={s.small}>Periodo: {data.periodo}</Text>
            <Text style={s.small}>Emissione: {data.data_emissione}</Text>
            <Text style={s.small}>Scadenza: {data.data_scadenza}</Text>
          </View>
        </View>

        <View style={s.block}>
          <Text style={s.blockLabel}>Intestatario</Text>
          <Text style={s.destName}>{dest.nome}</Text>
          {indirizzo_dest.map((l, i) => <Text key={i}>{l}</Text>)}
          {dest.partita_iva ? <Text style={s.small}>P.IVA: {dest.partita_iva}</Text> : null}
          {dest.numero_iva_chf ? <Text style={s.small}>IVA: {dest.numero_iva_chf}</Text> : null}
        </View>

        <View style={s.table}>
          <View style={s.tHead}>
            <Text style={[s.colDesc, s.bold]}>Descrizione</Text>
            <Text style={[s.colAmt, s.bold]}>CHF</Text>
          </View>
          {data.righe.map((r, i) => (
            <View key={i} style={s.tRow}>
              <Text style={s.colDesc}>{r.descrizione}</Text>
              <Text style={s.colAmt}>{r.importo.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totaleBox}>
          <Text style={s.totaleLbl}>TOTALE CHF</Text>
          <Text style={s.totaleVal}>{data.totale.toFixed(2)}</Text>
        </View>

        <View style={s.paySection}>
          <Text style={s.blockLabel}>Riferimento pagamento</Text>
          <Text>Bonifico bancario — IBAN: {MITTENTE.iban}</Text>
          <Text>Intestatario: {MITTENTE.ragione_sociale}</Text>
          <Text>Causale: Fattura {data.numero} – {data.periodo}</Text>
          <Text style={{ marginTop: 4 }}>Scadenza: {data.data_scadenza}</Text>
        </View>

        {data.note ? (
          <View style={{ marginTop: 14 }}>
            <Text style={s.blockLabel}>Note</Text>
            <Text>{data.note}</Text>
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          {MITTENTE.ragione_sociale} · {MITTENTE.cap_citta} · {MITTENTE.email} · {MITTENTE.iva}
        </Text>
      </Page>
    </Document>
  );
};
