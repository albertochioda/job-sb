"use client";

import { useEffect, useState } from "react";

function computeGreeting(name: string): string {
  const suffix = name ? `, ${name}` : "";
  const now = new Date();
  const hour = now.getHours();
  const isFriday = now.getDay() === 5;

  // Idea originale di Valentina: il venerdì pomeriggio/sera sostituisce il
  // saluto orario normale, non si somma.
  if (isFriday && hour >= 12 && hour <= 22) return `Buon venerdì${suffix}!`;
  if (hour >= 5 && hour <= 11) return `Buongiorno${suffix}!`;
  if (hour >= 18 && hour <= 22) return `Buonasera${suffix}!`;
  // Pomeriggio (12-17) e notte (23-4): "buonanotte" suonerebbe strano per
  // chi sta usando l'app in quel momento, quindi resta il saluto neutro.
  return `Ciao${suffix}!`;
}

export default function DashboardGreeting({ firstName }: { firstName?: string }) {
  const name = firstName ?? "";
  // Il fallback deve coincidere col primo render client (prima che l'effect
  // giri) per evitare un mismatch di idratazione — l'ora del server non è
  // quella del browser dell'utente, quindi il calcolo vero avviene solo qui.
  const [greeting, setGreeting] = useState(`Ciao${name ? `, ${name}` : ""}!`);

  useEffect(() => {
    setGreeting(computeGreeting(name));
  }, [name]);

  return <h1 className="text-2xl font-bold">{greeting}</h1>;
}
