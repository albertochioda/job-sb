import Image from "next/image";

// Logo brandizzato reale (public/logo.png, 1186×565, sfondo trasparente)
// + scritta "Job SB" accanto — usato in ogni header/nav dell'app invece
// di duplicare lo stesso markup in 10 file diversi. Nessuna variante
// dark: la dark mode non è attiva da nessuna parte nel progetto oggi
// (verificato: nessun ThemeProvider/next-themes installato).
export default function Logo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Image
        src="/logo.png"
        alt=""
        width={1186}
        height={565}
        className={className}
        priority
      />
      <span className="font-semibold text-lg tracking-tight">Job SB</span>
    </span>
  );
}
