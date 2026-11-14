import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Racing Machine" },
      {
        name: "description",
        content: "Inicia sesión para consultar el inventario del taller.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      await navigate({ to: "/" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesión. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesión con Google.",
      );
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Accede al taller
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inicia sesión para consultar el inventario y guardar tus órdenes.
          </p>
        </div>
        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={busy}
          onClick={() => void signInWithGoogle()}
        >
          Continuar con Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          o con correo y contraseña
          <span className="h-px flex-1 bg-border" />
        </div>
        <form className="space-y-4" onSubmit={(event) => void signIn(event)}>
          <div className="space-y-2">
            <Label htmlFor="login-email">Correo</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Contraseña</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? "Iniciando sesión…" : "Iniciar sesión"}
          </Button>
        </form>
        <Link
          to="/"
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Volver a órdenes
        </Link>
      </section>
    </main>
  );
}
