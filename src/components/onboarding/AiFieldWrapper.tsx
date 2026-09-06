import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface AiFieldWrapperProps {
  fromAi: boolean;
  className?: string;
  children: React.ReactNode;
}

// Evidenzia in azzurro i campi pre-compilati dall'AI, come da spec onboarding.
export function AiFieldWrapper({ fromAi, className, children }: AiFieldWrapperProps) {
  return (
    <div
      className={cn(
        "relative rounded-md",
        fromAi && "ring-1 ring-sky-300 bg-sky-50 dark:bg-sky-950/30 dark:ring-sky-800",
        className
      )}
    >
      {children}
      {fromAi && (
        <Sparkles className="pointer-events-none absolute top-1.5 right-1.5 size-3 text-sky-500" />
      )}
    </div>
  );
}
