"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import Logo from "@/components/logo";
import LogoutButton from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface DashboardNavLink {
  href: string;
  label: string;
  active?: boolean;
}

interface DashboardNavProps {
  locale: string;
  links: DashboardNavLink[];
}

// Nav condivisa da tutte le pagine dashboard: desktop invariata (link
// orizzontali), mobile sostituisce i link con un hamburger + Sheet
// laterale — il logo non condivide mai lo spazio con i link, a nessuna
// larghezza (prima si comprimeva/sovrapponeva sotto ~640px).
export default function DashboardNav({ locale, links }: DashboardNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b">
      <Logo />

      <div className="hidden md:flex items-center gap-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={link.active ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground hover:text-foreground"}
          >
            {link.label}
          </Link>
        ))}
        <LogoutButton locale={locale} label="Esci" />
      </div>

      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Apri menu">
                <Menu className="size-5" />
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={
                    link.active
                      ? "rounded-md px-3 py-2 text-sm font-medium text-foreground bg-muted"
                      : "rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                  }
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 border-t pt-3 px-3">
                <LogoutButton locale={locale} label="Esci" />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
