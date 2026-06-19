import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/shared/lib/supabase';

export default function AdminLoginPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Check admins table — user is available directly from signIn response
    const user = signInData.user;
    if (user) {
      const { data: admin, error: adminErr } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (adminErr || !admin) {
        await supabase.auth.signOut();
        setError(t('login.notAdmin'));
        setLoading(false);
        return;
      }
    }

    navigate('/admin/quests');
  };

  return (
    <div className="min-h-screen bg-adm-bg flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent mb-4">
            <svg width="24" height="24" viewBox="0 0 60 72" fill="none">
              <path d="M30 4C18 4 8 14 8 26C8 40 18 54 30 68C42 54 52 40 52 26C52 14 42 4 30 4Z" fill="#0A0A0A" />
              <circle cx="30" cy="23" r="8.5" fill="#F5A623" />
              <path d="M26 30L23 45H37L34 30H26Z" fill="#F5A623" />
            </svg>
          </div>
          <h1 className="text-[22px] font-bold text-adm-text">{t('login.title')}</h1>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-adm-muted mb-1.5">
              {t('login.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@trailtale.app"
              required
              autoComplete="email"
              className="w-full h-[44px] px-3.5 rounded-[10px] border border-adm-border bg-adm-bg text-adm-text text-[15px] outline-none focus:border-accent transition-colors placeholder:text-adm-placeholder"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-adm-muted mb-1.5">
              {t('login.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full h-[44px] px-3.5 rounded-[10px] border border-adm-border bg-adm-bg text-adm-text text-[15px] outline-none focus:border-accent transition-colors"
            />
          </div>

          {error && (
            <p className="text-[13px] text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[44px] rounded-btn bg-accent text-bg font-semibold text-[15px] disabled:opacity-60 transition-opacity mt-2"
          >
            {loading ? '…' : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
