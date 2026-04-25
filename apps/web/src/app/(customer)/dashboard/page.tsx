'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useAuth } from '@/lib/auth-context';

// Dashboard quick-link tiles. Each entry navigates to its sidebar page —
// those pages are skeletons in v1 (PlaceholderPanel + roadmap status), so
// the user sees what's coming and where, instead of a dead "Coming soon"
// button. Casting `href as Route` to sidestep a Next 15 typed-routes
// false-positive on string-literal unions in dashboard pages.
const TILES = [
  {
    href: '/domains',
    title: 'My domains',
    desc: 'Search, register, and manage DNS + SSL for your domains.',
    cta: 'Open domains',
  },
  {
    href: '/hosting',
    title: 'Hosting',
    desc: 'Provision and manage cloud servers across our locations.',
    cta: 'Open hosting',
  },
  {
    href: '/tickets',
    title: 'Support',
    desc: 'Open a ticket or check the status of existing requests.',
    cta: 'Open tickets',
  },
] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null; // layout handles loading / redirect

  return (
    <>
      <h1 className="text-3xl font-semibold">
        Welcome, {user.fullName ?? user.email}
      </h1>
      <p className="mt-2 text-octera-muted">
        Your Octera self-care dashboard. Manage your domains, hosting, SSL
        certificates, email, invoices, and support tickets from the sidebar.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {TILES.map((item) => (
          <Link
            key={item.href}
            href={item.href as Route}
            className="card transition hover:border-octera-cyan/60"
          >
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm text-octera-muted">{item.desc}</p>
            <span className="btn-ghost mt-4 inline-block w-full text-center">
              {item.cta} →
            </span>
          </Link>
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
            <dd className="font-mono uppercase tracking-wider text-octera-cyan">
              {user.role}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-octera-muted">User ID</dt>
            <dd className="font-mono text-xs text-octera-muted">{user.id}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
