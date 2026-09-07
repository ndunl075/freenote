"use client";

import { MotionConfig } from "framer-motion";
import { Library as LibraryIcon, Monitor, Moon, Settings as SettingsIcon, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useTheme, type ThemeChoice } from "@/components/theme/ThemeProvider";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/", label: "Library", icon: LibraryIcon, match: (p: string) => p === "/" },
  { href: "/settings", label: "Settings", icon: SettingsIcon, match: (p: string) => p.startsWith("/settings") },
];

/**
 * The frame every top-level page sits in: wordmark, primary navigation, theme
 * toggle. `MotionConfig reducedMotion="user"` here means every Framer Motion
 * animation below honours the OS "reduce motion" setting without each
 * component having to check.
 */
export function AppShell({
  children,
  leading,
  className,
}: {
  children: ReactNode;
  /** Slot before the wordmark — the library puts its sidebar toggle here. */
  leading?: ReactNode;
  className?: string;
}) {
  const pathname = usePathname() ?? "/";

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
        <a
          href="#main"
          className="sr-only z-50 rounded-[8px] bg-[var(--brand)] px-4 py-2 font-bold text-[var(--brand-ink)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>

        <header
          className="sticky top-0 z-40 border-b border-[var(--border-soft)] backdrop-blur-md"
          style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}
        >
          <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-1 px-2 sm:gap-2 sm:px-4">
            {leading}

            <Link
              href="/"
              className="flex items-center gap-2 rounded-[8px] px-1.5 py-1 transition-colors hover:bg-[var(--surface-2)]"
              aria-label="freenote home"
            >
              <Image src="/icon.svg" alt="" width={28} height={28} priority className="rounded-[7px]" />
              <span className="text-[19px] font-extrabold tracking-[-0.02em]">freenote</span>
            </Link>

            <nav aria-label="Primary" className="ml-1 hidden items-center gap-0.5 sm:flex">
              {NAV.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[14px] font-bold transition-colors",
                      active
                        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
                    )}
                  >
                    <item.icon aria-hidden className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-0.5">
              <nav aria-label="Primary" className="flex items-center sm:hidden">
                {NAV.map((item) => {
                  const active = item.match(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={item.label}
                      title={item.label}
                      className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                        active
                          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
                      )}
                    >
                      <item.icon aria-hidden className="h-5 w-5" />
                    </Link>
                  );
                })}
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main id="main" className={cn("flex flex-1 flex-col", className)}>
          {children}
        </main>
      </div>
    </MotionConfig>
  );
}

const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const THEME_LABEL: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };

export function ThemeToggle() {
  const choice = useTheme((s) => s.choice);
  const set = useTheme((s) => s.set);
  const Icon = choice === "light" ? Sun : choice === "dark" ? Moon : Monitor;
  return (
    <IconButton
      label={`Theme: ${THEME_LABEL[choice]} — switch to ${THEME_LABEL[NEXT_THEME[choice]]}`}
      onClick={() => set(NEXT_THEME[choice])}
    >
      <Icon />
    </IconButton>
  );
}
