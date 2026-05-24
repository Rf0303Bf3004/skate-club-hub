import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X, UserPlus, BookOpen, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/**
 * Banner di benvenuto post-onboarding.
 * Mostrato in Dashboard solo se clubs.banner_onboarding_chiuso = false.
 * NOTE i18n: stringhe in italiano (vedi I18N_TODO.md — estrazione futura).
 */
export default function OnboardingBanner() {
  const { session } = useAuth();
  const club_id = session?.club_id;
  const [visible, set_visible] = useState(false);
  const [closing, set_closing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!club_id) return;
    (async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("banner_onboarding_chiuso")
        .eq("id", club_id)
        .maybeSingle();
      if (cancelled || error) return;
      if (!data?.banner_onboarding_chiuso) set_visible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [club_id]);

  const handle_close = async () => {
    if (!club_id) return;
    set_closing(true);
    set_visible(false); // ottimistico
    const { error } = await supabase
      .from("clubs")
      .update({ banner_onboarding_chiuso: true })
      .eq("id", club_id);
    if (error) {
      set_visible(true); // rollback
      set_closing(false);
      toast.error("Impossibile chiudere il banner. Riprova.");
      return;
    }
    toast.success("Benvenuto, buon lavoro! 🎉");
  };

  if (!visible) return null;

  return (
    <div
      className={`relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-5 md:p-6 shadow-sm animate-fade-in ${
        closing ? "opacity-0 transition-opacity duration-200" : ""
      }`}
    >
      <button
        type="button"
        onClick={handle_close}
        aria-label="Chiudi banner"
        className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="hidden sm:flex w-12 h-12 rounded-xl bg-primary/15 items-center justify-center text-primary shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary sm:hidden" />
            Configurazione completata
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Il tuo club è pronto. Inizia ad aggiungere atleti, corsi e istruttori per partire.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="default" className="gap-1.5">
              <Link to="/atleti?new=true">
                <UserPlus className="w-4 h-4" /> Aggiungi il primo atleta
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/corsi?new=true">
                <BookOpen className="w-4 h-4" /> Crea un corso
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/utenti">
                <Users className="w-4 h-4" /> Invita uno staff
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
