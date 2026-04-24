'use client';

import { useAuth } from '@/lib/auth-context';

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
        {[
          {
            title: 'My domains',
            desc: 'Search, register, and manage DNS + SSL for your domains.',
            cta: 'Coming soon',
          },
          {
            title: 'Hosting',
            desc: 'Provision and manage cloud servers across our locations.',
            cta: 'Coming soon',
          },
          {
            title: 'Support',
            desc: 'Open a ticket or check the status of existing requests.',
            cta: 'Coming soon',
          },
        ].map((item) => (
          <div key={item.title} className="card">
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm text-octera-muted">{item.desc}</p>
            <button
              className="btn-ghost mt-4 w-full cursor-not-allowed opacity-60"
              disabled
            >
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
