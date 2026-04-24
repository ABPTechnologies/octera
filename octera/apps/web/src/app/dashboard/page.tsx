'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const router = useRouter();
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
    <main className="min-h-screen">
      <header className="border-b border-octera-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
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

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Welcome, {user.fullName ?? user.email}</h1>
        <p className="mt-2 text-octera-muted">
          This dashboard is a placeholder. The v1 self-care, domain management, and admin
          surfaces will live here. See <code className="rounded bg-octera-surface px-1.5 py-0.5 text-octera-cyan">CLAUDE.md</code>{' '}
          for the build plan.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { title: 'My domains', desc: 'Search, register, manage DNS & SSL.', cta: 'Coming soon' },
            { title: 'Hosting', desc: 'Provision and manage cloud servers.', cta: 'Coming soon' },
            { title: 'Marketplace', desc: 'Buy, sell, and broker premium domains.', cta: 'Coming soon' },
          ].map((item) => (
            <div key={item.title} className="card">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-octera-muted">{item.desc}</p>
              <button className="btn-ghost mt-4 w-full cursor-not-allowed opacity-60" disabled>
                {item.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="card mt-8">
          <h2 className="text-lg font-semibold">Account</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-octera-muted">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-octera-muted">Role</dt>
              <dd className="font-mono uppercase tracking-wider text-octera-cyan">{user.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-octera-muted">User ID</dt>
              <dd className="font-mono text-xs text-octera-muted">{user.id}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
