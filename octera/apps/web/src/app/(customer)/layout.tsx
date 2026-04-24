'use client';

/**
 * Customer-side layout.
 *
 * Wraps all the self-care surfaces (/dashboard, /domains, /hosting, /ssl,
 * /email, /invoices, /tickets, /settings) with:
 *
 * - A shared header with logo + (admin-only) link to operator console +
 *   user email + logout.
 * - A persistent left sidebar with nav links.
 * - An auth guard that redirects unauthenticated users to /login.
 *
 * The route group `(customer)` doesn't affect URLs — it just shares this
 * layout across all children. Admins can still visit customer-side pages
 * (to test the end-user experience); we only redirect them if they're
 * trying to visit the admin console as non-admins, which happens in
 * /app/admin/layout.tsx.
 */

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Globe,
  Server,
  ShieldCheck,
  Mail,
  Receipt,
  LifeBuoy,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';

interface NavItem {
  href: '/dashboard' | '/domains' | '/hosting' | '/ssl' | '/email' | '/invoices' | '/tickets' | '/settings';
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/domains', label: 'Domains', icon: Globe },
  { href: '/hosting', label: 'Hosting', icon: Server },
  { href: '/ssl', label: 'SSL', icon: ShieldCheck },
  { href: '/email', label: 'Email', icon: Mail },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/tickets', label: 'Tickets', icon: LifeBuoy },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-octera-muted">Loading…</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ---- Top bar ---- */}
      <header className="border-b border-octera-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            {user.role === 'ADMIN' && (
              <Link
                href="/admin/vco"
                className="rounded border border-octera-cyan/40 bg-octera-cyan/10 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-octera-cyan transition hover:bg-octera-cyan/20"
              >
                Operator console →
              </Link>
            )}
            <span className="text-sm text-octera-muted">{user.email}</span>
            <button onClick={logout} className="btn-ghost">
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* ---- Body: sidebar + content ---- */}
      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8">
        <aside className="sticky top-8 hidden h-fit w-52 shrink-0 md:block">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition',
                    active
                      ? 'bg-octera-surface text-octera-cyan'
                      : 'text-octera-muted hover:bg-octera-surface hover:text-octera-fg'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
