import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { KpiPitchRow } from "@/lib/kpiPitch";
import { kpi_visibili } from "@/lib/kpiPitch";

export interface PacchettoSponsor {
  id: string;
  livello: string;
  nome_visualizzato: string;
  prezzo_annuo: number;
  ordine: number;
  colore_brand: string;
  benefits: string[];
  max_sponsor_disponibili: number | null;
  attivo: boolean;
  posti_occupati?: number;
}

export interface PitchOverrides {
  intro?: string;
  storia?: string;
  audience?: string;
  call_to_action?: string;
  contatti?: string;
}

export interface ClubInfo {
  nome: string;
  logo_url?: string | null;
  colore_primario?: string | null;
  citta?: string | null;
  sito_web?: string | null;
  email?: string | null;
}

export interface ClubIdentity {
  anno_fondazione?: number | null;
  federazione?: string | null;
  mission?: string | null;
  social_instagram?: string | null;
  social_facebook?: string | null;
  email_contatto?: string | null;
}

export interface PitchData {
  club: ClubInfo;
  identity: ClubIdentity | null;
  kpi: KpiPitchRow | null;
  pacchetti: PacchettoSponsor[];
  categorie_target: string[];
  overrides: PitchOverrides;
  anno_stagione: number;
}

export function format_chf(n: number): string {
  const f = new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
  return Number.isInteger(n) ? `CHF ${f}.–` : `CHF ${f}`;
}

const DEFAULT_TEXTS: Required<PitchOverrides> = {
  intro:
    "Siamo orgogliosi di presentarvi i nostri programmi sportivi e l'opportunità di diventare partner ufficiale del nostro club per la prossima stagione.",
  storia:
    "Il nostro club è una realtà sportiva radicata nel territorio, impegnata a promuovere il pattinaggio su ghiaccio a tutti i livelli, dalle prime esperienze sui pattini fino all'agonismo.",
  audience:
    "Coinvolgiamo atleti, famiglie e appassionati che frequentano la pista durante l'intera stagione: una community attiva sui social e presente alle competizioni nazionali e internazionali.",
  call_to_action:
    "Sostenerci significa contribuire allo sviluppo dei giovani atleti del territorio e ottenere visibilità presso un pubblico fidelizzato. Contattaci per discutere insieme la formula più adatta.",
  contatti:
    "Per informazioni e per attivare una collaborazione scrivici o telefonaci: saremo felici di incontrarti.",
};

function text_or_default(key: keyof PitchOverrides, ov: PitchOverrides): string {
  const v = (ov[key] ?? "").trim();
  return v.length > 0 ? v : DEFAULT_TEXTS[key];
}

const make_styles = (primary: string) =>
  StyleSheet.create({
    page: { padding: 40, fontSize: 11, color: "#1f2937", fontFamily: "Helvetica" },
    coverPage: { padding: 0, color: "#fff", fontFamily: "Helvetica" },
    coverHero: { backgroundColor: primary, padding: 60, height: "100%", justifyContent: "center" },
    coverLogo: { width: 110, height: 110, marginBottom: 24, objectFit: "contain" },
    coverTitle: { fontSize: 36, fontWeight: 700, marginBottom: 12 },
    coverSubtitle: { fontSize: 18, opacity: 0.9, marginBottom: 40 },
    coverMeta: { fontSize: 12, opacity: 0.85 },
    h1: { fontSize: 22, fontWeight: 700, color: primary, marginBottom: 14 },
    h2: { fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 14, marginBottom: 6 },
    bar: { height: 4, width: 50, backgroundColor: primary, marginBottom: 18 },
    p: { fontSize: 11, lineHeight: 1.55, marginBottom: 8 },
    kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
    kpiBox: {
      width: "48%",
      marginRight: "2%",
      marginBottom: 12,
      padding: 14,
      borderRadius: 6,
      backgroundColor: "#f3f4f6",
    },
    kpiValue: { fontSize: 22, fontWeight: 700, color: primary },
    kpiLabel: { fontSize: 10, color: "#4b5563", marginTop: 4 },
    cardsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
    card: {
      width: "31%",
      marginRight: "2.33%",
      marginBottom: 14,
      padding: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#e5e7eb",
      backgroundColor: "#ffffff",
    },
    cardBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      fontSize: 9,
      fontWeight: 700,
      color: "#fff",
      marginBottom: 8,
    },
    cardTitle: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
    cardPrice: { fontSize: 18, fontWeight: 700, color: primary, marginBottom: 8 },
    benefit: { fontSize: 9.5, marginBottom: 3, lineHeight: 1.4 },
    posti: { fontSize: 8.5, color: "#6b7280", marginTop: 6, fontStyle: "italic" },
    footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 8, color: "#9ca3af", textAlign: "center" },
    tag: {
      backgroundColor: "#eef2ff",
      color: "#3730a3",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      fontSize: 9,
      marginRight: 6,
      marginBottom: 6,
    },
    tagsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
    contactLine: { fontSize: 11, marginBottom: 6 },
  });

export const PitchDocument: React.FC<{ data: PitchData }> = ({ data }) => {
  const primary = data.club.colore_primario || "#3B82F6";
  const styles = make_styles(primary);
  const kpis = kpi_visibili(data.kpi);
  const anno = data.anno_stagione;

  return (
    <Document>
      {/* Pag 1 — Copertina */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverHero}>
          {data.club.logo_url ? <Image src={data.club.logo_url} style={styles.coverLogo} /> : null}
          <Text style={styles.coverTitle}>{data.club.nome}</Text>
          <Text style={styles.coverSubtitle}>Diventa nostro Sponsor {anno}/{anno + 1}</Text>
          <Text style={styles.coverMeta}>
            {[data.club.citta, data.club.sito_web].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </Page>

      {/* Pag 2 — Chi siamo */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Chi siamo</Text>
        <View style={styles.bar} />
        <Text style={styles.p}>{text_or_default("intro", data.overrides)}</Text>
        {(data.identity?.anno_fondazione || data.identity?.federazione) && (
          <Text style={styles.p}>
            {data.identity?.anno_fondazione ? `Fondato nel ${data.identity.anno_fondazione}. ` : ""}
            {data.identity?.federazione ? `Affiliato a ${data.identity.federazione}.` : ""}
          </Text>
        )}
        <Text style={styles.h2}>La nostra storia</Text>
        <Text style={styles.p}>{text_or_default("storia", data.overrides)}</Text>
        {data.identity?.mission ? (
          <>
            <Text style={styles.h2}>Mission</Text>
            <Text style={styles.p}>{data.identity.mission}</Text>
          </>
        ) : null}
        <Text style={styles.footer}>{data.club.nome} — Pitch Sponsor {anno}/{anno + 1}</Text>
      </Page>

      {/* Pag 3 — I numeri */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>I numeri del club</Text>
        <View style={styles.bar} />
        {kpis.length === 0 ? (
          <Text style={styles.p}>I dati operativi saranno disponibili a breve.</Text>
        ) : (
          <View style={styles.kpiGrid}>
            {kpis.map((k, i) => (
              <View key={i} style={styles.kpiBox}>
                <Text style={styles.kpiValue}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.footer}>{data.club.nome} — Pitch Sponsor {anno}/{anno + 1}</Text>
      </Page>

      {/* Pag 4 — Audience */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>La nostra audience</Text>
        <View style={styles.bar} />
        <Text style={styles.p}>{text_or_default("audience", data.overrides)}</Text>
        {data.categorie_target.length > 0 && (
          <>
            <Text style={styles.h2}>Settori sponsor di nostro interesse</Text>
            <View style={styles.tagsRow}>
              {data.categorie_target.map((c, i) => (
                <Text key={i} style={styles.tag}>{c}</Text>
              ))}
            </View>
          </>
        )}
        <Text style={styles.footer}>{data.club.nome} — Pitch Sponsor {anno}/{anno + 1}</Text>
      </Page>

      {/* Pag 5 — Pacchetti */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>I pacchetti sponsor</Text>
        <View style={styles.bar} />
        <View style={styles.cardsRow}>
          {data.pacchetti.filter((p) => p.attivo).map((p) => {
            const occupati = p.posti_occupati ?? 0;
            const max = p.max_sponsor_disponibili;
            const rimanenti = max != null ? Math.max(0, max - occupati) : null;
            return (
              <View key={p.id} style={styles.card}>
                <Text style={[styles.cardBadge, { backgroundColor: p.colore_brand }]}>
                  {p.livello.toUpperCase()}
                </Text>
                <Text style={styles.cardTitle}>{p.nome_visualizzato}</Text>
                <Text style={styles.cardPrice}>{format_chf(Number(p.prezzo_annuo))}/anno</Text>
                {p.benefits.map((b, i) => (
                  <Text key={i} style={styles.benefit}>• {b}</Text>
                ))}
                {rimanenti != null && (
                  <Text style={styles.posti}>
                    {rimanenti > 0 ? `${rimanenti} ${rimanenti === 1 ? "posto disponibile" : "posti disponibili"}` : "Sold out — chiedici la lista d'attesa"}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        <Text style={styles.footer}>{data.club.nome} — Pitch Sponsor {anno}/{anno + 1}</Text>
      </Page>

      {/* Pag 6 — CTA + contatti */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Diventa nostro partner</Text>
        <View style={styles.bar} />
        <Text style={styles.p}>{text_or_default("call_to_action", data.overrides)}</Text>
        <Text style={styles.h2}>Contatti</Text>
        <Text style={styles.p}>{text_or_default("contatti", data.overrides)}</Text>
        {data.identity?.email_contatto ? (
          <Text style={styles.contactLine}>Email: {data.identity.email_contatto}</Text>
        ) : data.club.email ? (
          <Text style={styles.contactLine}>Email: {data.club.email}</Text>
        ) : null}
        {data.club.sito_web ? <Text style={styles.contactLine}>Web: {data.club.sito_web}</Text> : null}
        {data.identity?.social_instagram ? (
          <Text style={styles.contactLine}>Instagram: {data.identity.social_instagram}</Text>
        ) : null}
        {data.identity?.social_facebook ? (
          <Text style={styles.contactLine}>Facebook: {data.identity.social_facebook}</Text>
        ) : null}
        <Text style={styles.footer}>{data.club.nome} — Pitch Sponsor {anno}/{anno + 1}</Text>
      </Page>
    </Document>
  );
};
