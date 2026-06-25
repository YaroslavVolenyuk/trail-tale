import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/shared/lib/supabase';

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-xl border p-6',
        danger ? 'border-danger/30 bg-red-50/40' : 'border-adm-border bg-adm-bg',
      ].join(' ')}
    >
      <h2
        className={[
          'mb-1 text-[15px] font-semibold',
          danger ? 'text-danger' : 'text-adm-text',
        ].join(' ')}
      >
        {title}
      </h2>
      {description && <p className="mb-4 text-[13px] text-adm-muted">{description}</p>}
      {children}
    </div>
  );
}

const inputCls =
  'w-full h-[40px] px-3.5 rounded-lg border border-adm-border bg-adm-bg text-adm-text text-[14px] outline-none focus:border-accent transition-colors placeholder:text-adm-placeholder disabled:opacity-50 disabled:cursor-not-allowed';

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '');
    });
  }, []);

  return (
    <Section title="Profile" description="Your account information.">
      <div className="max-w-[420px] space-y-4">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-adm-muted">
            Email
          </label>
          <input value={email} disabled className={inputCls} type="email" />
          <p className="mt-1 text-[12px] text-adm-muted">
            Email cannot be changed here. Contact your administrator.
          </p>
        </div>
      </div>
    </Section>
  );
}

// ── Change password ───────────────────────────────────────────────────────────

function PasswordSection() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;

  const handleSave = async () => {
    if (!newPassword || mismatch || tooShort) return;
    setStatus('saving');
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) {
      setStatus('error');
      setError(err.message);
    } else {
      setStatus('saved');
      setNewPassword('');
      setConfirm('');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <Section title="Change Password" description="Use a strong password of at least 8 characters.">
      <div className="max-w-[420px] space-y-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-adm-muted">
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setStatus('idle');
            }}
            placeholder="min. 8 characters"
            autoComplete="new-password"
            className={[inputCls, tooShort ? 'border-danger' : ''].join(' ')}
          />
          {tooShort && (
            <p className="mt-1 text-[12px] text-danger">Password must be at least 8 characters.</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-adm-muted">
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setStatus('idle');
            }}
            placeholder="repeat password"
            autoComplete="new-password"
            className={[inputCls, mismatch ? 'border-danger' : ''].join(' ')}
          />
          {mismatch && <p className="mt-1 text-[12px] text-danger">Passwords do not match.</p>}
        </div>

        {status === 'error' && <p className="text-[13px] text-danger">{error}</p>}
        {status === 'saved' && (
          <p className="text-[13px] text-success">Password updated successfully.</p>
        )}

        <button
          onClick={() => void handleSave()}
          disabled={!newPassword || !confirm || mismatch || tooShort || status === 'saving'}
          className="mt-1 h-[38px] rounded-btn bg-accent px-5 text-[13px] font-semibold text-bg transition-colors hover:bg-amber-400 disabled:opacity-40"
        >
          {status === 'saving' ? 'Saving…' : 'Update password'}
        </button>
      </div>
    </Section>
  );
}

// ── Danger zone ───────────────────────────────────────────────────────────────

function DangerSection() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const handleSignOutAll = async () => {
    setIsSigning(true);
    await supabase.auth.signOut({ scope: 'global' });
    window.location.href = '/admin/login';
  };

  return (
    <Section title="Danger zone" description="Irreversible actions. Proceed with caution." danger>
      <div className="flex max-w-[560px] items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-adm-text">Sign out all devices</p>
          <p className="text-[12px] text-adm-muted">
            Invalidates all active sessions, including this one.
          </p>
        </div>
        {showConfirm ? (
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="h-[32px] rounded-lg border border-adm-border px-3 text-[12px] text-adm-muted transition-colors hover:bg-adm-border/60"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSignOutAll()}
              disabled={isSigning}
              className="h-[32px] rounded-lg bg-danger px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSigning ? '…' : 'Confirm'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="hover:bg-danger/8 h-[32px] rounded-lg border border-danger/40 px-3.5 text-[12px] font-medium text-danger transition-colors"
          >
            Sign out all
          </button>
        )}
      </div>
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useTranslation('admin');

  return (
    <div className="max-w-[680px] p-8">
      <h1 className="mb-6 text-[24px] font-bold text-adm-text">{t('nav.settings')}</h1>

      <div className="space-y-5">
        <ProfileSection />
        <PasswordSection />
        <DangerSection />
      </div>
    </div>
  );
}
