"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  LayoutDashboard,
  Map,
  Database,
  FileText,
  GraduationCap,
  Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BudgetMeter } from "@/components/budget-meter";
import { NeroLogo } from "@/components/nero-logo";

const LINKS = [
  { href: "/", label: "Chat / Guia", icon: MessageSquare },
  { href: "/estado", label: "Estado vivo", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/catalogo", label: "Catálogo", icon: Database },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/report", label: "Report", icon: FileText },
  { href: "/academia", label: "Academia", icon: GraduationCap },
];

export function TopNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <NeroLogo size={34} />
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">Nero</span>
            <span className="text-[11px] text-muted-foreground">Governança de Dados · LM</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          <BudgetMeter />
          <span className="hidden h-5 w-px bg-border sm:block" />
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
