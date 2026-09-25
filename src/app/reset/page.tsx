"use client";

// Dove si atterra cliccando il link di recupero password.
//
// Senza questa pagina il link arrivava da qualche parte che non sapeva cosa
// farsene, e chi aveva dimenticato la password restava fuori: l'unico modo di
// rientrare era passare dalla console di Supabase. Per un amministratore è
// scomodo, per un condomino invitato è un muro.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MINIMA } from "@/lib/password";

// Lo stesso stato in cui può trovarsi chi arriva qui: stiamo ancora leggendo
// il link, il link vale, il link non vale più.
type Stato = "verifica" | "pronto" | "scaduto";

export default function ResetPage() {
  const router = useRouter();
  const [stato, setStato] = useState<Stato>("verifica");
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Il link di recupero apre una sessione limitata: se c'è, il link è
    // valido. Si ascoltano tutti e due i modi in cui può comparire — già
    // pronta al primo controllo, o creata subito dopo dallo scambio del
    // codice che sta nell'indirizzo.
    const { data: sottoscrizione } = supabase.auth.onAuthStateChange((_evento, sessione) => {
      if (sessione) setStato("pronto");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStato("pronto");
        return;
      }
      // Lo scambio del codice non è istantaneo: si concede un momento prima
      // di dichiarare scaduto un link che invece sta funzionando.
      setTimeout(() => setStato((corrente) => (corrente === "verifica" ? "scaduto" : corrente)), 2500);
    });

    return () => sottoscrizione.subscription.unsubscribe();
  }, []);

  async function salva(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;

    setLoading(true);
    setErrore(null);

    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrore(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scegli una nuova password</CardTitle>
            <CardDescription>
              Vale da subito: la prossima volta entri con questa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stato === "verifica" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Controllo il link…
              </p>
            )}

            {stato === "scaduto" && (
              <Alert variant="destructive">
                <AlertDescription>
                  Questo link non è più valido — è scaduto, o è già stato usato. Torna alla pagina
                  di accesso e richiedine un altro.
                </AlertDescription>
              </Alert>
            )}

            {stato === "pronto" && (
              <form onSubmit={salva} className="flex flex-col gap-4">
                {errore && (
                  <Alert variant="destructive">
                    <AlertDescription>{errore}</AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Nuova password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={PASSWORD_MINIMA}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Almeno {PASSWORD_MINIMA} caratteri.
                  </p>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  Salva ed entra
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
