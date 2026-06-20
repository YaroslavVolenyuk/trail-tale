/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

// ── Player flow ────────────────────────────────────────────────────────────
const QuestListScreen = lazy(() => import('./features/quests/QuestListScreen'));
const WelcomeScreen  = lazy(() => import('./features/quests/WelcomeScreen'));
const SetupScreen    = lazy(() => import('./features/quests/SetupScreen'));
const NicknameScreen = lazy(() => import('./features/quests/NicknameScreen'));
const TeamScreen     = lazy(() => import('./features/teams/TeamScreen'));
const IntroScreen    = lazy(() => import('./features/play/IntroScreen'));
const PlayScreen     = lazy(() => import('./features/play/PlayScreen'));
const CompleteScreen = lazy(() => import('./features/play/CompleteScreen'));

// ── Admin ──────────────────────────────────────────────────────────────────
const AdminLayout        = lazy(() => import('./features/admin/AdminLayout'));
const AdminLoginPage     = lazy(() => import('./features/admin/AdminLoginPage'));
const QuestsPage         = lazy(() => import('./features/admin/QuestsPage'));
const ClueListPage       = lazy(() => import('./features/admin/ClueListPage'));
const ClueEditorPage     = lazy(() => import('./features/admin/ClueEditorPage'));
const LiveMonitoringPage = lazy(() => import('./features/admin/LiveMonitoringPage'));
const AnalyticsPage      = lazy(() => import('./features/admin/AnalyticsPage'));
const PlayersPage        = lazy(() => import('./features/admin/PlayersPage'));
const SettingsPage       = lazy(() => import('./features/admin/SettingsPage'));
const ImportPage         = lazy(() => import('./features/admin/ImportPage'));

function Spinner({ light }: { light?: boolean }) {
  return (
    <div className={`flex h-screen items-center justify-center ${light ? 'bg-adm-bg' : 'bg-bg'}`}>
      <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

function S(C: React.ComponentType) {
  return <Suspense fallback={<Spinner />}><C /></Suspense>;
}

function SA(C: React.ComponentType) {
  return <Suspense fallback={<Spinner light />}><C /></Suspense>;
}

export const routes: RouteObject[] = [
  // ── Player flow ──────────────────────────────────────────────────────────
  { path: '/',                         element: S(QuestListScreen) },
  { path: '/q/:slug',                  element: S(WelcomeScreen) },
  { path: '/q/:slug/setup',            element: S(SetupScreen) },
  { path: '/q/:slug/nickname',         element: S(NicknameScreen) },
  { path: '/q/:slug/team',             element: S(TeamScreen) },
  { path: '/q/:slug/team/nickname',    element: S(NicknameScreen) },
  { path: '/play/:sessionId/intro',    element: S(IntroScreen) },
  { path: '/play/:sessionId',          element: S(PlayScreen) },
  { path: '/play/:sessionId/complete', element: S(CompleteScreen) },

  // ── Admin ────────────────────────────────────────────────────────────────
  { path: '/admin/login', element: SA(AdminLoginPage) },
  {
    path: '/admin',
    element: SA(AdminLayout),
    children: [
      { index: true, element: <Navigate to="quests" replace /> },
      { path: 'quests',                     element: SA(QuestsPage) },
      { path: 'quests/:slug',               element: SA(ClueListPage) },
      { path: 'quests/:slug/clues/:clueId', element: SA(ClueEditorPage) },
      { path: 'quests/:slug/live',          element: SA(LiveMonitoringPage) },
      { path: 'players',   element: SA(PlayersPage) },
      { path: 'analytics', element: SA(AnalyticsPage) },
      { path: 'import',    element: SA(ImportPage) },
      { path: 'settings',  element: SA(SettingsPage) },
    ],
  },
];
