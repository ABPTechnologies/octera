'use client';

/**
 * Account settings — profile + password + preferences.
 *
 * For Phase A, this is just a read-only view of the logged-in user's profile.
 * Edit flows (change password, update name, notification prefs, MFA setup)
 * land once we pair this with the auth-hardening chunk (task #7).
 */

import { Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PlaceholderPanel } from '@/components/PlaceholderPanel';

export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null; // layout handles loading/redirect

  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Settings</h1>
      </header>

      {/* ---- Profile (read-only) ---- */}
      <section className="card mb-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-[auto_1fr]">
          <dt className="text-octera-muted">Full name</dt>
          <dd>{user.fullName ?? <em className="text-octera-muted">not set</em>}</dd>
          <dt className="text-octera-muted">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-octera-muted">Role</dt>
          <dd className="font-mono uppercase tracking-wider text-octera-cyan">
            {user.role}
          </dd>
          <dt className="text-octera-muted">User ID</dt>
          <dd className="font-mono text-xs text-octera-muted">{user.id}</dd>
        </dl>
      </section>

      <PlaceholderPanel
        title="Change password"
        description="Set a new password. Requires confirming your current one."
        status="v1 — wiring with auth hardening"
      />

      <PlaceholderPanel
        title="Two-factor authentication"
        description="Add TOTP-based 2FA via an authenticator app."
        status="v1 — wiring with auth hardening"
      />

      <PlaceholderPanel
        title="Notification preferences"
        description="Choose which events trigger email — billing, domain expiry, ticket replies, alerts."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Delete account"
        description="Permanent account deletion. Requires 14-day cooldown and written confirmation."
        status="later"
      />
    </>
  );
}
