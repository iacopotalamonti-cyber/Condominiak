"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Un invito mandato alla persona sbagliata si ritira prima che venga usato. La
// RLS lascia cancellare gli inviti solo a chi gestisce quel condominio.
export function RevocaInvito({ invitoId }: { invitoId: string }) {
  const router = useRouter();
  const [lavorando, setLavorando] = useState(false);

  async function revoca() {
    setLavorando(true);
    await createClient().from("inviti").delete().eq("id", invitoId);
    setLavorando(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={revoca} disabled={lavorando}>
      {lavorando ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      Revoca
    </Button>
  );
}
