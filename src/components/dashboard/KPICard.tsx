import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
}

const TONE_CLASSES: Record<NonNullable<KPICardProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function KPICard({ label, value, hint, icon: Icon, tone = "default" }: KPICardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between py-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex size-9 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}
