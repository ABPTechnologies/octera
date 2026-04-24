'use client';

/**
 * Public status page.
 *
 * Hits the API's /health/ready (which itself probes Postgres + Redis +
 * gig.tech) and renders a per-component status overview. Auto-refreshes
 * every 30 seconds.
 *
 * Public — no auth gate. The endpoint we call is also public. The probe
 * results don't leak anything sensitive: just up/down per dependency and
 * a latency number. Useful as a "are we up?" page for anyone running into
 * trouble.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const REFRESH_INTERVAL_MS = 30_000;

interface ProbeResult {
  status: 'ok' | 'degraded' | 'skipped';
  latency_ms?: number;
  error?: string;
  note?: string;
}

interface ReadinessResponse {
  status: 'ok' | 'degraded';
  probes: Record<string, ProbeResult>;
}

interface StatusState {
  data: ReadinessResponse | null;
  fetchedAt: Date | null;
  fetchError: string | null;
  loading: boolean;
}

export default function StatusPage() {
  const [state, setState] = useState<StatusState>({
    data: null,
    fetchedAt: null,
    fetchError: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${API_URL}/health/ready`);
        const json = (await res.json()) as ReadinessResponse;
        if (cancelled) return;
        setState({
          data: json,
          fetchedAt: new Date(),
          fetchError: null,
          loading: false,
        });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          fetchedAt: new Date(),
          fetchError: err instanceof Error ? err.message : 'Network error',
          loading: false,
        }));
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const overallOk =
    state.data?.status === 'ok' && !state.fetchError;

  return (
    <main className="min-h-screen">
      <header className="border-b border-octera-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Back to homepage">
            <Logo />
          </Link>
          <Link
            href="/"
            className="text-sm text-octera-muted transition hover:text-octera-cyan"
          >
            ← octera.net
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        {/* ---- Top banner ---- */}
        <div
          className={`card mb-6 border-l-4 ${
            state.loading
              ? 'border-l-octera-muted'
              : overallOk
                ? 'border-l-green-500'
                : 'border-l-amber-500'
          }`}
        >
          <h1 className="text-2xl font-semibold">
            {state.loading
              ? 'Checking…'
              : overallOk
                ? 'All systems operational'
                : 'Some systems are degraded'}
          </h1>
          <p className="mt-2 text-sm text-octera-muted">
            {state.fetchedAt
              ? `Last checked ${state.fetchedAt.toLocaleTimeString()} — auto-refreshes every 30 seconds.`
              : 'Auto-refreshes every 30 seconds.'}
          </p>
          {state.fetchError && (
            <p className="mt-3 text-sm text-red-400">
              Couldn&apos;t reach the API: {state.fetchError}
            </p>
          )}
        </div>

        {/* ---- Per-probe results ---- */}
        <div className="space-y-3">
          {state.data
            ? Object.entries(state.data.probes).map(([name, probe]) => (
                <ProbeRow key={name} name={name} probe={probe} />
              ))
            : !state.fetchError && (
                <p className="text-sm text-octera-muted">Loading probes…</p>
              )}
        </div>

        <p className="mt-8 text-xs text-octera-muted">
          Detailed incident history and SLO numbers will land later. For now
          this page reflects the live result of the platform&apos;s readiness
          probe.
        </p>
      </section>
    </main>
  );
}

function ProbeRow({ name, probe }: { name: string; probe: ProbeResult }) {
  const dotClass =
    probe.status === 'ok'
      ? 'bg-green-500'
      : probe.status === 'skipped'
        ? 'bg-octera-muted'
        : 'bg-amber-500';
  const labelClass =
    probe.status === 'ok'
      ? 'text-green-400'
      : probe.status === 'skipped'
        ? 'text-octera-muted'
        : 'text-amber-400';
  const friendly =
    name === 'database'
      ? 'Database'
      : name === 'cache'
        ? 'Cache'
        : name === 'gigtech'
          ? 'Cloud platform'
          : name;

  return (
    <div className="card flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden />
        <div>
          <div className="font-medium">{friendly}</div>
          {probe.note && (
            <div className="text-xs text-octera-muted">{probe.note}</div>
          )}
          {probe.error && (
            <div className="text-xs text-amber-400">{probe.error}</div>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className={`font-mono text-xs uppercase tracking-wider ${labelClass}`}>
          {probe.status === 'skipped'
            ? 'not configured'
            : probe.status === 'ok'
              ? 'operational'
              : 'degraded'}
        </div>
        {probe.latency_ms !== undefined && probe.status === 'ok' && (
          <div className="mt-0.5 text-xs text-octera-muted">
            {probe.latency_ms} ms
          </div>
        )}
      </div>
    </div>
  );
}
