import { ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MemberAvatar } from '@/components/ui/member-avatar'
import { Spinner } from '@/components/ui/spinner'
import type { FamilyInfo, MemberInfo } from '@/hooks/use-me'
import type { Occurrence } from '@/lib/api-types'
import { formatEventTimeLabel } from '@/utils/date-format'
import { useToday } from './use-today'

/** ホーム = 今日のまとめビュー (F-06) */
export function TodayContainer({ family }: { family: FamilyInfo }) {
  const t = useToday()

  if (t.isLoading) {
    return <Spinner />
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-primary/15 to-primary/5 p-4">
        <p className="text-xs font-medium text-primary">{family.name}</p>
        <h1 className="text-xl font-bold">
          {new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          }).format(new Date())}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">今日の予定 {t.todayEvents.length}件</p>
      </div>

      <Section title="今日の予定">
        {t.todayEvents.length === 0 ? (
          <Empty text="今日の予定はありません" />
        ) : (
          <EventList events={t.todayEvents} members={family.members} />
        )}
      </Section>

      <Link
        to="/shopping"
        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-5 w-5 text-primary" />
          買い物リスト
        </span>
        <span className="text-sm text-muted-foreground">
          未購入 <span className="font-bold text-foreground">{t.uncheckedCount}</span> 件
        </span>
      </Link>

      <Section title="明日の予定">
        {t.tomorrowEvents.length === 0 ? (
          <Empty text="明日の予定はありません" />
        ) : (
          <EventList events={t.tomorrowEvents} members={family.members} />
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
      {text}
    </p>
  )
}

function EventList({ events, members }: { events: Occurrence[]; members: MemberInfo[] }) {
  const memberById = new Map(members.map((m) => [m.id, m]))
  return (
    <ul className="space-y-1.5">
      {events.map((occ) => (
        <li
          key={`${occ.eventId}-${occ.originalStartAt.getTime()}`}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="flex -space-x-1">
            {occ.targetMemberIds.slice(0, 3).map((id) => {
              const m = memberById.get(id)
              return m === undefined ? null : (
                <MemberAvatar
                  key={id}
                  member={m}
                  className="h-7 w-7 text-[10px] ring-2 ring-card"
                />
              )
            })}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{occ.title}</p>
            <p className="text-xs text-muted-foreground">{formatEventTimeLabel(occ.time)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
