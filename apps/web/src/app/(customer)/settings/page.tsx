'use client';

/**
 * Account settings — profile + password + preferences.
 *
 * Profile name is editable (PATCH /v1/users/me). Email change requires
 * verification; password change goes through the auth flow; both land with
 * the auth-hardening chunk (task #7).
 */

import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import type { UserPublic } from '@octera/shared';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { PlaceholderPanel } from '@/components/PlaceholderPanel';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [draftName, setDraftName] = useState(user?.fullName ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  if (!user) return null; // layout handles loading/redirect

  const dirty = (draftName.trim() || null) !== (user.fullName ?? null);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const next = await api<UserPublic>('/v1/users/me', {
        method: 'PATCH',
        body: { fullName: draftName.trim() || null },
      });
      updateUser(next);
      setDraftName(next.fullName ?? '');
      setFeedback({ kind: 'ok', msg: 'Saved.' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not save profile';
      setFeedback({ kind: 'error', msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Settings</h1>
      </header>

      {/* ---- Profile (editable name; email/role/id read-only) ---- */}
      <section className="card mb-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <form onSubmit={onSave} className="mt-4 space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm text-octera-muted">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={100}
              placeholder="How you want to be addressed"
              className="mt-1 w-full rounded-md border border-octera-border bg-octera-surface px-3 py-2 text-sm placeholder:text-octera-muted focus:border-octera-cyan/60 focus:outline-none"
            />
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-[auto_1fr]">
            <dt className="text-octera-muted">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-octera-muted">Role</dt>
            <dd className="font-mono uppercase tracking-wider text-octera-cyan">
              {user.role}
            </dd>
            <dt className="text-octera-muted">User ID</dt>
            <dd className="font-mono text-xs text-octera-muted">{user.id}</dd>
          </dl>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!dirty || saving}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {feedback && (
              <span
                className={`text-sm ${
                  feedback.kind === 'ok' ? 'text-green-400' : 'text-red-400'
                }`}
                role="status"
              >
                {feedback.msg}
              </span>
            )}
          </div>
        </form>
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
