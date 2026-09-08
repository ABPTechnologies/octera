'use client';

/**
 * Domains — customer self-care.
 * Lists owned domains (GET /v1/domains) and takes a registration request
 * (POST /v1/domains/register → creates a PENDING record). Availability search
 * lands with the registrar integration; until then the form files a request an
 * operator/registrar fulfils.
 */

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

interface DomainRow {
  id: string;
  fullName: string;
  status: string;
  registrar: string;
  expiresAt?: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'text-emerald-400 bg-emerald-400/10',
  PENDING: 'text-amber-400 bg-amber-400/10',
  EXPIRED: 'text-red-400 bg-red-400/10',
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [extension, setExtension] = useState('com');
  const [years, setYears] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  async function load() {
    try {
      const { domains } = await api<{ domains: DomainRow[] }>('/v1/domains');
      setDomains(domains);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load domains');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !name.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await api('/v1/domains/register', {
        method: 'POST',
        body: { name: name.trim().toLowerCase(), extension, years },
      });
      setFeedback({ kind: 'ok', msg: `Registration requested for ${name}.${extension}.` });
      setName('');
      await load();
    } catch (e) {
      setFeedback({
        kind: 'error',
        msg: e instanceof ApiError ? e.message : 'Registration request failed',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <Globe className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Domains</h1>
      </header>
      <p className="mb-8 text-octera-muted">
        Register domains and manage the ones you own. DNS editing and transfers arrive with the
        registrar integration.
      </p>

      {/* Register */}
      <section className="mb-10 rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-lg font-medium">Register a domain</h2>
        <form onSubmit={onRegister} className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-octera-muted">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mycompany"
              className="mt-1 block w-52 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-sm text-octera-muted">
            TLD
            <select
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
              className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            >
              {['com', 'net', 'eu', 'be', 'cloud', 'org', 'io'].map((t) => (
                <option key={t} value={t}>
                  .{t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-octera-muted">
            Years
            <input
              type="number"
              min={1}
              max={10}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="mt-1 block w-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </label>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="rounded-lg bg-octera-cyan px-5 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {submitting ? 'Requesting…' : 'Request registration'}
          </button>
        </form>
        {feedback && (
          <p className={`mt-3 text-sm ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback.msg}
          </p>
        )}
        <p className="mt-3 text-xs text-octera-muted">
          Live availability search + instant checkout arrive with the registrar integration. For now
          this files a registration request we fulfil for you.
        </p>
      </section>

      {/* Owned domains */}
      <section>
        <h2 className="mb-4 text-lg font-medium">Your domains</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!error && domains === null && <p className="text-sm text-octera-muted">Loading…</p>}
        {domains && domains.length === 0 && (
          <p className="text-sm text-octera-muted">No domains yet — register one above.</p>
        )}
        {domains && domains.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-octera-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Registrar</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium text-white">{d.fullName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          STATUS_STYLE[d.status] ?? 'bg-white/10 text-octera-muted'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-octera-muted">{d.registrar}</td>
                    <td className="px-4 py-3 text-octera-muted">
                      {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
