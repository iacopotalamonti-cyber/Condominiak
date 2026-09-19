"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { linksPerRuolo } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MenuMobileProps {
  role: "admin" | "resident";
}

// Sotto i 640px la barra laterale è nascosta e non c'era nient'altro: da
// telefono non si poteva cambiare pagina. Le voci sono le stesse della barra,
// prese da lì invece che riscritte, così non possono divergere.
export function MenuMobile({ role }: MenuMobileProps) {
  const pathname = usePathname();
  const [aperto, setAperto] = useState(false);
  const links = linksPerRuolo(role);

  return (
    <div className="sm:hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAperto((stato) => !stato)}
        aria-expanded={aperto}
        aria-label={aperto ? "Chiudi il menu" : "Apri il menu"}
      >
        <Menu className="size-5" />
      </Button>

      {aperto && (
        <>
          {/* Il velo chiude il menu toccando fuori, che su telefono è il gesto
              che tutti provano per primo. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setAperto(false)}
          />
          <nav className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-1 overflow-y-auto border-r bg-card p-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="font-semibold">
                {process.env.NEXT_PUBLIC_APP_NAME || "Condominiak"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setAperto(false)} aria-label="Chiudi il menu">
                <X className="size-4" />
              </Button>
            </div>

            {links.map(({ href, label, icon: Icon }) => {
              const attivo = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setAperto(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                    attivo ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </div>
  );
}
