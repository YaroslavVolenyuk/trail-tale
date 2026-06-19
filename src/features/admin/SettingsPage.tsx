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
          'text-[15px] font-semibold mb-1',
          danger ? 'text-danger' : 'text-adm-text',
        ].join(' ')}
      >
        {title}
      </h2>
      {description && (
        <p className="text-[13px] text-adm-muted mb-4">{description}</p>
      )}
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
      <div className="space-y-4 max-w-[420px]">
        <div>
          <label className="block text-[12px] font-semibold text-adm-muted uppercase tracking-wider mb-1.5">
            Email
          </label>
          <input
            value={email}
            disabled
            className={inputCls}
            type="email"
          />
          <p className="text-[12px] text-adm-muted mt-1">
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
    <Section
      title="Change Password"
      description="Use a strong password of at least 8 characters."
    >
      <div className="space-y-3 max-w-[420px]">
        <div>
          <label className="block text-[12px] font-semibold text-adm-muted uppercase tracking-wider mb-1.5">
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setStatus('idle'); }}
            placeholder="min. 8 characters"
            autoComplete="new-password"
            className={[inputCls, tooShort ? 'border-danger' : ''].join(' ')}
          />
          {tooShort && (
            <p className="text-[12px] text-danger mt-1">Password must be at least 8 characters.</p>
          )}
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-adm-muted uppercase tracking-wider mb-1.5">
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setStatus('idle'); }}
            placeholder="repeat password"
            autoComplete="new-password"
            className={[inputCls, mismatch ? 'border-danger' : ''].join(' ')}
          />
          {mismatch && (
            <p className="text-[12px] text-danger mt-1">Passwords do not match.</p>
          )}
        </div>

        {status === 'error' && (
          <p className="text-[13px] text-danger">{error}</p>
        )}
        {status === 'saved' && (
          <p className="text-[13px] text-success">Password updated successfully.</p>
        )}

        <button
          onClick={() => void handleSave()}
          disabled={!newPassword || !confirm || mismatch || tooShort || status === 'saving'}
          className="mt-1 h-[38px] px-5 rounded-btn bg-accent text-bg text-[13px] font-semibold disabled:opacity-40 hover:bg-amber-400 transition-colors"
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
    <Section
      title="Danger zone"
      description="Irreversible actions. Proceed with caution."
      danger
    >
      <div className="flex items-center justify-between max-w-[560px]">
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
              className="h-[32px] px-3 rounded-lg border border-adm-border text-adm-muted text-[12px] hover:bg-adm-border/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSignOutAll()}
              disabled={isSigning}
              className="h-[32px] px-3 rounded-lg bg-danger text-white text-[12px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSigning ? '…' : 'Confirm'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="h-[32px] px-3.5 rounded-lg border border-danger/40 text-danger text-[12px] font-medium hover:bg-danger/8 transition-colors"
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
    <div className="p-8 max-w-[680px]">
      <h1 className="text-[24px] font-bold text-adm-text mb-6">
        {t('nav.settings')}
      </h1>

      <div className="space-y-5">
        <ProfileSection />
        <PasswordSection />
        <DangerSection />
      </div>
    </div>
  );
}
