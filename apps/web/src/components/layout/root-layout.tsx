import { Calendar, Home, ListChecks, Settings, UserCheck } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: '今日', icon: Home },
  { to: '/calendar', label: 'カレンダー', icon: Calendar },
  { to: '/shopping', label: '買い物', icon: ListChecks },
  { to: '/assignments', label: '担当', icon: UserCheck },
  { to: '/settings', label: '設定', icon: Settings },
] as const

/** モバイル: ボトムナビ / PC: サイドナビ (06 §3) */
export function RootLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl md:pl-52">
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-safe md:inset-y-0 md:left-auto md:right-auto md:w-52 md:border-r md:border-t-0 md:pt-6">
        <div className="mx-auto flex max-w-md justify-around md:mx-0 md:max-w-none md:flex-col md:justify-start md:gap-1 md:px-3">
          <p className="hidden px-3 pb-4 text-lg font-bold text-primary md:block">iegoto</p>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium text-muted-foreground md:flex-row md:gap-3 md:rounded-lg md:py-2.5 md:text-sm',
                  isActive && 'text-primary md:bg-primary/10',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="w-full flex-1 px-4 pb-24 pt-4 md:pb-8">
        <Outlet />
      </main>
    </div>
  )
}
