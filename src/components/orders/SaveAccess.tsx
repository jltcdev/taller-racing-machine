import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function SaveAccess({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const passwordAction = async (reset = false) => {
    setBusy(true);
    setMessage("");
    try {
      const result = reset
        ? await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + "/reset-password",
          })
        : signup
          ? await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin },
            })
          : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (reset) setMessage("Revisa tu correo para restablecer tu contraseña.");
      else if (signup)
        setMessage(
          "Confirma tu correo y luego inicia sesión. Tus datos del formulario permanecen aquí.",
        );
      else onOpenChange(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo completar el acceso.",
      );
    } finally {
      setBusy(false);
    }
  };
  const social = async () => {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesión con Google.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Accede al taller</DialogTitle>
        <DialogDescription>
          Inicia sesión para guardar tus órdenes e historial de forma privada.
        </DialogDescription>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={social}
        >
          Continuar con Google
        </Button>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            passwordAction();
          }}
        >
          <div>
            <Label
              htmlFor="access-email"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Correo
            </Label>
            <Input
              id="access-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label
              htmlFor="access-password"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Contraseña
            </Label>
            <Input
              id="access-password"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button className="w-full" disabled={busy} type="submit">
            {busy ? "Procesando…" : signup ? "Crear cuenta" : "Iniciar sesión"}
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="link"
            disabled={busy}
            onClick={() => setSignup(!signup)}
          >
            {signup ? "Ya tengo cuenta" : "Crear cuenta"}
          </Button>
          <Button
            type="button"
            variant="link"
            disabled={!email || busy}
            onClick={() => passwordAction(true)}
          >
            Olvidé mi contraseña
          </Button>
        </div>
        {message && (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
