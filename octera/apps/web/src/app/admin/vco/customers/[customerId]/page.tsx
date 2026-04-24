'use client';

/**
 * Per-customer operator view.
 *
 * Wraps /v1/vco/customers/:id, /v1/vco/customers/:id/cloudspaces,
 * /v1/vco/customers/:id/certificates. Stub for now — just shows identity and
 * lists cloudspaces. Per-cloudspace drill-down + cert renewal actions land
 * in a follow-up.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { VcoCloudspace, VcoCustomer } from '@octera/shared';

interface CustomerDetailData {
  customer: VcoCustomer;
  cloudspaces: VcoCloudspace[];
}

export default function VcoCustomerDetail() {
  const params = useParams();
  const customerId = typeof params.customerId === 'string' ? params.customerId : '';
  const [data, setData] = useState<CustomerDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [customerRes, cloudspacesRes] = await Promise.all([
          api<{ customer: VcoCustomer }>(
            `/v1/vco/customers/${encodeURIComponent(customerId)}`
          ),
          api<{ cloudspaces: VcoCloudspace[] }>(
            `/v1/vco/customers/${encodeURIComponent(customerId)}/cloudspaces`
          ),
        ]);
        if (cancelled) return;
        setData({ customer: customerRes.customer, cloudspaces: cloudspacesRes.cloudspaces });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(`${err.code}: ${err.message}`);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-octera-muted">Loading customer…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="card border-red-500/40 bg-red-500/5">
          <h2 className="text-lg font-semibold text-red-400">
            Couldn&apos;t load customer
          </h2>
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

  const { customer, cloudspaces } = data;

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

      {/* ---- Customer identity ---- */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{customer.name}</h1>
          <p className="mt-1 font-mono text-sm text-octera-muted">
            {customer.customer_id}
          </p>
        </div>
        {customer.status && (
          <span
            className={`rounded px-2 py-1 font-mono text-xs uppercase tracking-wider ${
              customer.status.toLowerCase() === 'active'
                ? 'bg-green-500/15 text-green-400'
                : 'bg-octera-surface text-octera-muted'
            }`}
          >
            {customer.status}
          </span>
        )}
      </div>

      {/* ---- Customer metadata ---- */}
      <section className="card mb-6">
        <h2 className="text-lg font-semibold">Customer details</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          {customer.contact_name && (
            <>
              <dt className="text-octera-muted">Contact</dt>
              <dd>{customer.contact_name}</dd>
            </>
          )}
          {customer.email && (
            <>
              <dt className="text-octera-muted">Email</dt>
              <dd>{customer.email}</dd>
            </>
          )}
          <dt className="text-octera-muted">Billable</dt>
          <dd>{customer.billable ? 'Yes' : 'No'}</dd>
          <dt className="text-octera-muted">Show prices</dt>
          <dd>{customer.show_prices ? 'Yes' : 'No'}</dd>
        </dl>
      </section>

      {/* ---- Cloudspaces ---- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Cloudspaces{' '}
            <span className="ml-2 text-sm font-normal text-octera-muted">
              ({cloudspaces.length})
            </span>
          </h2>
        </div>
        {cloudspaces.length === 0 ? (
          <p className="card text-sm text-octera-muted">
            No cloudspaces deployed for this customer. In live mode this would
            show the 39 deployed cloudspaces in Machelen; in mock mode the
            fixture is intentionally empty.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cloudspaces.map((cs) => (
              <div key={cs.cloudspace_id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{cs.name}</h3>
                  {cs.status && (
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider ${
                        cs.status.toLowerCase() === 'deployed'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-octera-surface text-octera-muted'
                      }`}
                    >
                      {cs.status}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-octera-muted">
                  {cs.cloudspace_id}
                </p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {cs.location && (
                    <>
                      <dt className="text-octera-muted">Location</dt>
                      <dd className="font-mono">{cs.location}</dd>
                    </>
                  )}
                  {cs.private_network && (
                    <>
                      <dt className="text-octera-muted">Network</dt>
                      <dd className="font-mono">{cs.private_network}</dd>
                    </>
                  )}
                  {cs.external_network_ip && (
                    <>
                      <dt className="text-octera-muted">External IP</dt>
                      <dd className="font-mono">{cs.external_network_ip}</dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
