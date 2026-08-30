import React from "react";
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";

/** Conversione millimetri → punti (unità di react-pdf). */
const MM = 2.83465;

export type FatturaAtletaRiga = {
  descrizione: string;
  quantita?: number | null;
  prezzo_unitario?: number | null;
  importo: number;
  tipo?: string | null;
  voce?: string | null;
  periodo_da?: string | null;
  periodo_a?: string | null;
  giorni?: number | null;
  giorni_mese?: number | null;
};

export type FatturaQrData = {
  data_url: string | null;
  payload: string | null;
  tipo_riferimento: string | null;
  riferimento: string | null;
  errori: string | null;
};

export type FatturaAtletaData = {
  numero: string;
  periodo?: string;
  data_emissione: string;
  data_scadenza?: string | null;
  tipo_documento?: string | null;
  righe: FatturaAtletaRiga[];
  subtotale: number;
  sconto_importo: number;
  sconto_causale?: string | null;
  sconto_note?: string | null;
  totale: number;
  note?: string | null;
  qr?: FatturaQrData | null;
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
    fattura_mostra_logo?: boolean | null;
    fattura_colore_accento?: string | null;
    fattura_mostra_iban?: boolean | null;
    fattura_note_legali?: string | null;
    fattura_footer_testo?: string | null;
  };
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  mittente: { fontSize: 9, lineHeight: 1.4 },
  logo: { maxHeight: 50, height: 50, width: 100, objectFit: "contain", marginBottom: 6 },
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
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#94a3b8", borderTopWidth: 0.5, borderColor: "#e2e8f0", paddingTop: 6 },

  // Polizza QR svizzera
  qrBill: { marginTop: 22, flexDirection: "row", borderTopWidth: 0.75, borderColor: "#0f172a", paddingTop: 5 * MM },
  qrReceipt: { width: 62 * MM, paddingRight: 5 * MM, borderRightWidth: 0.75, borderColor: "#0f172a" },
  qrPayment: { flex: 1, paddingLeft: 5 * MM, flexDirection: "row" },
  qrTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  qrHead: { fontSize: 6, fontWeight: 700, marginTop: 6 },
  qrHeadBig: { fontSize: 8, fontWeight: 700, marginTop: 8 },
  qrTextSm: { fontSize: 8, lineHeight: 1.3 },
  qrText: { fontSize: 10, lineHeight: 1.3 },
  qrBox: { width: 46 * MM, height: 46 * MM, position: "relative", marginTop: 5 * MM, marginBottom: 5 * MM },
  qrImg: { width: 46 * MM, height: 46 * MM },
  crossOuter: {
    position: "absolute",
    width: 7 * MM,
    height: 7 * MM,
    left: 19.5 * MM,
    top: 19.5 * MM,
    backgroundColor: "#000000",
  },
  crossV: { position: "absolute", backgroundColor: "#ffffff", width: 1.4 * MM, height: 4.2 * MM, left: 2.8 * MM, top: 1.4 * MM },
  crossH: { position: "absolute", backgroundColor: "#ffffff", width: 4.2 * MM, height: 1.4 * MM, left: 1.4 * MM, top: 2.8 * MM },
  qrErrore: {
    marginTop: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    borderRadius: 4,
  },
});

function riga_indirizzo(nome: string, indirizzo?: string | null, cap?: string | null, citta?: string | null) {
  return [nome, indirizzo || null, [cap, citta].filter(Boolean).join(" ") || null].filter(Boolean) as string[];
}

/** Croce svizzera bianca su fondo nero, 7x7 mm, obbligatoria per la conformità. */
const CroceSvizzera: React.FC = () => (
  <View style={s.crossOuter}>
    <View style={s.crossV} />
    <View style={s.crossH} />
  </View>
);

const PolizzaQr: React.FC<{ data: FatturaAtletaData }> = ({ data }) => {
  const qr = data.qr;
  if (!qr || qr.errori || !qr.data_url) {
    return (
      <View style={s.qrErrore}>
        <Text style={[s.bold, { marginBottom: 4 }]}>Polizza QR non disponibile</Text>
        <Text style={s.qrTextSm}>
          {qr?.errori || "Dati di pagamento incompleti."} Completare i dati mancanti e ristampare la fattura.
        </Text>
      </View>
    );
  }

  const creditore = riga_indirizzo(
    data.club.intestatario_iban || data.club.nome,
    data.club.indirizzo,
    data.club.cap,
    data.club.citta,
  );
  const debitore = riga_indirizzo(
    [data.intestatario.nome, data.intestatario.cognome].filter(Boolean).join(" ") || "—",
    data.intestatario.indirizzo,
    data.intestatario.cap,
    data.intestatario.citta,
  );
  const importo = data.totale.toFixed(2);
  const iban = data.club.iban ?? "";

  return (
    <View style={s.qrBill} wrap={false}>
      {/* Sezione ricevuta */}
      <View style={s.qrReceipt}>
        <Text style={s.qrTitle}>Ricevuta</Text>
        <Text style={s.qrHead}>Conto / Pagabile a</Text>
        <Text style={s.qrTextSm}>{iban}</Text>
        {creditore.map((l, i) => <Text key={i} style={s.qrTextSm}>{l}</Text>)}
        {qr.riferimento ? (
          <>
            <Text style={s.qrHead}>Riferimento</Text>
            <Text style={s.qrTextSm}>{qr.riferimento}</Text>
          </>
        ) : null}
        <Text style={s.qrHead}>Pagabile da</Text>
        {debitore.map((l, i) => <Text key={i} style={s.qrTextSm}>{l}</Text>)}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
          <View>
            <Text style={s.qrHead}>Valuta</Text>
            <Text style={s.qrTextSm}>CHF</Text>
          </View>
          <View>
            <Text style={s.qrHead}>Importo</Text>
            <Text style={s.qrTextSm}>{importo}</Text>
          </View>
        </View>
        <Text style={[s.qrHead, { textAlign: "right", marginTop: 10 }]}>Punto di accettazione</Text>
      </View>

      {/* Sezione pagamento */}
      <View style={s.qrPayment}>
        <View style={{ width: 51 * MM }}>
          <Text style={s.qrTitle}>Sezione pagamento</Text>
          <View style={s.qrBox}>
            <Image src={qr.data_url} style={s.qrImg} />
            <CroceSvizzera />
          </View>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View>
              <Text style={s.qrHeadBig}>Valuta</Text>
              <Text style={s.qrText}>CHF</Text>
            </View>
            <View>
              <Text style={s.qrHeadBig}>Importo</Text>
              <Text style={s.qrText}>{importo}</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, paddingLeft: 5 * MM }}>
          <Text style={s.qrHeadBig}>Conto / Pagabile a</Text>
          <Text style={s.qrText}>{iban}</Text>
          {creditore.map((l, i) => <Text key={i} style={s.qrText}>{l}</Text>)}
          {qr.riferimento ? (
            <>
              <Text style={s.qrHeadBig}>Riferimento</Text>
              <Text style={s.qrText}>{qr.riferimento}</Text>
            </>
          ) : null}
          <Text style={s.qrHeadBig}>Informazioni supplementari</Text>
          <Text style={s.qrText}>Fattura {data.numero}{data.periodo ? ` – ${data.periodo}` : ""}</Text>
          <Text style={s.qrHeadBig}>Pagabile da</Text>
          {debitore.map((l, i) => <Text key={i} style={s.qrText}>{l}</Text>)}
        </View>
      </View>
    </View>
  );
};

export const FatturaAtletaDocument: React.FC<{ data: FatturaAtletaData }> = ({ data }) => {
  const intest = data.intestatario;
  const accento = data.club.fattura_colore_accento || null;
  const acc_style = accento ? { color: accento } : null;
  const mostra_logo = !!data.club.fattura_mostra_logo && !!data.club.logo_url;
  const is_nota = data.tipo_documento === "nota_credito";
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
            {mostra_logo ? <Image src={(data.club.logo_url as string).split("?")[0]} style={s.logo} /> : null}
            <Text style={[s.mittenteName, acc_style]}>{data.club.nome}</Text>
            {data.club.indirizzo ? <Text>{data.club.indirizzo}</Text> : null}
            {(data.club.cap || data.club.citta) ? <Text>{[data.club.cap, data.club.citta].filter(Boolean).join(" ")}</Text> : null}
            {data.club.cantone ? <Text>{data.club.cantone}</Text> : null}
            {data.club.email ? <Text>{data.club.email}</Text> : null}
            {data.club.telefono ? <Text>{data.club.telefono}</Text> : null}
            {data.club.partita_iva ? <Text>P.IVA: {data.club.partita_iva}</Text> : null}
            {data.club.numero_iva_chf ? <Text>IVA: {data.club.numero_iva_chf}</Text> : null}
          </View>
          <View style={s.invoiceMeta}>
            <Text style={[s.invoiceTitle, acc_style]}>{is_nota ? "NOTA DI CREDITO" : "FATTURA"}</Text>
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
              <Text style={s.colPrice}>{Number(r.prezzo_unitario ?? r.importo).toFixed(2)}</Text>
              <Text style={s.colAmt}>{Number(r.importo).toFixed(2)}</Text>
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
          <Text style={[s.totaleFinaleVal, acc_style]}>{data.totale.toFixed(2)}</Text>
        </View>

        {(data.note || data.sconto_note) ? (
          <View style={{ marginTop: 14 }}>
            <Text style={s.blockLabel}>Note</Text>
            {data.sconto_note ? <Text>{data.sconto_note}</Text> : null}
            {data.note ? <Text>{data.note}</Text> : null}
          </View>
        ) : null}

        {data.club.fattura_note_legali ? (
          <View style={{ marginTop: 14 }}>
            <Text style={s.blockLabel}>Note legali</Text>
            <Text>{data.club.fattura_note_legali}</Text>
          </View>
        ) : null}

        {is_nota ? null : <PolizzaQr data={data} />}

        <Text style={s.footer} fixed>
          {data.club.fattura_footer_testo
            ? data.club.fattura_footer_testo
            : `${data.club.nome}${data.club.partita_iva ? ` · P.IVA ${data.club.partita_iva}` : ""}${data.club.email ? ` · ${data.club.email}` : ""}`}
        </Text>
      </Page>
    </Document>
  );
};

export async function genera_fattura_atleta_blob(data: FatturaAtletaData): Promise<Blob> {
  return await pdf(<FatturaAtletaDocument data={data} />).toBlob();
}
