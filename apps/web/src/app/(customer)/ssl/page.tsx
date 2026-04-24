'use client';

import { ShieldCheck } from 'lucide-react';
import { PlaceholderPanel } from '@/components/PlaceholderPanel';

export default function SslPage() {
  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">SSL certificates</h1>
      </header>
      <p className="mb-8 text-octera-muted">
        Let&apos;s Encrypt certificates and custom uploaded certs for your
        domains. Auto-renewal handled by gig.tech&apos;s managed ingress; manual
        renewal and uploads available for edge cases.
      </p>

      <PlaceholderPanel
        title="Certificate inventory"
        description="Every cert across all your domains — issuer, expiry, auto-renewal status."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Let's Encrypt auto-renewal"
        description="Free certs, automatic renewal 30 days before expiry, managed by gig.tech's ingress layer."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Upload your own cert"
        description="Paste or upload a PEM-formatted cert + key for domains you manage elsewhere."
        status="v1 — wiring"
      />
    </>
  );
}
