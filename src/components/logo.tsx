import Image from "next/image";

// Logo brandizzato reale (public/logo.png, 1186×565, sfondo trasparente)
// al posto del testo "Job SB" — usato in ogni header/nav dell'app invece
// di duplicare lo stesso <Image> in 10 file diversi. Nessuna variante
// dark: la dark mode non è attiva da nessuna parte nel progetto oggi
// (verificato: nessun ThemeProvider/next-themes installato).
export default function Logo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Job SB"
      width={1186}
      height={565}
      className={className}
      priority
    />
  );
}
