"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { MenuMobile } from "@/components/layout/MenuMobile";
import { Button } from "@/components/ui/button";
import type { Condominium } from "@/lib/types";

interface TopBarProps {
  condominium: Condominium;
  role: "admin" | "resident";
}

export function TopBar({ condominium, role }: TopBarProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between gap-2 border-b bg-card px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-1">
        <MenuMobile role={role} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
          {condominium.via} {condominium.civico}, {condominium.citta}
          </p>
          <p className="text-xs text-muted-foreground">
            {role === "admin" ? "Amministratore" : "Condomino"}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="size-4" />
        Esci
      </Button>
    </header>
  );
}
