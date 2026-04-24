'use client';

import { Globe } from 'lucide-react';
import { PlaceholderPanel } from '@/components/PlaceholderPanel';

export default function DomainsPage() {
  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <Globe className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Domains</h1>
      </header>
      <p className="mb-8 text-octera-muted">
        Search available domain names, register new ones, manage DNS records,
        transfer in or out, and check WHOIS status — all in one place.
      </p>

      <PlaceholderPanel
        title="Domain search + registration"
        description="Search .com, .net, .eu, .cloud and hundreds of other TLDs. Lands with the GoDaddy registrar integration (v2) — see NEXT_STEPS.md § 3a."
        status="v2"
      />

      <PlaceholderPanel
        title="DNS record editor"
        description="A, AAAA, CNAME, MX, TXT, NS, SRV, CAA — full record types via gig.tech's DNS surface."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Transfer in / out"
        description="Move domains between registrars with auth codes + status tracking."
        status="v2"
      />
    </>
  );
}
