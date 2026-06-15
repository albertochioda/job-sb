"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  locale: string;
  label: string;
}

export default function LogoutButton({ locale, label }: Props) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-muted-foreground hover:text-foreground underline"
    >
      {label}
    </button>
  );
}
