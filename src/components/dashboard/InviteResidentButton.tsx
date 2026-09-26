"use client";

import { useState } from "react";
import { Check, Copy, Loader2, MailCheck, Send, UserPlus } from "lucide-react";

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

// L'invito parte per email all'indirizzo scritto qui, con dentro il link. Il
// link si vede anche qui, per mandarlo a mano se l'email non arriva. Vale per
// quell'indirizzo, una volta sola, per quattordici giorni.
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
  const [inviata, setInviata] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
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
      setInviata(json.inviata === true);
      setMotivo(json.motivo ?? null);
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
      setInviata(false);
      setMotivo(null);
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
            Mandiamo un&apos;email con il link a chi abita qui. Vale solo per l&apos;indirizzo che
            scrivi, una volta, per quattordici giorni.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col gap-3">
            {inviata ? (
              <p className="flex items-start gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
                <MailCheck className="mt-0.5 size-4 shrink-0" />
                Invito mandato a {email}. Se non lo trova, controlli lo spam, oppure mandagli tu
                il link qui sotto.
              </p>
            ) : (
              <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                L&apos;email non è partita{motivo ? ` (${motivo})` : ""}: manda tu il link a {email}.
              </p>
            )}
            <Label htmlFor="invite-link">Il link dell&apos;invito</Label>
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
              {loading ? <Loader2 className="animate-spin" /> : <Send />}
              Manda l&apos;invito
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
