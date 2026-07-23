import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FamilyInfo } from '@/hooks/use-me'
import { MEMBER_BG } from '@/lib/member-colors'
import { cn } from '@/lib/utils'
import { WEEKDAY_LABELS } from '@/utils/recurrence'
import { DaySheet } from './day-sheet'
import { EventChip } from './event-chip'
import { EventEditModal } from './event-edit-modal/event-edit-modal'
import { useCalendar } from './use-calendar'

/** カレンダー画面 (F-02): 月/週切替・メンバーフィルタ・重複は並列(縦積み)表示 */
export function CalendarContainer({ family }: { family: FamilyInfo }) {
  const c = useCalendar()
  const activeMembers = family.members.filter((m) => !m.isDeleted)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="前へ" onClick={() => c.navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="min-w-28 text-center text-base font-semibold">{c.headerLabel}</p>
          <Button variant="ghost" size="icon" aria-label="次へ" onClick={() => c.navigate(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={c.goToday}>
            今日
          </Button>
        </div>
        <Tabs value={c.view} onValueChange={(v) => c.setView(v as 'month' | 'week')}>
          <TabsList className="w-auto">
            <TabsTrigger value="month" className="px-4">
              月
            </TabsTrigger>
            <TabsTrigger value="week" className="px-4">
              週
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={c.clearFilter}
          className={cn(
            'rounded-full border border-border px-2.5 py-1 text-xs',
            c.filterMemberIds.length === 0 && 'border-primary bg-primary/10 font-medium',
          )}
        >
          全員
        </button>
        {activeMembers.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => c.toggleFilterMember(m.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs',
              c.filterMemberIds.includes(m.id) && 'border-primary bg-primary/10 font-medium',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', MEMBER_BG[m.color])} />
            {m.displayName}
          </button>
        ))}
      </div>

      {c.isLoading ? (
        <Spinner />
      ) : c.view === 'month' ? (
        <MonthView c={c} family={family} />
      ) : (
        <WeekView c={c} family={family} />
      )}

      {c.dayKey !== null && (
        <DaySheet
          dateKey={c.dayKey}
          events={c.byDate.get(c.dayKey) ?? []}
          family={family}
          onCreate={() => c.openCreate(c.dayKey ?? c.todayKey)}
          onEdit={c.openEdit}
          onClose={c.closeDay}
        />
      )}

      {c.editTarget !== null && (
        <EventEditModal target={c.editTarget} family={family} onClose={c.closeEdit} />
      )}
    </div>
  )
}

type ViewProps = { c: ReturnType<typeof useCalendar>; family: FamilyInfo }

function MonthView({ c, family }: ViewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((w, i) => (
          <div
            key={w}
            className={cn('py-1.5', i === 0 && 'text-red-500', i === 6 && 'text-blue-500')}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {c.grid.map((day) => {
          const events = c.byDate.get(day.dateKey) ?? []
          return (
            <button
              key={day.dateKey}
              type="button"
              aria-label={`${Number(day.dateKey.slice(0, 4))}年${Number(day.dateKey.slice(5, 7))}月${day.day}日`}
              onClick={() => c.openDay(day.dateKey)}
              className={cn(
                'min-h-20 min-w-0 border-b border-r border-border p-1 text-left align-top transition-colors last:border-r-0 hover:bg-muted/40 md:min-h-28',
                !day.inMonth && 'bg-muted/30 text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'mb-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs',
                  day.weekday === 0 && day.inMonth && 'text-red-500',
                  day.weekday === 6 && day.inMonth && 'text-blue-500',
                  day.dateKey === c.todayKey && 'bg-primary font-bold text-primary-foreground',
                )}
              >
                {day.day}
              </span>
              <div className="space-y-0.5">
                {/* onClick なし = セル全体のタップで日別ビューを開く (小さいチップの誤タップ防止) */}
                {events.slice(0, 3).map((occ) => (
                  <EventChip
                    key={`${occ.eventId}-${occ.originalStartAt.getTime()}`}
                    occurrence={occ}
                    members={family.members}
                    compact
                  />
                ))}
                {events.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">他{events.length - 3}件</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ c, family }: ViewProps) {
  return (
    <div className="space-y-2">
      {c.grid.map((day) => {
        const events = c.byDate.get(day.dateKey) ?? []
        return (
          <div key={day.dateKey} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <p
                className={cn(
                  'text-sm font-medium',
                  day.dateKey === c.todayKey && 'text-primary',
                  day.weekday === 0 && 'text-destructive',
                )}
              >
                {Number(day.dateKey.slice(8, 10))}日 ({WEEKDAY_LABELS[day.weekday]})
              </p>
              <Button
                variant="ghost"
                size="sm"
                aria-label="予定を作成"
                onClick={() => c.openCreate(day.dateKey)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">予定なし</p>
            ) : (
              <div className="space-y-1">
                {events.map((occ) => (
                  <EventChip
                    key={`${occ.eventId}-${occ.originalStartAt.getTime()}`}
                    occurrence={occ}
                    members={family.members}
                    onClick={() => c.openEdit(occ)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
