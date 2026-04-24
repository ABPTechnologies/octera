'use client';

/**
 * VCO operator dashboard.
 *
 * Consumes /v1/vco/* on the Octera API, which in turn proxies to gig.tech.
 * All data fetching happens through our own API — the gig.tech partner
 * credential never leaves the server.
 *
 * The page shows:
 *  - Connection status (mock vs live) — a clear signal to the operator when
 *    they're looking at fixture data vs. real cloud state.
 *  - VCO identity summary (who the operator is, which VCO, contact info).
 *  - Customer tenants list — click-through for the eventual per-customer
 *    detail page (cloudspaces, VMs, certs).
 *  - Location inventory.
 *
 * Pages are deliberately read-only for v1. Mutating actions (provision a
 * cloudspace, renew a cert) land once we have a real partner credential.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type {
  VcoCustomer,
  VcoLocation,
  VcoMe,
  VcoStatus,
} from '@octera/shared';

interface DashboardData {
  status: VcoStatus;
  me: VcoMe;
  customers: VcoCustomer[];
  locations: VcoLocation[];
}

export default function VcoOperatorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [status, me, customersRes, locationsRes] = await Promise.all([
          api<VcoStatus>('/v1/vco/status'),
          api<VcoMe>('/v1/vco/me'),
          api<{ customers: VcoCustomer[] }>('/v1/vco/customers'),
          api<{ locations: VcoLocation[] }>('/v1/vco/locations'),
        ]);
        if (cancelled) return;
        setData({
          status,
          me,
          customers: customersRes.customers,
          locations: locationsRes.locations,
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(`${err.code}: ${err.message}`);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error loading VCO data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-octera-muted">Loading operator view…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="card border-red-500/40 bg-red-500/5">
          <h2 className="text-lg font-semibold text-red-400">
            Couldn&apos;t load operator data
          </h2>
          <p className="mt-2 text-sm text-octera-muted">
            {error ?? 'Unknown error'}
          </p>
          <p className="mt-2 text-xs text-octera-muted">
            If this says <code>upstream_auth_failed</code>, the gig.tech
            partner credential needs fixing. Check the API logs and{' '}
            <code>GIGTECH_JWT</code> in <code>.env</code>.
          </p>
        </div>
      </main>
    );
  }

  const { status, me, customers, locations } = data;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {/* ---- Page header + connection badge ---- */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Operator console</h1>
          <p className="mt-1 text-sm text-octera-muted">
            VCO-level view of Octera infrastructure. All read-only in v1.
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* ---- VCO identity ---- */}
      <section className="card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{me.vco_name ?? 'Unknown VCO'}</h2>
            {me.vco_website && (
              <p className="mt-1 text-sm text-octera-muted">
                <a
                  href={`https://${me.vco_website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-octera-cyan hover:underline"
                >
                  {me.vco_website}
                </a>
              </p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <dt className="text-octera-muted">Operator</dt>
            <dd className="font-mono">
              {me.firstname} {me.lastname}
            </dd>
            <dt className="text-octera-muted">Email</dt>
            <dd className="font-mono">{me.email}</dd>
            <dt className="text-octera-muted">Support contact</dt>
            <dd className="font-mono">{me.vco_support_email ?? '—'}</dd>
            <dt className="text-octera-muted">IAM domain</dt>
            <dd className="font-mono">{me.iam_domain ?? '—'}</dd>
          </dl>
        </div>
      </section>

      {/* ---- Two-column: customers + locations ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Customers */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Customers{' '}
              <span className="ml-2 text-sm font-normal text-octera-muted">
                ({customers.length})
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {customers.map((c) => (
              <Link
                key={c.customer_id}
                href={`/admin/vco/customers/${encodeURIComponent(c.customer_id)}`}
                className="card transition hover:border-octera-cyan/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  {c.status && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-mono uppercase tracking-wider ${
                        c.status.toLowerCase() === 'active'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-octera-surface text-octera-muted'
                      }`}
                    >
                      {c.status}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-octera-muted">
                  {c.customer_id}
                </p>
                {c.contact_name && (
                  <p className="mt-2 text-sm">{c.contact_name}</p>
                )}
                {c.email && (
                  <p className="text-xs text-octera-muted">{c.email}</p>
                )}
                {c.billable !== undefined && (
                  <p className="mt-2 text-xs text-octera-muted">
                    {c.billable ? 'Billable' : 'Non-billable'}
                    {c.show_prices ? ' · Prices visible' : ''}
                  </p>
                )}
              </Link>
            ))}
            {customers.length === 0 && (
              <p className="text-sm text-octera-muted">
                No customers visible to this credential.
              </p>
            )}
          </div>
        </section>

        {/* Locations */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Locations{' '}
            <span className="ml-2 text-sm font-normal text-octera-muted">
              ({locations.length})
            </span>
          </h2>
          <div className="space-y-3">
            {locations.map((l) => (
              <div key={l.name} className="card">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-mono text-sm font-semibold">{l.name}</h3>
                  {l.is_freemium && (
                    <span className="rounded bg-octera-surface px-1.5 py-0.5 font-mono text-xs text-octera-muted">
                      freemium
                    </span>
                  )}
                </div>
                {l.datacenter && (
                  <p className="mt-1 text-sm">
                    {l.datacenter.name ?? l.datacenter.code}
                    {l.datacenter.city && `, ${l.datacenter.city}`}
                    {l.datacenter.country && `, ${l.datacenter.country}`}
                  </p>
                )}
              </div>
            ))}
            {locations.length === 0 && (
              <p className="text-sm text-octera-muted">
                No locations available.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: VcoStatus }) {
  const isMock = status.mode === 'mock';
  return (
    <div
      className={`flex flex-col items-end rounded-lg border px-3 py-2 ${
        isMock
          ? 'border-amber-500/40 bg-amber-500/5 text-amber-400'
          : 'border-green-500/40 bg-green-500/5 text-green-400'
      }`}
    >
      <span className="font-mono text-xs uppercase tracking-wider">
        {isMock ? 'Mock mode' : 'Live'}
      </span>
      <span className="mt-1 text-xs text-octera-muted">
        {status.api_base}
      </span>
    </div>
  );
}
