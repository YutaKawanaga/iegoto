import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { FamilyInfo } from '@/hooks/use-me'
import type { Occurrence } from '@/lib/api-types'
import { holidayName } from '@/utils/holidays'
import { WEEKDAY_LABELS } from '@/utils/recurrence'
import { EventChip } from './event-chip'

type Props = {
  dateKey: string
  events: Occurrence[]
  family: FamilyInfo
  onCreate: () => void
  onEdit: (occurrence: Occurrence) => void
  onClose: () => void
}

/** 日別ビュー (F-02): 月セルタップでその日の予定一覧を表示。右上のプラスから作成へ */
export function DaySheet({ dateKey, events, family, onCreate, onEdit, onClose }: Props) {
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay()
  const holiday = holidayName(dateKey)
  const title = `${Number(dateKey.slice(5, 7))}月${Number(dateKey.slice(8, 10))}日 (${WEEKDAY_LABELS[weekday]})${holiday === null ? '' : ` ${holiday}`}`

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={title}
        headerAction={
          <Button variant="ghost" size="icon" aria-label="予定を作成" onClick={onCreate}>
            <Plus className="h-5 w-5" />
          </Button>
        }
      >
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">予定はありません</p>
        ) : (
          <div className="space-y-1.5">
            {events.map((occ) => (
              <EventChip
                key={`${occ.eventId}-${occ.originalStartAt.getTime()}`}
                occurrence={occ}
                members={family.members}
                onClick={() => onEdit(occ)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
