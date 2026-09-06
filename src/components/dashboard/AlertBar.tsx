import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AlertItem {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
}

const ICONS = { info: Info, warning: AlertTriangle, critical: ShieldAlert };
const CLASSES = {
  info: "border-border bg-card text-foreground",
  warning: "border-warning/30 bg-warning/10 text-warning",
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function AlertBar({ alerts }: { alerts: AlertItem[] }) {
  if (!alerts.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => {
        const Icon = ICONS[alert.severity];
        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm",
              CLASSES[alert.severity]
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
