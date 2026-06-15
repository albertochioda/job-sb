"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Props {
  locale: string;
  t: Record<string, string>;
}

export default function RegisterForm({ locale, t }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message && error.message !== "{}" ? error.message : "Registrazione fallita. Riprova.");
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-2">
        <p className="text-green-700 font-medium">{t.emailSent}</p>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">{t.fullName}</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">{t.email}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">{t.password}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "..." : t.registerLink}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        {t.alreadyAccount}{" "}
        <Link href={`/${locale}/login`} className="underline text-foreground">
          {t.loginLink}
        </Link>
      </p>
    </form>
  );
}
