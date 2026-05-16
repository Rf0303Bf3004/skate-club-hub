import React from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  titolo: string;
  testo: string;
  collapsible_label?: string;
  children?: React.ReactNode;
}

export default function TabHeaderInfo({ icon: Icon, titolo, testo, collapsible_label, children }: Props) {
  return (
    <div className="rounded-lg border border-teal-200 bg-[#f0fdfa] p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 w-9 h-9 rounded-md bg-teal-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-teal-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-lg text-foreground">{titolo}</h2>
          <p className="text-sm text-foreground/80 mt-1 leading-relaxed">{testo}</p>
          {children && collapsible_label && (
            <Collapsible className="mt-3">
              <CollapsibleTrigger className="inline-flex items-center gap-1 text-sm font-medium text-teal-800 hover:text-teal-900 transition-colors [&[data-state=open]>svg]:rotate-180">
                {collapsible_label}
                <ChevronDown className="w-4 h-4 transition-transform" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 text-sm text-foreground/80">
                {children}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
}
