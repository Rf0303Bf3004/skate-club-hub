// Costanti e validatori multipaese (CH / IT)

export type paese_iso = "CH" | "IT";

export const PAESI: { code: paese_iso; label: string }[] = [
  { code: "CH", label: "Svizzera" },
  { code: "IT", label: "Italia" },
];

// 26 cantoni svizzeri (sigla, nome italiano)
export const CANTONI_CH: { sigla: string; nome: string }[] = [
  { sigla: "AG", nome: "Argovia" },
  { sigla: "AR", nome: "Appenzello Esterno" },
  { sigla: "AI", nome: "Appenzello Interno" },
  { sigla: "BL", nome: "Basilea Campagna" },
  { sigla: "BS", nome: "Basilea Città" },
  { sigla: "BE", nome: "Berna" },
  { sigla: "FR", nome: "Friburgo" },
  { sigla: "GE", nome: "Ginevra" },
  { sigla: "GL", nome: "Glarona" },
  { sigla: "GR", nome: "Grigioni" },
  { sigla: "JU", nome: "Giura" },
  { sigla: "LU", nome: "Lucerna" },
  { sigla: "NE", nome: "Neuchâtel" },
  { sigla: "NW", nome: "Nidvaldo" },
  { sigla: "OW", nome: "Obvaldo" },
  { sigla: "SG", nome: "San Gallo" },
  { sigla: "SH", nome: "Sciaffusa" },
  { sigla: "SO", nome: "Soletta" },
  { sigla: "SZ", nome: "Svitto" },
  { sigla: "TI", nome: "Ticino" },
  { sigla: "TG", nome: "Turgovia" },
  { sigla: "UR", nome: "Uri" },
  { sigla: "VS", nome: "Vallese" },
  { sigla: "VD", nome: "Vaud" },
  { sigla: "ZG", nome: "Zugo" },
  { sigla: "ZH", nome: "Zurigo" },
];

// 20 regioni italiane
export const REGIONI_IT: string[] = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia",
  "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

// 107 province italiane (sigla, nome, regione)
export const PROVINCE_IT: { sigla: string; nome: string; regione: string }[] = [
  // Abruzzo
  { sigla: "CH", nome: "Chieti", regione: "Abruzzo" },
  { sigla: "AQ", nome: "L'Aquila", regione: "Abruzzo" },
  { sigla: "PE", nome: "Pescara", regione: "Abruzzo" },
  { sigla: "TE", nome: "Teramo", regione: "Abruzzo" },
  // Basilicata
  { sigla: "MT", nome: "Matera", regione: "Basilicata" },
  { sigla: "PZ", nome: "Potenza", regione: "Basilicata" },
  // Calabria
  { sigla: "CZ", nome: "Catanzaro", regione: "Calabria" },
  { sigla: "CS", nome: "Cosenza", regione: "Calabria" },
  { sigla: "KR", nome: "Crotone", regione: "Calabria" },
  { sigla: "RC", nome: "Reggio Calabria", regione: "Calabria" },
  { sigla: "VV", nome: "Vibo Valentia", regione: "Calabria" },
  // Campania
  { sigla: "AV", nome: "Avellino", regione: "Campania" },
  { sigla: "BN", nome: "Benevento", regione: "Campania" },
  { sigla: "CE", nome: "Caserta", regione: "Campania" },
  { sigla: "NA", nome: "Napoli", regione: "Campania" },
  { sigla: "SA", nome: "Salerno", regione: "Campania" },
  // Emilia-Romagna
  { sigla: "BO", nome: "Bologna", regione: "Emilia-Romagna" },
  { sigla: "FE", nome: "Ferrara", regione: "Emilia-Romagna" },
  { sigla: "FC", nome: "Forlì-Cesena", regione: "Emilia-Romagna" },
  { sigla: "MO", nome: "Modena", regione: "Emilia-Romagna" },
  { sigla: "PR", nome: "Parma", regione: "Emilia-Romagna" },
  { sigla: "PC", nome: "Piacenza", regione: "Emilia-Romagna" },
  { sigla: "RA", nome: "Ravenna", regione: "Emilia-Romagna" },
  { sigla: "RE", nome: "Reggio Emilia", regione: "Emilia-Romagna" },
  { sigla: "RN", nome: "Rimini", regione: "Emilia-Romagna" },
  // Friuli-Venezia Giulia
  { sigla: "GO", nome: "Gorizia", regione: "Friuli-Venezia Giulia" },
  { sigla: "PN", nome: "Pordenone", regione: "Friuli-Venezia Giulia" },
  { sigla: "TS", nome: "Trieste", regione: "Friuli-Venezia Giulia" },
  { sigla: "UD", nome: "Udine", regione: "Friuli-Venezia Giulia" },
  // Lazio
  { sigla: "FR", nome: "Frosinone", regione: "Lazio" },
  { sigla: "LT", nome: "Latina", regione: "Lazio" },
  { sigla: "RI", nome: "Rieti", regione: "Lazio" },
  { sigla: "RM", nome: "Roma", regione: "Lazio" },
  { sigla: "VT", nome: "Viterbo", regione: "Lazio" },
  // Liguria
  { sigla: "GE", nome: "Genova", regione: "Liguria" },
  { sigla: "IM", nome: "Imperia", regione: "Liguria" },
  { sigla: "SP", nome: "La Spezia", regione: "Liguria" },
  { sigla: "SV", nome: "Savona", regione: "Liguria" },
  // Lombardia
  { sigla: "BG", nome: "Bergamo", regione: "Lombardia" },
  { sigla: "BS", nome: "Brescia", regione: "Lombardia" },
  { sigla: "CO", nome: "Como", regione: "Lombardia" },
  { sigla: "CR", nome: "Cremona", regione: "Lombardia" },
  { sigla: "LC", nome: "Lecco", regione: "Lombardia" },
  { sigla: "LO", nome: "Lodi", regione: "Lombardia" },
  { sigla: "MN", nome: "Mantova", regione: "Lombardia" },
  { sigla: "MI", nome: "Milano", regione: "Lombardia" },
  { sigla: "MB", nome: "Monza e Brianza", regione: "Lombardia" },
  { sigla: "PV", nome: "Pavia", regione: "Lombardia" },
  { sigla: "SO", nome: "Sondrio", regione: "Lombardia" },
  { sigla: "VA", nome: "Varese", regione: "Lombardia" },
  // Marche
  { sigla: "AN", nome: "Ancona", regione: "Marche" },
  { sigla: "AP", nome: "Ascoli Piceno", regione: "Marche" },
  { sigla: "FM", nome: "Fermo", regione: "Marche" },
  { sigla: "MC", nome: "Macerata", regione: "Marche" },
  { sigla: "PU", nome: "Pesaro e Urbino", regione: "Marche" },
  // Molise
  { sigla: "CB", nome: "Campobasso", regione: "Molise" },
  { sigla: "IS", nome: "Isernia", regione: "Molise" },
  // Piemonte
  { sigla: "AL", nome: "Alessandria", regione: "Piemonte" },
  { sigla: "AT", nome: "Asti", regione: "Piemonte" },
  { sigla: "BI", nome: "Biella", regione: "Piemonte" },
  { sigla: "CN", nome: "Cuneo", regione: "Piemonte" },
  { sigla: "NO", nome: "Novara", regione: "Piemonte" },
  { sigla: "TO", nome: "Torino", regione: "Piemonte" },
  { sigla: "VB", nome: "Verbano-Cusio-Ossola", regione: "Piemonte" },
  { sigla: "VC", nome: "Vercelli", regione: "Piemonte" },
  // Puglia
  { sigla: "BA", nome: "Bari", regione: "Puglia" },
  { sigla: "BT", nome: "Barletta-Andria-Trani", regione: "Puglia" },
  { sigla: "BR", nome: "Brindisi", regione: "Puglia" },
  { sigla: "FG", nome: "Foggia", regione: "Puglia" },
  { sigla: "LE", nome: "Lecce", regione: "Puglia" },
  { sigla: "TA", nome: "Taranto", regione: "Puglia" },
  // Sardegna
  { sigla: "CA", nome: "Cagliari", regione: "Sardegna" },
  { sigla: "NU", nome: "Nuoro", regione: "Sardegna" },
  { sigla: "OR", nome: "Oristano", regione: "Sardegna" },
  { sigla: "SS", nome: "Sassari", regione: "Sardegna" },
  { sigla: "SU", nome: "Sud Sardegna", regione: "Sardegna" },
  // Sicilia
  { sigla: "AG", nome: "Agrigento", regione: "Sicilia" },
  { sigla: "CL", nome: "Caltanissetta", regione: "Sicilia" },
  { sigla: "CT", nome: "Catania", regione: "Sicilia" },
  { sigla: "EN", nome: "Enna", regione: "Sicilia" },
  { sigla: "ME", nome: "Messina", regione: "Sicilia" },
  { sigla: "PA", nome: "Palermo", regione: "Sicilia" },
  { sigla: "RG", nome: "Ragusa", regione: "Sicilia" },
  { sigla: "SR", nome: "Siracusa", regione: "Sicilia" },
  { sigla: "TP", nome: "Trapani", regione: "Sicilia" },
  // Toscana
  { sigla: "AR", nome: "Arezzo", regione: "Toscana" },
  { sigla: "FI", nome: "Firenze", regione: "Toscana" },
  { sigla: "GR", nome: "Grosseto", regione: "Toscana" },
  { sigla: "LI", nome: "Livorno", regione: "Toscana" },
  { sigla: "LU", nome: "Lucca", regione: "Toscana" },
  { sigla: "MS", nome: "Massa-Carrara", regione: "Toscana" },
  { sigla: "PI", nome: "Pisa", regione: "Toscana" },
  { sigla: "PT", nome: "Pistoia", regione: "Toscana" },
  { sigla: "PO", nome: "Prato", regione: "Toscana" },
  { sigla: "SI", nome: "Siena", regione: "Toscana" },
  // Trentino-Alto Adige
  { sigla: "BZ", nome: "Bolzano", regione: "Trentino-Alto Adige" },
  { sigla: "TN", nome: "Trento", regione: "Trentino-Alto Adige" },
  // Umbria
  { sigla: "PG", nome: "Perugia", regione: "Umbria" },
  { sigla: "TR", nome: "Terni", regione: "Umbria" },
  // Valle d'Aosta
  { sigla: "AO", nome: "Aosta", regione: "Valle d'Aosta" },
  // Veneto
  { sigla: "BL", nome: "Belluno", regione: "Veneto" },
  { sigla: "PD", nome: "Padova", regione: "Veneto" },
  { sigla: "RO", nome: "Rovigo", regione: "Veneto" },
  { sigla: "TV", nome: "Treviso", regione: "Veneto" },
  { sigla: "VE", nome: "Venezia", regione: "Veneto" },
  { sigla: "VR", nome: "Verona", regione: "Veneto" },
  { sigla: "VI", nome: "Vicenza", regione: "Veneto" },
];

export const getProvinceByRegione = (regione: string) =>
  PROVINCE_IT.filter((p) => p.regione === regione);

// ===== Validatori =====

export const isValidCAP = (paese: paese_iso, cap: string): boolean => {
  if (!cap) return true; // opzionale
  if (paese === "CH") return /^\d{4}$/.test(cap.trim());
  return /^\d{5}$/.test(cap.trim());
};

// CH UID: CHE-123.456.789 (con o senza IVA suffix)
export const isValidPartitaIVA = (paese: paese_iso, value: string): boolean => {
  if (!value) return true;
  const v = value.trim().toUpperCase();
  if (paese === "CH") return /^CHE-?\d{3}\.?\d{3}\.?\d{3}( (MWST|TVA|IVA))?$/.test(v);
  return /^\d{11}$/.test(v);
};

export const isValidCodiceFiscaleIT = (value: string): boolean => {
  if (!value) return true;
  return /^[A-Z0-9]{16}$/.test(value.trim().toUpperCase());
};

export const isValidIBAN = (paese: paese_iso, value: string): boolean => {
  if (!value) return true;
  const v = value.replace(/\s/g, "").toUpperCase();
  if (paese === "CH") return /^CH\d{19}$/.test(v);
  return /^IT\d{2}[A-Z]\d{10}[A-Z0-9]{12}$/.test(v);
};

// ===== Placeholder dinamici =====

export const getCAPPlaceholder = (paese: paese_iso) => (paese === "CH" ? "6900" : "20100");
export const getTelefonoPlaceholder = (paese: paese_iso) =>
  paese === "CH" ? "+41 79 123 45 67" : "+39 333 1234567";
export const getPartitaIVAPlaceholder = (paese: paese_iso) =>
  paese === "CH" ? "CHE-123.456.789" : "12345678901";
export const getIBANPlaceholder = (paese: paese_iso) =>
  paese === "CH" ? "CH56 0483 5012 3456 7800 9" : "IT60 X054 2811 1010 0000 0123 456";
export const getNumeroIVAChfPlaceholder = () => "CHE-123.456.789 IVA";
