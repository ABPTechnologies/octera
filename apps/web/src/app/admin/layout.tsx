'use client';

/**
 * /admin/* layout — redirects non-admins to the regular dashboard.
 *
 * Authorization is also enforced server-side on every /v1/vco/* endpoint via
 * requireRole(ADMIN). This client-side guard just keeps non-admins from ever
 * seeing a flash of operator UI before their API calls would 403.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth-context';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-octera-muted">Loading operator console…</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-octera-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-4 text-sm md:flex">
              <Link
                href="/admin/vco"
                className="text-octera-muted transition hover:text-octera-cyan"
              >
                Operator
              </Link>
              <Link
                href="/dashboard"
                className="text-octera-muted transition hover:text-octera-cyan"
              >
                Customer view
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded border border-octera-cyan/40 bg-octera-cyan/10 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-octera-cyan">
              admin
            </span>
            <span className="text-sm text-octera-muted">{user.email}</span>
            <button onClick={logout} className="btn-ghost">
              Log out
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
