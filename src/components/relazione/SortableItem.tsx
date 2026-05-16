import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  children: React.ReactNode;
  className?: string;
  handle_class?: string;
  disabled?: boolean;
}

export default function SortableItem({ id, children, className, handle_class, disabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-stretch gap-2", className)}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          "shrink-0 flex items-center justify-center px-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground rounded-md",
          disabled && "opacity-30 cursor-not-allowed",
          handle_class,
        )}
        aria-label="Trascina per riordinare"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
