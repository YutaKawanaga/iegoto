import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FamilyInfo } from '@/hooks/use-me'
import type { Occurrence } from '@/lib/api-types'
import { formatEventTimeLabel } from '@/utils/date-format'
import { useAssignments } from './use-assignments'

/** 担当画面 (F-04) */
export function AssignmentsContainer({ family }: { family: FamilyInfo }) {
  const a = useAssignments()

  if (a.isLoading) {
    return <Spinner />
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">担当</h1>
      <Tabs defaultValue="unassigned">
        <TabsList>
          <TabsTrigger value="unassigned">担当者未定 ({a.unassigned.length})</TabsTrigger>
          <TabsTrigger value="mine">自分の担当 ({a.mine.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="unassigned" className="mt-3">
          {a.unassigned.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              担当者未定の予定はありません 🎉
            </p>
          ) : (
            <ul className="space-y-1.5">
              {a.unassigned.map((occ) => (
                <AssignmentRow key={rowKey(occ)} occ={occ}>
                  <Button
                    size="sm"
                    disabled={a.isClaiming}
                    onClick={() => a.claim(occ, family.myMemberId)}
                  >
                    担当する
                  </Button>
                </AssignmentRow>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="mine" className="mt-3">
          {a.mine.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              担当中の予定はありません
            </p>
          ) : (
            <ul className="space-y-1.5">
              {a.mine.map((occ) => (
                <AssignmentRow key={rowKey(occ)} occ={occ} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function rowKey(occ: Occurrence): string {
  return `${occ.eventId}-${occ.originalStartAt.getTime()}`
}

function AssignmentRow({ occ, children }: { occ: Occurrence; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{occ.title}</p>
        <p className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            month: 'numeric',
            day: 'numeric',
            weekday: 'short',
          }).format(occ.sortInstant)}{' '}
          {formatEventTimeLabel(occ.time)}
          {occ.isRecurring && ' ・ 繰り返し'}
        </p>
      </div>
      {children}
    </li>
  )
}
