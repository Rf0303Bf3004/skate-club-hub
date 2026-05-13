import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Trophy, Clock,
  Receipt, MessageSquare, Building2, Calendar, CalendarRange, MapPin,
  ListChecks, Handshake, UserCog, ShieldCheck, Wrench, FileSpreadsheet,
} from "lucide-react";

export type MenuGruppo = "principale" | "setup";

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
  // PRINCIPALE
  { codice: "dashboard",       label: "Dashboard",       icon: LayoutDashboard, path: "/",                gruppo: "principale", ordine: 1 },
  { codice: "atleti",          label: "Atleti",          icon: Users,           path: "/atleti",          gruppo: "principale", ordine: 2 },
  { codice: "istruttori",      label: "Istruttori",      icon: GraduationCap,   path: "/istruttori",      gruppo: "principale", ordine: 3 },
  { codice: "corsi",           label: "Corsi",           icon: BookOpen,        path: "/corsi",           gruppo: "principale", ordine: 4 },
  { codice: "gare",            label: "Gare",            icon: Trophy,          path: "/gare",            gruppo: "principale", ordine: 5 },
  { codice: "lezioni_private", label: "Lezioni Private", icon: Clock,           path: "/lezioni-private", gruppo: "principale", ordine: 6 },
  { codice: "fatture",         label: "Fatture",         icon: Receipt,         path: "/fatture",         gruppo: "principale", ordine: 7 },
  { codice: "comunicazioni",   label: "Comunicazioni",   icon: MessageSquare,   path: "/comunicazioni",   gruppo: "principale", ordine: 8 },
  // SETUP
  { codice: "setup_club",        label: "Setup del Club",     icon: Building2,     path: "/setup-club",        gruppo: "setup", ordine: 1 },
  { codice: "stagioni",          label: "Stagioni",           icon: Calendar,      path: "/stagioni",          gruppo: "setup", ordine: 2 },
  { codice: "planning_ghiaccio", label: "Planning Ghiaccio",  icon: CalendarRange, path: "/planning",          gruppo: "setup", ordine: 3 },
  { codice: "campi_allenamento", label: "Campi Allenamento",  icon: MapPin,        path: "/campi-eventi",      gruppo: "setup", ordine: 4 },
  { codice: "livelli",           label: "Livelli",            icon: ListChecks,    path: "/livelli",           gruppo: "setup", ordine: 5, non_implementato: true },
  { codice: "sponsor",           label: "Sponsor",            icon: Handshake,     path: "/sponsor",           gruppo: "setup", ordine: 6, non_implementato: true },
  { codice: "gestione_utenti",   label: "Gestione Utenti",    icon: UserCog,       path: "/utenti",            gruppo: "setup", ordine: 7 },
  { codice: "ruoli_permessi",    label: "Gestione Ruoli",     icon: ShieldCheck,   path: "/ruoli-permessi",    gruppo: "setup", ordine: 8 },
  { codice: "gestione_avanzata", label: "Gestione Avanzata",  icon: Wrench,            path: "/gestione-avanzata", gruppo: "setup", ordine: 9 },
  { codice: "import_dati",       label: "Import dati",        icon: FileSpreadsheet,   path: "/import-atleti",     gruppo: "setup", ordine: 10 },
];

export const MENU_PRINCIPALE = MENU_SECTIONS.filter((s) => s.gruppo === "principale").sort((a, b) => a.ordine - b.ordine);
export const MENU_SETUP = MENU_SECTIONS.filter((s) => s.gruppo === "setup").sort((a, b) => a.ordine - b.ordine);
