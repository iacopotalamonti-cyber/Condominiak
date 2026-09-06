"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token: unitaId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyLinked, setAlreadyLinked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        // Utente già autenticato via magic link: linka subito l'unità
        const { error } = await supabase
          .from("unita")
          .update({ user_id: data.user.id })
          .eq("id", unitaId);
        if (!error) {
          setAlreadyLinked(true);
          router.push("/dashboard/appartamento");
          router.refresh();
          return;
        }
      }
      setChecking(false);
    });
  }, [unitaId, router]);

  async function handleSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    const supabase = createClient();
    const { data: userData, error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr || !userData.user) {
      setError(updateErr?.message ?? "Errore durante l'impostazione della password");
      setLoading(false);
      return;
    }

    const { error: linkErr } = await supabase
      .from("unita")
      .update({ user_id: userData.user.id })
      .eq("id", unitaId);

    setLoading(false);
    if (linkErr) {
      setError("Impossibile collegare l'unità immobiliare");
      return;
    }

    router.push("/dashboard/appartamento");
    router.refresh();
  }

  if (checking || alreadyLinked) {
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
          <h1 className="text-2xl font-semibold">Benvenuto su CondoTwin</h1>
          <p className="text-center text-sm text-muted-foreground">
            Sei stato invitato dall&apos;amministratore. Imposta una password per accedere
            alla tua area riservata.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Completa la registrazione</CardTitle>
            <CardDescription>Imposta la password del tuo account</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Nuova password</Label>
                <Input id="password" name="password" type="password" required minLength={6} />
              </div>
              <Button type="submit" disabled={loading} className="mt-2">
                {loading && <Loader2 className="animate-spin" />}
                Conferma e accedi
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
