import React from "react";
import { CheckCircle2, Loader2, AlertCircle, Info } from "lucide-react";
import { useSavingState, saving_store } from "@/stores/savingState";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

function format_time(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export default function SavingIndicator() {
  const { t } = useTranslation("dashboard");
  const s = useSavingState();

  let icon: React.ReactNode;
  let text: string;
  let color = "text-teal-600";

  if (s.error) {
    icon = <AlertCircle className="w-4 h-4" />;
    text = t("relazione.saving_indicator.error");
    color = "text-red-600";
  } else if (s.pending > 0) {
    icon = <Loader2 className="w-4 h-4 animate-spin" />;
    text = t("relazione.saving_indicator.saving");
    color = "text-muted-foreground";
  } else if (s.just_saved) {
    icon = <CheckCircle2 className="w-4 h-4" />;
    text = t("relazione.saving_indicator.saved");
  } else {
    icon = <CheckCircle2 className="w-4 h-4" />;
    text = s.last_saved_at
      ? t("relazione.saving_indicator.all_saved_at", { ora: format_time(s.last_saved_at) })
      : t("relazione.saving_indicator.all_saved");
  }

  return (
    <div className="flex items-center gap-2 text-[13px]">
      <div className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        <span>{text}</span>
        {s.error && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[12px] text-red-600 hover:text-red-700"
            onClick={() => saving_store.clear_error()}
          >
            {t("relazione.saving_indicator.retry")}
          </Button>
        )}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("relazione.saving_indicator.info_aria")}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {t("relazione.saving_indicator.info_tooltip")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
