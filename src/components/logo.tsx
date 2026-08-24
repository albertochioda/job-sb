import Image from "next/image";

// Logo brandizzato reale (public/logo.png, 1186×565, sfondo trasparente)
// + scritta "Job Search Bridge" accanto — usato in ogni header/nav dell'app invece
// di duplicare lo stesso markup in 10 file diversi. Nessuna variante
// dark: la dark mode non è attiva da nessuna parte nel progetto oggi
// (verificato: nessun ThemeProvider/next-themes installato).
// `stacked`: testo centrato SOTTO il logo invece che affiancato — usato solo
// nelle pagine di autenticazione/onboarding (login/registrazione/onboarding),
// mai nell'header della landing o della dashboard, che restano affiancati
// come sempre (default invariato).
export default function Logo({ className = "h-6 w-auto", stacked = false }: { className?: string; stacked?: boolean }) {
  return (
    <span className={`flex items-center ${stacked ? "flex-col" : "gap-2"}`}>
      <Image
        src="/logo.png"
        alt=""
        width={1186}
        height={565}
        className={className}
        priority
      />
      <span className={`font-semibold text-lg tracking-tight ${stacked ? "mt-2" : ""}`}>Job Search Bridge</span>
    </span>
  );
}
