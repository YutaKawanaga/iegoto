import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/root-layout'
import { AssignmentsPage } from '@/pages/assignments/assignments-page'
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
          { path: '/', element: <TodayPage /> },
          { path: '/calendar', element: <CalendarPage /> },
          { path: '/assignments', element: <AssignmentsPage /> },
          { path: '/shopping', element: <ShoppingPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
])
