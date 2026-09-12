import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Trophy, Clock,
  Receipt, MessageSquare, Building2, Calendar, CalendarRange, Snowflake,
  ListChecks, Handshake, UserCog, ShieldCheck, Wrench, FileSpreadsheet,
  ClipboardCheck, Sparkles, UserPlus, LayoutGrid, Tablet,
} from "lucide-react";

export type MenuGruppo = "nessuno" | "persone" | "ghiaccio" | "soldi" | "club";

export interface MenuSection {
  codice: string;
  label: string;
  icon: any;
  path: string;
  gruppo: MenuGruppo;
  ordine: number;
  non_implementato?: boolean;
}

export const MENU_SECTIONS: MenuSection[] = [
  { codice: "dashboard",        label: "Dashboard",          icon: LayoutDashboard, path: "/",                  gruppo: "nessuno", ordine: 1 },
  { codice: "pista",            label: "Bordo pista",        icon: Tablet,          path: "/pista",             gruppo: "nessuno", ordine: 2 },
  { codice: "comunicazioni",    label: "Comunicazioni",      icon: MessageSquare,   path: "/comunicazioni",     gruppo: "nessuno", ordine: 3 },
  { codice: "atleti",           label: "Atleti",             icon: Users,           path: "/atleti",            gruppo: "persone", ordine: 1 },
  { codice: "richieste_iscrizione", label: "Richieste Iscrizione", icon: UserPlus,    path: "/richieste-iscrizione", gruppo: "persone", ordine: 2 },
  { codice: "istruttori",       label: "Istruttori",         icon: GraduationCap,   path: "/istruttori",        gruppo: "persone", ordine: 3 },
  { codice: "corsi",            label: "Corsi",              icon: BookOpen,        path: "/corsi",             gruppo: "ghiaccio", ordine: 1 },
  { codice: "planning_ghiaccio", label: "Planning Ghiaccio", icon: CalendarRange,   path: "/planning",          gruppo: "ghiaccio", ordine: 2 },
  { codice: "griglia_ghiaccio", label: "Griglia Ghiaccio",   icon: LayoutGrid,      path: "/griglia-ghiaccio",  gruppo: "ghiaccio", ordine: 3 },
  { codice: "lezioni_private",  label: "Lezioni Private",    icon: Clock,           path: "/lezioni-private",   gruppo: "ghiaccio", ordine: 4 },
  { codice: "gare",             label: "Gare",               icon: Trophy,          path: "/gare",              gruppo: "ghiaccio", ordine: 5 },
  { codice: "test_livello",     label: "Test Livello",       icon: ClipboardCheck,  path: "/test",              gruppo: "ghiaccio", ordine: 6 },
  { codice: "eventi",           label: "Eventi",             icon: Sparkles,        path: "/eventi",            gruppo: "ghiaccio", ordine: 7 },
  { codice: "fatture",          label: "Fatture",            icon: Receipt,         path: "/fatture",           gruppo: "soldi", ordine: 1 },
  { codice: "setup_club",       label: "Setup del Club",     icon: Building2,       path: "/setup-club",        gruppo: "club", ordine: 1 },
  { codice: "stagioni",         label: "Stagioni",           icon: Calendar,        path: "/stagioni",          gruppo: "club", ordine: 2 },
  { codice: "livelli",          label: "Livelli",            icon: ListChecks,      path: "/livelli",           gruppo: "club", ordine: 3, non_implementato: true },
  { codice: "sponsor",          label: "Sponsor",            icon: Handshake,       path: "/sponsor",           gruppo: "club", ordine: 4, non_implementato: true },
  { codice: "pacchetti_sponsor", label: "Pacchetti Sponsor", icon: FileSpreadsheet, path: "/pacchetti-sponsor", gruppo: "club", ordine: 5 },
  { codice: "gestione_utenti",  label: "Gestione Utenti",    icon: UserCog,         path: "/utenti",            gruppo: "club", ordine: 6 },
  { codice: "ruoli_permessi",   label: "Gestione Ruoli",     icon: ShieldCheck,     path: "/ruoli-permessi",    gruppo: "club", ordine: 7 },
  { codice: "gestione_avanzata", label: "Gestione Avanzata", icon: Wrench,          path: "/gestione-avanzata", gruppo: "club", ordine: 8 },
  { codice: "import_dati",      label: "Import dati",        icon: FileSpreadsheet, path: "/import-atleti",     gruppo: "club", ordine: 9 },
];

export const MENU_TOP = MENU_SECTIONS
  .filter((s) => s.gruppo === "nessuno")
  .sort((a, b) => a.ordine - b.ordine);

export const MENU_GRUPPI = [
  { id: "persone", label_key: "menu_gruppo.persone", label_fallback: "Persone", icon: Users },
  { id: "ghiaccio", label_key: "menu_gruppo.ghiaccio", label_fallback: "Ghiaccio", icon: Snowflake },
  { id: "soldi", label_key: "menu_gruppo.soldi", label_fallback: "Amministrazione", icon: Receipt },
  { id: "club", label_key: "menu_gruppo.club", label_fallback: "Il club", icon: Building2 },
].map((gruppo) => ({
  ...gruppo,
  voci: MENU_SECTIONS
    .filter((s) => s.gruppo === gruppo.id)
    .sort((a, b) => a.ordine - b.ordine),
}));
