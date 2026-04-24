'use client';

import { Server } from 'lucide-react';
import { PlaceholderPanel } from '@/components/PlaceholderPanel';

export default function HostingPage() {
  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <Server className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Hosting</h1>
      </header>
      <p className="mb-8 text-octera-muted">
        Cloud servers, cloudspaces, and VMs running on gig.tech infrastructure.
        Provision new resources, resize or stop existing ones, and monitor usage.
      </p>

      <PlaceholderPanel
        title="Your cloudspaces"
        description="Virtual datacenters (VDCs) — network + compute + storage grouped per environment. Maps to gig.tech's cloudspace primitive."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Virtual machines"
        description="VMs inside cloudspaces. Boot/stop/reboot, resize CPU+memory, attach disks + external IPs."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Storage + backups"
        description="Disks, snapshots, backup policies, restore points."
        status="v1 — wiring"
      />
    </>
  );
}
