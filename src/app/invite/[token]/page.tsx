"use client";

// Dove si arriva dal link d'invito.
//
// Il link porta un token, non l'id di un'unità. La pagina chiede al server per
// chi è l'invito e per quale condominio; chi ha già fatto l'accesso lo accetta
// subito, chi no entra o si registra con l'indirizzo invitato, e l'invito si
// accetta appena l'accesso riesce. Il collegamento lo fa il server: prima lo
// faceva il browser, e la RLS lo bloccava senza dirlo a nessuno.

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MINIMA } from "@/lib/password";

type Stato = "verifica" | "accesso" | "altro-account" | "conferma-email" | "accettazione" | "errore";

const stessaEmail = (a: string | undefined, b: string) =>
  (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [stato, setStato] = useState<Stato>("verifica");
  const [email, setEmail] = useState("");
  const [condominio, setCondominio] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [lavorando, setLavorando] = useState(false);
  // Chi ha già fatto l'accesso con un altro indirizzo: capita a chi prova il
  // link sul proprio computer, o a chi riceve l'invito su un'email diversa da
  // quella con cui è già iscritto.
  const [entratoCome, setEntratoCome] = useState("");

  const accetta = useCallback(async () => {
    setStato("accettazione");
    const res = await fetch("/api/accetta-invito", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const json = await res.json();
    if (!json.success) {
      setErrore(json.error || "Invito non accettato");
      setStato("errore");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }, [token, router]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/invito?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!json.success) {
        setErrore(json.error || "Invito non valido");
        setStato("errore");
        return;
      }
      setEmail(json.email);
      setCondominio(json.condominio);

      const { data } = await createClient().auth.getUser();
      if (!data.user) {
        setStato("accesso");
      } else if (stessaEmail(data.user.email, json.email)) {
        await accetta();
      } else {
        // Prima si provava ad accettare lo stesso: il server rifiutava, e la
        // pagina restava su un messaggio d'errore senza via d'uscita.
        setEntratoCome(data.user.email ?? "");
        setStato("altro-account");
      }
    })();
  }, [token, accetta]);

  async function entra(e: React.FormEvent<HTMLFormElement>, nuovo: boolean) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    setLavorando(true);
    setErrore(null);

    const supabase = createClient();
    if (nuovo) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Se Supabase chiede di confermare l'indirizzo, il link di conferma
        // riporta qui, e l'invito si accetta al ritorno.
        options: { emailRedirectTo: window.location.href },
      });
      setLavorando(false);
      if (error) {
        setErrore(error.message);
        return;
      }
      if (!data.session) {
        setStato("conferma-email");
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLavorando(false);
      if (error) {
        setErrore("Password non corretta. Se non hai ancora un account, crealo qui sotto.");
        return;
      }
    }
    await accetta();
  }

  async function cambiaAccount() {
    setLavorando(true);
    await createClient().auth.signOut();
    setLavorando(false);
    setEntratoCome("");
    setStato("accesso");
  }

  if (stato === "verifica" || stato === "accettazione") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold">
            {process.env.NEXT_PUBLIC_APP_NAME || "Condominiak"}
          </h1>
          {condominio && (
            <p className="text-center text-sm text-muted-foreground">
              Sei stato invitato nel condominio di {condominio}.
            </p>
          )}
        </div>

        <Card>
          {stato === "errore" && (
            <CardContent className="py-6">
              <Alert variant="destructive">
                <AlertDescription>{errore}</AlertDescription>
              </Alert>
            </CardContent>
          )}

          {stato === "altro-account" && (
            <>
              <CardHeader>
                <CardTitle>Sei entrato con un altro account</CardTitle>
                <CardDescription>
                  Ora sei <strong>{entratoCome}</strong>, ma l&apos;invito è per{" "}
                  <strong>{email}</strong>. Esci da questo account per accettarlo con
                  l&apos;indirizzo giusto: potrai entrare con la sua password o crearne una.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button onClick={cambiaAccount} disabled={lavorando}>
                  {lavorando && <Loader2 className="animate-spin" />}
                  Esci e continua come {email}
                </Button>
                <Button variant="ghost" onClick={() => router.push("/dashboard")} disabled={lavorando}>
                  Resta come {entratoCome}
                </Button>
              </CardContent>
            </>
          )}

          {stato === "conferma-email" && (
            <CardContent className="py-6 text-sm">
              Ti abbiamo mandato un&apos;email a <strong>{email}</strong> per confermare
              l&apos;indirizzo. Il link ti riporta qui, e l&apos;invito si accetta da solo.
            </CardContent>
          )}

          {stato === "accesso" && (
            <>
              <CardHeader>
                <CardTitle>Entra per accettare l&apos;invito</CardTitle>
                <CardDescription>
                  L&apos;invito è per <strong>{email}</strong>: si accetta con questo indirizzo.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {errore && (
                  <Alert variant="destructive">
                    <AlertDescription>{errore}</AlertDescription>
                  </Alert>
                )}
                <form onSubmit={(e) => entra(e, false)} className="flex flex-col gap-3">
                  <Label htmlFor="password-accesso">Hai già un account? La tua password</Label>
                  <Input id="password-accesso" name="password" type="password" required />
                  <Button type="submit" disabled={lavorando}>
                    {lavorando && <Loader2 className="animate-spin" />}
                    Entra e accetta
                  </Button>
                </form>
                <form onSubmit={(e) => entra(e, true)} className="flex flex-col gap-3 border-t pt-6">
                  <Label htmlFor="password-nuova">Non hai un account? Scegli una password</Label>
                  <Input id="password-nuova" name="password" type="password" required minLength={PASSWORD_MINIMA} />
                  <Button type="submit" variant="outline" disabled={lavorando}>
                    {lavorando && <Loader2 className="animate-spin" />}
                    Crea l&apos;account e accetta
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
