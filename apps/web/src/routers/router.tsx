import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/components/layout/root-layout'
import { CalendarPage } from '@/pages/calendar/calendar-page'
import { InviteJoinPage } from '@/pages/invite/invite-join-page'
import { LoginPage } from '@/pages/login/login-page'
import { OnboardingPage } from '@/pages/onboarding/onboarding-page'
import { SettingsPage } from '@/pages/settings/settings-page'
import { ShoppingPage } from '@/pages/shopping/shopping-page'
import { TodayPage } from '@/pages/today/today-page'
import { ProtectedRoutes } from './protected-routes'

/** ルート定義の唯一の箇所 (06 §3。RouteObject 方式) */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/:token', element: <InviteJoinPage /> },
  {
    element: <ProtectedRoutes />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <RootLayout />,
        children: [
          // 初期表示はカレンダー (フィードバック: TimeTree 同様、開いてすぐ月の予定を見たい)
          { path: '/', element: <CalendarPage /> },
          { path: '/today', element: <TodayPage /> },
          { path: '/shopping', element: <ShoppingPage /> },
          { path: '/settings', element: <SettingsPage /> },
          // 旧 /calendar・廃止したパス (旧 /assignments 等)・不明なパスはホーム (カレンダー) へ
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
