import { Calendar, CalendarHeart, Home, ListChecks, Settings, UserCheck } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: '今日', icon: Home },
  { to: '/calendar', label: 'カレンダー', icon: Calendar },
  { to: '/shopping', label: '買い物', icon: ListChecks },
  { to: '/assignments', label: '担当', icon: UserCheck },
  { to: '/settings', label: '設定', icon: Settings },
] as const

/**
 * モバイル: ボトムナビ / PC: サイドナビ (06 §3)。
 * PC のナビは sticky (通常フロー) にしてコンテンツとの重なりを構造的に防ぐ
 */
export function RootLayout() {
  return (
    <div className="min-h-dvh md:flex">
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-safe md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:border-r md:border-t-0 md:bg-card md:px-3 md:pt-6">
        <p className="hidden items-center gap-2 px-3 pb-6 text-xl font-bold text-primary md:flex">
          <CalendarHeart className="h-6 w-6" />
          iegoto
        </p>
        <div className="mx-auto flex max-w-md justify-around md:mx-0 md:max-w-none md:flex-col md:justify-start md:gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium text-muted-foreground transition-colors md:flex-row md:gap-3 md:rounded-lg md:py-2.5 md:text-sm',
                  isActive
                    ? 'text-primary md:bg-primary/10'
                    : 'md:hover:bg-muted md:hover:text-foreground',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="w-full min-w-0 flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto w-full max-w-3xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
