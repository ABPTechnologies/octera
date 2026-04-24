'use client';

/**
 * VCO-wide audit log view.
 *
 * Pulls /v1/vco/audits and renders the same table shape as the per-customer
 * audit section, but spanning every customer. Adds a customer column since
 * there are now multiple represented.
 *
 * The path filter is client-side for now (mock dataset is small). When this
 * goes live we'll want server-side pagination + filter via the existing
 * username / status_code query params on the API.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { VcoAuditLog, VcoCustomer } from '@octera/shared';

interface Data {
  audits: VcoAuditLog[];
  customers: VcoCustomer[];
}

export default function VcoAuditsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [auditsRes, customersRes] = await Promise.all([
          api<{ audits: VcoAuditLog[] }>('/v1/vco/audits?limit=100'),
          api<{ customers: VcoCustomer[] }>('/v1/vco/customers'),
        ]);
        if (cancelled) return;
        setData({ audits: auditsRes.audits, customers: customersRes.customers });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(`${err.code}: ${err.message}`);
        else if (err instanceof Error) setError(err.message);
        else setError('Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const customerNameById = useMemo(() => {
    const m = new Map<string, string>();
    data?.customers.forEach((c) => m.set(c.customer_id, c.name));
    return m;
  }, [data?.customers]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.audits;
    return data.audits.filter((a) => {
      const customerName =
        a.customer_id ? customerNameById.get(a.customer_id) ?? '' : '';
      return (
        (a.username?.toLowerCase().includes(q) ?? false) ||
        (a.user_email?.toLowerCase().includes(q) ?? false) ||
        (a.user_name?.toLowerCase().includes(q) ?? false) ||
        (a.path?.toLowerCase().includes(q) ?? false) ||
        (a.method?.toLowerCase().includes(q) ?? false) ||
        customerName.toLowerCase().includes(q) ||
        (a.status_code !== undefined && a.status_code.toString().includes(q))
      );
    });
  }, [data, filter, customerNameById]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-octera-muted">Loading audit log…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="card border-red-500/40 bg-red-500/5">
          <h2 className="text-lg font-semibold text-red-400">Couldn&apos;t load audit log</h2>
          <p className="mt-2 text-sm text-octera-muted">{error ?? 'Unknown error'}</p>
          <p className="mt-3 text-xs">
            <Link href="/admin/vco" className="text-octera-cyan hover:underline">
              ← Back to operator console
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6">
        <Link
          href="/admin/vco"
          className="text-sm text-octera-muted transition hover:text-octera-cyan"
        >
          ← Operator console
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Audit log</h1>
          <p className="mt-1 text-sm text-octera-muted">
            Every API call across every customer tenant.{' '}
            {filter
              ? `${filtered.length} of ${data.audits.length} entries match.`
              : `${data.audits.length} recent entries.`}
          </p>
        </div>
        <div className="relative w-72 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-octera-muted" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by user, path, customer, status…"
            aria-label="Filter audits"
            className="w-full rounded-md border border-octera-border bg-octera-surface py-1.5 pl-8 pr-3 text-sm placeholder:text-octera-muted focus:border-octera-cyan/60 focus:outline-none"
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <p className="card text-sm text-octera-muted">
          {filter ? `No audit entries match "${filter}".` : 'No audit entries.'}
        </p>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-octera-border bg-octera-surface/50 text-octera-muted">
              <tr>
                <th className="px-4 py-2 text-left font-normal">When</th>
                <th className="px-4 py-2 text-left font-normal">Customer</th>
                <th className="px-4 py-2 text-left font-normal">User</th>
                <th className="px-4 py-2 text-left font-normal">Action</th>
                <th className="px-4 py-2 text-left font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-octera-border last:border-b-0">
                  <td
                    className="px-4 py-3 font-mono text-xs text-octera-muted"
                    title={new Date(a.timestamp * 1000).toISOString()}
                  >
                    {formatRelative(a.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {a.customer_id ? (
                      <Link
                        href={`/admin/vco/customers/${encodeURIComponent(a.customer_id)}`}
                        className="text-octera-cyan hover:underline"
                      >
                        {customerNameById.get(a.customer_id) ?? a.customer_id}
                      </Link>
                    ) : (
                      <span className="text-octera-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>{a.user_name ?? a.username ?? '—'}</div>
                    {a.user_email && (
                      <div className="text-xs text-octera-muted">{a.user_email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <span className="text-octera-cyan">{a.method ?? '—'}</span>{' '}
                    <span className="text-octera-muted">{a.path ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status_code !== undefined && (
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                          a.status_code >= 200 && a.status_code < 300
                            ? 'bg-green-500/15 text-green-400'
                            : a.status_code >= 400 && a.status_code < 500
                              ? 'bg-amber-500/15 text-amber-400'
                              : a.status_code >= 500
                                ? 'bg-red-500/15 text-red-400'
                                : 'bg-octera-surface text-octera-muted'
                        }`}
                      >
                        {a.status_code}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function formatRelative(unixSeconds: number): string {
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
