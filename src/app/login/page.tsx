"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [recupero, setRecupero] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError("Credenziali non valide. Riprova.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  // Chi ha dimenticato la password non aveva nessuna strada: si rientrava solo
  // dalla console di Supabase, cioè non si rientrava. Il link porta a /reset,
  // sullo stesso indirizzo da cui è stato chiesto — così funziona anche dalle
  // anteprime di deploy, dove il dominio non è quello di produzione.
  async function handleRecupero(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const email = new FormData(e.currentTarget).get("email") as string;
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Non si conferma né si smentisce che l'indirizzo esista: dirlo
    // permetterebbe a chiunque di scoprire chi ha un account.
    setInfo(
      "Se quell'indirizzo ha un account, gli è appena arrivata una mail con il link per " +
        "scegliere una nuova password. Controlla anche lo spam."
    );
    setRecupero(false);
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setInfo("Registrazione completata! Controlla la tua email per confermare l'account.");
    }
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
          <p className="text-sm text-muted-foreground">
            La gestione digitale del tuo condominio
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Accedi al tuo account</CardTitle>
            <CardDescription>Amministratori e condomini</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="login">Accedi</TabsTrigger>
                <TabsTrigger value="register">Registrati</TabsTrigger>
              </TabsList>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {info && (
                <Alert variant="success" className="mb-4">
                  <AlertDescription>{info}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required placeholder="nome@esempio.it" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" required />
                  </div>
                  <Button type="submit" disabled={loading} className="mt-2">
                    {loading && <Loader2 className="animate-spin" />}
                    Accedi
                  </Button>
                </form>

                {recupero ? (
                  <form onSubmit={handleRecupero} className="mt-4 flex flex-col gap-3 border-t pt-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="recupero-email">
                        A quale indirizzo mandiamo il link?
                      </Label>
                      <Input
                        id="recupero-email"
                        name="email"
                        type="email"
                        required
                        placeholder="nome@esempio.it"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="submit" variant="outline" size="sm" disabled={loading}>
                        {loading && <Loader2 className="animate-spin" />}
                        Mandami il link
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRecupero(false)}
                      >
                        Annulla
                      </Button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRecupero(true)}
                    className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Password dimenticata?
                  </button>
                )}
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" name="email" type="email" required placeholder="nome@esempio.it" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input id="reg-password" name="password" type="password" required minLength={6} />
                  </div>
                  <Button type="submit" disabled={loading} className="mt-2">
                    {loading && <Loader2 className="animate-spin" />}
                    Crea account amministratore
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
