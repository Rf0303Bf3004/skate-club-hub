import React, { useState, Component, ErrorInfo, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, get_current_club_id } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, Wrench, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Constants ──
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"] as const;
type ViewMode = "1" | "2" | "3" | "week";

// ── Palette colori istruttori ──
const COLORI_ISTRUTTORI = [
  "hsl(210, 70%, 55%)", "hsl(340, 70%, 55%)", "hsl(160, 60%, 45%)",
  "hsl(40, 80%, 50%)", "hsl(270, 60%, 55%)", "hsl(20, 75%, 55%)",
  "hsl(190, 65%, 45%)", "hsl(300, 50%, 55%)",
];

// ── ErrorBoundary ──
class PlanningErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PlanningPage crash:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-foreground font-bold">Errore nel Planning</p>
          <p className="text-sm text-muted-foreground max-w-md text-center">{this.state.error?.message}</p>
          <button className="text-sm text-primary underline" onClick={() => this.setState({ hasError: false, error: null })}>Riprova</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main Component ──
function PlanningPageInner() {
  const club_id = get_current_club_id();

  // ── State ──
  const [view_mode, set_view_mode] = useState<ViewMode>("week");
  const [build_mode, set_build_mode] = useState(false);
  const [selected_course_id, set_selected_course_id] = useState<string | null>(null);

  // ── Query 1: disponibilita_ghiaccio ──
  const { data: ice_slots = [], isLoading: loading_ice } = useQuery({
    queryKey: ["planning_ice_slots", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilita_ghiaccio")
        .select("*")
        .eq("club_id", club_id)
        .order("giorno")
        .order("ora_inizio");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Query 2: corsi posizionati (giorno NOT NULL) ──
  const { data: placed_courses = [], isLoading: loading_placed } = useQuery({
    queryKey: ["planning_placed_courses", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corsi")
        .select("*, corsi_istruttori(istruttore_id)")
        .eq("club_id", club_id)
        .not("giorno", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Query 3: corsi da posizionare (giorno IS NULL) ──
  const { data: unplaced_courses = [], isLoading: loading_unplaced } = useQuery({
    queryKey: ["planning_unplaced_courses", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corsi")
        .select("*, corsi_istruttori(istruttore_id)")
        .eq("club_id", club_id)
        .is("giorno", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Query 4: istruttori ──
  const { data: istruttori = [], isLoading: loading_istr } = useQuery({
    queryKey: ["planning_istruttori", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("istruttori")
        .select("id, nome, cognome")
        .eq("club_id", club_id)
        .order("cognome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Query 5: tipi_corso ──
  const { data: tipi_corso = [], isLoading: loading_tipi } = useQuery({
    queryKey: ["planning_tipi_corso", club_id],
    enabled: !!club_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipi_corso")
        .select("id, nome")
        .eq("club_id", club_id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Derive istruttori con colore assegnato ──
  const istruttori_con_colore = istruttori.map((ist, idx) => ({
    ...ist,
    colore: COLORI_ISTRUTTORI[idx % COLORI_ISTRUTTORI.length],
  }));

  const is_loading = loading_ice || loading_placed || loading_unplaced || loading_istr || loading_tipi;

  // Forza settimana in build mode
  const effective_view = build_mode ? "week" : view_mode;

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 p-3 border-b bg-background">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">Planning Ghiaccio</h1>
          {is_loading && <span className="text-xs text-muted-foreground">Caricamento…</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          {!build_mode && (
            <div className="flex items-center border rounded-md overflow-hidden">
              {([["1", "1g"], ["2", "2g"], ["3", "3g"], ["week", "7g"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => set_view_mode(val as ViewMode)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    effective_view === val
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Navigation arrows (non-week views) */}
          {!build_mode && effective_view !== "week" && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Build mode toggle */}
          <Button
            variant={build_mode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              set_build_mode((prev) => !prev);
              set_selected_course_id(null);
            }}
            className="gap-1.5"
          >
            {build_mode ? <Eye className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
            {build_mode ? "Visualizzazione" : "Costruzione"}
          </Button>
        </div>
      </div>

      {/* ── Legenda istruttori ── */}
      {istruttori_con_colore.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/30 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Istruttori:</span>
          {istruttori_con_colore.map((ist) => (
            <div key={ist.id} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: ist.colore }}
              />
              <span className="text-xs text-foreground">
                {ist.nome} {ist.cognome}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar (build mode only) ── */}
        {build_mode && (
          <div className="w-[280px] flex-shrink-0 border-r bg-muted/20 flex flex-col overflow-hidden">
            <div className="p-3 border-b bg-muted/40">
              <span className="text-sm font-medium text-foreground">
                Da posizionare ({unplaced_courses.length})
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {unplaced_courses.map((corso) => (
                <div
                  key={corso.id}
                  onClick={() =>
                    set_selected_course_id((prev) => (prev === corso.id ? null : corso.id))
                  }
                  className={`p-3 border-b cursor-pointer transition-colors hover:bg-muted/50 ${
                    selected_course_id === corso.id
                      ? "ring-2 ring-inset ring-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{corso.nome}</span>
                    {corso.tipo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {corso.tipo}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {corso.ora_inizio?.slice(0, 5)} – {corso.ora_fine?.slice(0, 5)}
                  </div>
                </div>
              ))}
              {unplaced_courses.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  Tutti i corsi sono posizionati
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Grid area ── */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-1">
            {GIORNI.map((giorno) => {
              const day_ice = ice_slots.filter((s) => s.giorno === giorno);
              const day_courses = placed_courses.filter((c) => c.giorno === giorno);

              return (
                <div key={giorno} className="flex items-stretch border rounded-md overflow-hidden bg-background">
                  {/* Day label */}
                  <div className="w-24 flex-shrink-0 flex items-center justify-center bg-muted/40 border-r px-2 py-3">
                    <span className="text-xs font-medium text-foreground">{giorno}</span>
                  </div>

                  {/* Day content */}
                  <div className="flex-1 min-h-[48px] flex items-center gap-2 px-3 py-2">
                    {day_ice.length === 0 && day_courses.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">Nessuna disponibilità</span>
                    )}

                    {day_ice.length > 0 && day_courses.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Ghiaccio: {day_ice.map((s) => `${s.ora_inizio?.toString().slice(0, 5)}–${s.ora_fine?.toString().slice(0, 5)}`).join(", ")}
                      </span>
                    )}

                    {day_courses.map((corso) => (
                      <div
                        key={corso.id}
                        className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                      >
                        {corso.nome} ({corso.ora_inizio?.toString().slice(0, 5)}–{corso.ora_fine?.toString().slice(0, 5)})
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Debug info */}
          <div className="mt-4 p-3 rounded border bg-muted/20 text-xs text-muted-foreground space-y-1">
            <p>Disponibilità ghiaccio: {ice_slots.length} slot</p>
            <p>Corsi posizionati: {placed_courses.length}</p>
            <p>Corsi da posizionare: {unplaced_courses.length}</p>
            <p>Istruttori: {istruttori.length}</p>
            <p>Tipi corso: {tipi_corso.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export ──
export default function PlanningPage() {
  return (
    <PlanningErrorBoundary>
      <PlanningPageInner />
    </PlanningErrorBoundary>
  );
}
