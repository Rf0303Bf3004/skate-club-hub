import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Trophy, Clock,
  Receipt, MessageSquare, Building2, Calendar, CalendarRange, Snowflake,
  ListChecks, Handshake, UserCog, ShieldCheck, Wrench, FileSpreadsheet,
  ClipboardCheck, Sparkles, UserPlus, LayoutGrid, Tablet,
} from "lucide-react";

export type MenuBlocco = "conduzione" | "setup";

export type MenuGruppo =
  | "nessuno"
  | "persone"
  | "ghiaccio"
  | "soldi"
  | "struttura"
  | "offerta"
  | "sponsor_gruppo"
  | "accessi";

export interface MenuSection {
  codice: string;
  label: string;
  icon: any;
  path: string;
  blocco: MenuBlocco;
  gruppo: MenuGruppo;
  ordine: number;
  non_implementato?: boolean;
}

export const MENU_SECTIONS: MenuSection[] = [
  // ---- CONDUZIONE ----
  { codice: "dashboard",        label: "Dashboard",          icon: LayoutDashboard, path: "/",                  blocco: "conduzione", gruppo: "nessuno", ordine: 1 },
  { codice: "pista",            label: "Bordo pista",        icon: Tablet,          path: "/pista",             blocco: "conduzione", gruppo: "nessuno", ordine: 2 },
  { codice: "comunicazioni",    label: "Comunicazioni",      icon: MessageSquare,   path: "/comunicazioni",     blocco: "conduzione", gruppo: "nessuno", ordine: 3 },

  { codice: "atleti",           label: "Atleti",             icon: Users,           path: "/atleti",            blocco: "conduzione", gruppo: "persone", ordine: 1 },
  { codice: "richieste_iscrizione", label: "Richieste Iscrizione", icon: UserPlus,  path: "/richieste-iscrizione", blocco: "conduzione", gruppo: "persone", ordine: 2 },

  { codice: "griglia_ghiaccio", label: "Griglia Ghiaccio",   icon: LayoutGrid,      path: "/griglia-ghiaccio",  blocco: "conduzione", gruppo: "ghiaccio", ordine: 1 },
  { codice: "lezioni_private",  label: "Lezioni Private",    icon: Clock,           path: "/lezioni-private",   blocco: "conduzione", gruppo: "ghiaccio", ordine: 2 },
  { codice: "gare",             label: "Gare",               icon: Trophy,          path: "/gare",              blocco: "conduzione", gruppo: "ghiaccio", ordine: 3 },
  { codice: "test_livello",     label: "Test Livello",       icon: ClipboardCheck,  path: "/test",              blocco: "conduzione", gruppo: "ghiaccio", ordine: 4 },
  { codice: "eventi",           label: "Eventi",             icon: Sparkles,        path: "/eventi",            blocco: "conduzione", gruppo: "ghiaccio", ordine: 5 },

  { codice: "fatture",          label: "Fatture",            icon: Receipt,         path: "/fatture",           blocco: "conduzione", gruppo: "soldi", ordine: 1 },

  // ---- SETUP ----
  { codice: "setup_club",       label: "Setup del Club",     icon: Building2,       path: "/setup-club",        blocco: "setup", gruppo: "struttura", ordine: 1 },
  { codice: "stagioni",         label: "Stagioni",           icon: Calendar,        path: "/stagioni",          blocco: "setup", gruppo: "struttura", ordine: 2 },
  { codice: "livelli",          label: "Livelli",            icon: ListChecks,      path: "/livelli",           blocco: "setup", gruppo: "struttura", ordine: 3, non_implementato: true },

  { codice: "corsi",            label: "Corsi",              icon: BookOpen,        path: "/corsi",             blocco: "setup", gruppo: "offerta", ordine: 1 },
  { codice: "planning_ghiaccio", label: "Planning Ghiaccio", icon: CalendarRange,   path: "/planning",          blocco: "setup", gruppo: "offerta", ordine: 2 },
  { codice: "istruttori",       label: "Istruttori",         icon: GraduationCap,   path: "/istruttori",        blocco: "setup", gruppo: "offerta", ordine: 3 },

  { codice: "sponsor",          label: "Sponsor",            icon: Handshake,       path: "/sponsor",           blocco: "setup", gruppo: "sponsor_gruppo", ordine: 1, non_implementato: true },
  { codice: "pacchetti_sponsor", label: "Pacchetti Sponsor", icon: FileSpreadsheet, path: "/pacchetti-sponsor", blocco: "setup", gruppo: "sponsor_gruppo", ordine: 2 },

  { codice: "gestione_utenti",  label: "Gestione Utenti",    icon: UserCog,         path: "/utenti",            blocco: "setup", gruppo: "accessi", ordine: 1 },
  { codice: "ruoli_permessi",   label: "Gestione Ruoli",     icon: ShieldCheck,     path: "/ruoli-permessi",    blocco: "setup", gruppo: "accessi", ordine: 2 },
  { codice: "gestione_avanzata", label: "Gestione Avanzata", icon: Wrench,          path: "/gestione-avanzata", blocco: "setup", gruppo: "accessi", ordine: 3 },
  { codice: "import_dati",      label: "Import dati",        icon: FileSpreadsheet, path: "/import-atleti",     blocco: "setup", gruppo: "accessi", ordine: 4 },
];

export const MENU_BLOCCHI: { id: MenuBlocco; label_key: string; label_fallback: string }[] = [
  { id: "conduzione", label_key: "menu_blocco.conduzione", label_fallback: "Conduzione" },
  { id: "setup", label_key: "menu_blocco.setup", label_fallback: "Setup" },
];

// Voci fuori da ogni gruppo, in cima al blocco CONDUZIONE.
export const MENU_TOP = MENU_SECTIONS
  .filter((s) => s.gruppo === "nessuno")
  .sort((a, b) => a.ordine - b.ordine);

const GRUPPI_DEF: { id: MenuGruppo; blocco: MenuBlocco; label_key: string; label_fallback: string; icon: any }[] = [
  { id: "persone", blocco: "conduzione", label_key: "menu_gruppo.persone", label_fallback: "Persone", icon: Users },
  { id: "ghiaccio", blocco: "conduzione", label_key: "menu_gruppo.ghiaccio", label_fallback: "Ghiaccio", icon: Snowflake },
  { id: "soldi", blocco: "conduzione", label_key: "menu_gruppo.soldi", label_fallback: "Amministrazione", icon: Receipt },
  { id: "struttura", blocco: "setup", label_key: "menu_gruppo.struttura", label_fallback: "Il club", icon: Building2 },
  { id: "offerta", blocco: "setup", label_key: "menu_gruppo.offerta", label_fallback: "Corsi e istruttori", icon: BookOpen },
  { id: "sponsor_gruppo", blocco: "setup", label_key: "menu_gruppo.sponsor_gruppo", label_fallback: "Sponsor", icon: Handshake },
  { id: "accessi", blocco: "setup", label_key: "menu_gruppo.accessi", label_fallback: "Accessi e dati", icon: ShieldCheck },
];

export const MENU_GRUPPI = GRUPPI_DEF.map((gruppo) => ({
  ...gruppo,
  voci: MENU_SECTIONS
    .filter((s) => s.gruppo === gruppo.id)
    .sort((a, b) => a.ordine - b.ordine),
}));

export const gruppi_del_blocco = (blocco: MenuBlocco) =>
  MENU_GRUPPI.filter((gruppo) => gruppo.blocco === blocco);

/**
 * Unica fonte per la tabella dei permessi: copre TUTTE le sezioni dei due blocchi.
 * Chi cambia gruppi o blocchi deve cambiare solo questo file: la tabella resta piena.
 */
export const FASCE_PERMESSI: {
  blocco: MenuBlocco;
  label_key: string;
  label_fallback: string;
  fasce: { id: string; label_key: string; label_fallback: string; voci: MenuSection[] }[];
}[] = MENU_BLOCCHI.map((blocco) => ({
  blocco: blocco.id,
  label_key: blocco.label_key,
  label_fallback: blocco.label_fallback,
  fasce: [
    ...(blocco.id === "conduzione"
      ? [{ id: "generale", label_key: "menu_gruppo.generale", label_fallback: "Generale", voci: MENU_TOP }]
      : []),
    ...gruppi_del_blocco(blocco.id).map((gruppo) => ({
      id: gruppo.id as string,
      label_key: gruppo.label_key,
      label_fallback: gruppo.label_fallback,
      voci: gruppo.voci,
    })),
  ],
}));
