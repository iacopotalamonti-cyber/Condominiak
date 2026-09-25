"use client";

import { useState } from "react";
import { Check, Copy, Link2, Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteResidentButtonProps {
  condominiumId: string;
  unitaId: string;
  etichetta: string;
  currentEmail: string | null;
}

// L'invito produce un link, che chi gestisce il condominio manda come vuole:
// WhatsApp, email, a voce. Il link vale per l'indirizzo scritto qui, una volta
// sola, per quattordici giorni.
export function InviteResidentButton({
  condominiumId,
  unitaId,
  etichetta,
  currentEmail,
}: InviteResidentButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [gestore, setGestore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function crea() {
    setLoading(true);
    setErrore(null);
    try {
      const res = await fetch("/api/invite-resident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condominiumId, unitaId, email, gestore }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Invito non creato");
      setLink(json.link);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  async function copia() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiato(true);
  }

  function chiudi(aperto: boolean) {
    setOpen(aperto);
    if (!aperto) {
      setLink(null);
      setCopiato(false);
      setErrore(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={chiudi}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-3.5" />
        Invita
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invita — {etichetta}</DialogTitle>
          <DialogDescription>
            Crea un link da mandare a chi abita qui. Vale solo per l&apos;indirizzo che scrivi,
            una volta, per quattordici giorni.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col gap-3">
            <Label htmlFor="invite-link">Mandalo a {email}</Label>
            <div className="flex gap-2">
              <Input id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} />
              <Button variant="outline" onClick={copia}>
                {copiato ? <Check /> : <Copy />}
                {copiato ? "Copiato" : "Copia"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Il link si vede solo adesso: se lo perdi, crea un altro invito.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@esempio.it"
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={gestore}
                onChange={(e) => setGestore(e.target.checked)}
              />
              <span>
                Può gestire il condominio
                <span className="block text-xs text-muted-foreground">
                  Carica documenti e invita altri. Lascialo vuoto per un condomino che deve solo
                  vedere.
                </span>
              </span>
            </label>
            {errore && <p className="text-sm text-destructive">{errore}</p>}
          </div>
        )}

        <DialogFooter>
          {!link && (
            <Button onClick={crea} disabled={loading || !email}>
              {loading ? <Loader2 className="animate-spin" /> : <Link2 />}
              Crea il link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
