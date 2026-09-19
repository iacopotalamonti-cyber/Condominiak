"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  Wallet,
  PieChart,
  Wrench,
  Home,
  Truck,
  FileText,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface SidebarProps {
  role: "admin" | "resident";
}

export const ADMIN_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/bilanci", label: "Bilanci 5 anni", icon: Wallet },
  { href: "/dashboard/spese", label: "Analisi spese", icon: PieChart },
  { href: "/dashboard/fornitori", label: "Fornitori", icon: Truck },
  { href: "/dashboard/impianti", label: "Impianti", icon: Wrench },
  { href: "/dashboard/appartamento", label: "Il mio appartamento", icon: Home },
  { href: "/dashboard/documenti", label: "Documenti", icon: FileText },
  { href: "/dashboard/impostazioni", label: "Impostazioni", icon: Settings },
];

export const RESIDENT_LINKS = [
  { href: "/dashboard/appartamento", label: "Il mio appartamento", icon: Home },
  { href: "/dashboard/documenti", label: "Documenti", icon: FileText },
];

export function linksPerRuolo(role: "admin" | "resident") {
  return role === "admin" ? ADMIN_LINKS : RESIDENT_LINKS;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const links = linksPerRuolo(role);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card sm:flex">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-4" />
        </div>
        <span className="font-semibold">{process.env.NEXT_PUBLIC_APP_NAME || "Condominiak"}</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
