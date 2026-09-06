"use client";

import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteResidentButtonProps {
  unitaId: string;
  interno: number;
  currentEmail: string | null;
}

export function InviteResidentButton({ unitaId, interno, currentEmail }: InviteResidentButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleInvite() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/invite-resident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitaId, email }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Invito fallito");
      setMessage({ type: "success", text: "Invito inviato con successo." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Errore" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Mail className="size-3.5" />
        Invita condomino
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invita condomino — Interno {interno}</DialogTitle>
          <DialogDescription>
            Verrà inviata un&apos;email con un link per creare l&apos;account e accedere alla
            propria area riservata.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-email">Email condomino</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@esempio.it"
          />
        </div>
        {message && (
          <p className={message.type === "success" ? "text-sm text-success" : "text-sm text-destructive"}>
            {message.text}
          </p>
        )}
        <DialogFooter>
          <Button onClick={handleInvite} disabled={loading || !email}>
            {loading ? <Loader2 className="animate-spin" /> : <Send />}
            Invia invito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
