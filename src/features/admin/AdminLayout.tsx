import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/shared/lib/supabase';

// ── Icon primitives ──────────────────────────────────────────────────────────

function IconQuests() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 15c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 8.5c1.1 0 2 .9 2 2v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15.5 14c0-1.1-.9-2-2-2h-.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2 14l4-5 3 3 4-6 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M3.93 3.93l1.06 1.06M13.01 13.01l1.06 1.06M3.93 14.07l1.06-1.06M13.01 4.99l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconImport() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 2v9M6 8l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Auth guard ────────────────────────────────────────────────────────────────

type AuthState = 'loading' | 'authorized' | 'unauthorized';

function useAdminAuth(): AuthState {
  const [state, setState] = useState<AuthState>('loading');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!user) {
        setState('unauthorized');
        navigate('/admin/login', { replace: true });
        return;
      }

      // Verify membership in admins table
      const { data: admin } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mounted) return;

      if (!admin) {
        await supabase.auth.signOut();
        setState('unauthorized');
        navigate('/admin/login', { replace: true });
        return;
      }

      setState('authorized');
    };

    void check();

    // Re-check on auth state changes (e.g. session expiry)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) {
          setState('unauthorized');
          navigate('/admin/login', { replace: true });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return state;
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const authState = useAdminAuth();

  const navItems = [
    { to: '/admin/quests',    label: t('nav.quests'),    Icon: IconQuests },
    { to: '/admin/players',   label: t('nav.players'),   Icon: IconUsers },
    { to: '/admin/analytics', label: t('nav.analytics'), Icon: IconChart },
    { to: '/admin/import',    label: t('nav.import'),    Icon: IconImport },
    { to: '/admin/settings',  label: t('nav.settings'),  Icon: IconSettings },
  ] as const;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  if (authState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-adm-bg">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (authState === 'unauthorized') {
    return null; // navigate() already fired
  }

  return (
    <div className="flex h-screen bg-adm-bg font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[240px] flex-shrink-0 bg-adm-sidebar border-r border-adm-border flex flex-col">
        {/* Brand */}
        <div className="h-[60px] flex items-center px-6 border-b border-adm-border">
          <span className="text-[16px] font-bold text-adm-text tracking-[-0.3px]">
            TrailTale
          </span>
          <span className="ml-2 text-[11px] font-medium text-adm-muted bg-adm-border px-1.5 py-0.5 rounded">
            Admin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto" aria-label="Admin navigation">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-[14px] font-medium transition-colors',
                  'border-l-[3px]',
                  isActive
                    ? 'border-accent text-accent bg-accent/8'
                    : 'border-transparent text-adm-muted hover:text-adm-text hover:bg-adm-border/60',
                ].join(' ')
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-adm-border">
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-2.5 text-[13px] text-adm-muted hover:text-adm-text transition-colors w-full"
          >
            <IconLogout />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
