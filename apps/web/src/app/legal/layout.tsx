import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

/**
 * Shared layout for /legal/* pages.
 *
 * Intentionally minimal — these pages are read, not interacted with. Top bar
 * with logo + back-to-home, centered readable-width content, cross-links to
 * the other three legal docs at the bottom.
 */

const LEGAL_LINKS: Array<{ href: '/legal/terms' | '/legal/privacy' | '/legal/aup' | '/legal/cookies'; label: string }> = [
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/aup', label: 'Acceptable Use' },
  { href: '/legal/cookies', label: 'Cookies' },
];

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-octera-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Back to homepage">
            <Logo />
          </Link>
          <Link
            href="/"
            className="text-sm text-octera-muted transition hover:text-octera-cyan"
          >
            ← Back to octera.net
          </Link>
        </div>
      </header>

      <article className="prose-octera mx-auto max-w-3xl px-6 py-12">
        {children}
      </article>

      <footer className="border-t border-octera-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-octera-muted">
          <nav className="flex flex-wrap gap-4">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition hover:text-octera-cyan"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <span>&copy; {new Date().getFullYear()} Octera</span>
        </div>
      </footer>
    </div>
  );
}
