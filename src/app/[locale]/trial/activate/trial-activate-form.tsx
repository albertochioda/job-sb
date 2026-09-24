"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid";

// Logica di updateUser({password}) COPIATA da reset-password-form.tsx, non
// condivisa/importata — per esplicita richiesta: quel componente resta
// invariato, questo è un percorso a sé, anche se il pezzo di validazione
// password è identico. Un cambiamento futuro a uno dei due non deve
// rischiare di toccare l'altro per errore.
function isPasswordValid(password: string): boolean {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

export default function TrialActivateForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // setState avvolto in una funzione async invocata dall'effect (non
    // chiamato in modo sincrono nel corpo dell'effect stesso) — richiesto da
    // react-hooks/set-state-in-effect, anche per il ramo che non fa alcuna
    // await prima di aggiornare lo stato.
    let cancelled = false;

    async function checkSession() {
      // Il frammento (#access_token=...&refresh_token=...) non arriva mai al
      // server — va letto SOLO qui, lato client, appena la pagina monta. Se
      // manca del tutto, il link non è dei nostri (o è già stato "ripulito"
      // da un caricamento precedente): nessun bisogno di interpellare Supabase.
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (!accessToken || !refreshToken) {
        if (!cancelled) setStatus("invalid");
        return;
      }

      const supabase = createClient();
      // NON basta aspettare detectSessionInUrl: createBrowserClient() di
      // @supabase/ssr usa flowType "pkce" di default, quindi il suo
      // rilevamento automatico dell'URL cerca "?code=" nella query string,
      // non "#access_token=" nel frammento — un magic link generato lato
      // server (admin.generateLink(), flusso implicito, nessun browser
      // coinvolto) viene quindi ignorato in silenzio. Bisogna passare i
      // token estratti dal frammento a setSession() esplicitamente.
      const { data, error: sessErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (cancelled) return;
      if (sessErr || !data.session) {
        setStatus("invalid");
        return;
      }
      // Ripulisce l'URL dal frammento (contiene i token in chiaro) senza
      // ricaricare la pagina — non li lascia visibili nella barra degli
      // indirizzi né nella cronologia del browser.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setStatus("ready");
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isPasswordValid(password)) {
      setError("La password deve contenere almeno 8 caratteri, con almeno una lettera e un numero.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    // A differenza di reset-password-form.tsx: NESSUN signOut() qui — la
    // sessione stabilita dal frammento resta valida, l'utente prosegue
    // direttamente nell'onboarding senza un giro di login in più.
    router.push(`/${locale}/onboarding`);
  }

  if (status === "checking") {
    return <p className="text-center text-sm text-muted-foreground">Verifica del link in corso…</p>;
  }

  if (status === "invalid") {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-destructive flex items-center justify-center gap-1.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Questo link non è valido o è scaduto.
        </p>
        <p className="text-sm text-muted-foreground">
          Se hai appena pagato il Trial, controlla di aver usato il link più recente ricevuto via email — ogni link è utilizzabile una sola volta.
        </p>
        <Link href={`/${locale}/login`} className="text-sm underline text-foreground">
          Vai alla pagina di accesso
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Nuova password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full border rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Minimo 8 caratteri, con almeno una lettera e un numero.</p>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Conferma password</label>
        <input
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "..." : "Imposta password e continua"}
      </button>
    </form>
  );
}
