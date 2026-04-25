'use client';

/**
 * Account settings — profile + password + preferences.
 *
 * Profile name is editable (PATCH /v1/users/me). Password change is wired
 * (POST /v1/auth/change-password) and revokes other sessions on success.
 * Email change still requires verification (auth-hardening task #7); 2FA
 * and notification prefs are still PlaceholderPanels.
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

      <ChangePasswordPanel />

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

/**
 * Change-password sub-form. Kept inline because it's ~50 lines and only
 * used here; promoting to its own file would just be ceremony.
 *
 * Server-side semantics: verifies the current password, hashes the new one,
 * and revokes every other session for this user (so a stolen refresh token
 * elsewhere stops working), keeping THIS browser's session alive so the
 * caller doesn't get logged out mid-flow.
 */
function ChangePasswordPanel() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  const tooShort = next.length > 0 && next.length < 12;
  const mismatch = confirm.length > 0 && confirm !== next;
  const sameAsOld = next.length > 0 && next === current;
  const canSubmit =
    current.length > 0 &&
    next.length >= 12 &&
    confirm === next &&
    next !== current &&
    !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await api('/v1/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      setCurrent('');
      setNext('');
      setConfirm('');
      setFeedback({ kind: 'ok', msg: 'Password updated. Other sessions have been signed out.' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not change password';
      setFeedback({ kind: 'error', msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card mb-6">
      <h2 className="text-lg font-semibold">Change password</h2>
      <p className="mt-1 text-sm text-octera-muted">
        Verifies your current password, then updates it. Other browsers signed
        in to this account will be signed out.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <PasswordField
          id="cp-current"
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField
          id="cp-new"
          label="New password (min 12 chars)"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          error={tooShort ? 'At least 12 characters.' : sameAsOld ? 'Must differ from current.' : undefined}
        />
        <PasswordField
          id="cp-confirm"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={mismatch ? 'Passwords don’t match.' : undefined}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Updating…' : 'Change password'}
          </button>
          {feedback && (
            <span
              className={`text-sm ${feedback.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}
              role="status"
            >
              {feedback.msg}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function PasswordField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="block text-sm text-octera-muted">
        {props.label}
      </label>
      <input
        id={props.id}
        type="password"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        className={`mt-1 w-full rounded-md border bg-octera-surface px-3 py-2 text-sm focus:outline-none ${
          props.error
            ? 'border-red-500/50 focus:border-red-500/70'
            : 'border-octera-border focus:border-octera-cyan/60'
        }`}
      />
      {props.error && <p className="mt-1 text-xs text-red-400">{props.error}</p>}
    </div>
  );
}
