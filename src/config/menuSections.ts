import {
  LayoutDashboard, Users, UserCheck, BookOpen, Trophy, GraduationCap,
  CreditCard, MessageSquare, Settings, Calendar, Tent, Award, Star,
  Lock, ShieldAlert, UserCog,
} from "lucide-react";

export type MenuGruppo = "principale" | "setup";

export interface MenuSection {
  codice: string;
  label: string;
  icon: any;
  path: string;
  gruppo: MenuGruppo;
  ordine: number;
}

export const MENU_SECTIONS: MenuSection[] = [
  // PRINCIPALE
  { codice: "dashboard",        label: "Dashboard",        icon: LayoutDashboard, path: "/",                    gruppo: "principale", ordine: 1 },
  { codice: "atleti",           label: "Atleti",           icon: Users,           path: "/atleti",              gruppo: "principale", ordine: 2 },
  { codice: "istruttori",       label: "Istruttori",       icon: UserCheck,       path: "/istruttori",          gruppo: "principale", ordine: 3 },
  { codice: "corsi",            label: "Corsi",            icon: BookOpen,        path: "/corsi",               gruppo: "principale", ordine: 4 },
  { codice: "gare",             label: "Gare",             icon: Trophy,          path: "/gare",                gruppo: "principale", ordine: 5 },
  { codice: "lezioni_private",  label: "Lezioni private",  icon: GraduationCap,   path: "/lezioni-private",     gruppo: "principale", ordine: 6 },
  { codice: "fatture",          label: "Fatture",          icon: CreditCard,      path: "/fatture",             gruppo: "principale", ordine: 7 },
  { codice: "comunicazioni",    label: "Comunicazioni",    icon: MessageSquare,   path: "/comunicazioni",       gruppo: "principale", ordine: 8 },
  // SETUP
  { codice: "setup_club",        label: "Configurazione club",  icon: Settings,     path: "/setup-club",                       gruppo: "setup", ordine: 1 },
  { codice: "stagioni",          label: "Stagioni",             icon: Calendar,     path: "/nuova-stagione",                   gruppo: "setup", ordine: 2 },
  { codice: "planning_ghiaccio", label: "Planning ghiaccio",    icon: Calendar,     path: "/planning",                         gruppo: "setup", ordine: 3 },
  { codice: "campi_allenamento", label: "Campi e eventi",       icon: Tent,         path: "/campi-eventi",                     gruppo: "setup", ordine: 4 },
  { codice: "livelli",           label: "Livelli",              icon: Award,        path: "/test",                             gruppo: "setup", ordine: 5 },
  { codice: "sponsor",           label: "Sponsor",              icon: Star,         path: "/sponsor",                          gruppo: "setup", ordine: 6 },
  { codice: "gestione_utenti",   label: "Gestione utenti",      icon: UserCog,      path: "/utenti",                           gruppo: "setup", ordine: 7 },
  { codice: "ruoli_permessi",    label: "Ruoli e permessi",     icon: Lock,         path: "/ruoli-permessi",                   gruppo: "setup", ordine: 8 },
  { codice: "gestione_avanzata", label: "Gestione avanzata",    icon: ShieldAlert,  path: "/gestione-avanzata",                gruppo: "setup", ordine: 9 },
];

export const MENU_PRINCIPALE = MENU_SECTIONS.filter((s) => s.gruppo === "principale").sort((a, b) => a.ordine - b.ordine);
export const MENU_SETUP = MENU_SECTIONS.filter((s) => s.gruppo === "setup").sort((a, b) => a.ordine - b.ordine);
