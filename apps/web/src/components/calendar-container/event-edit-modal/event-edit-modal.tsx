import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { FamilyInfo } from '@/hooks/use-me'
import { MEMBER_BG } from '@/lib/member-colors'
import { cn } from '@/lib/utils'
import { RecurrenceEditor } from './recurrence-editor'
import { type EditScope, type EditTarget, useEventForm } from './use-event-form'

const REMINDER_OPTIONS = [
  { value: '', label: 'なし' },
  { value: '10', label: '10分前' },
  { value: '30', label: '30分前' },
  { value: '60', label: '1時間前' },
  { value: '1440', label: '1日前' },
] as const

type Props = { target: EditTarget; family: FamilyInfo; onClose: () => void }

/** 予定の作成・編集モーダル (F-03)。送迎する人も対象メンバーに含めて表現する */
export function EventEditModal({ target, family, onClose }: Props) {
  const f = useEventForm(target, family, onClose)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={f.mode === 'create' ? '予定を作成' : '予定を編集'}
        footer={
          <>
            {f.scopeDialog !== null && (
              <ScopeDialog
                action={f.scopeDialog}
                onCancel={f.closeScopeDialog}
                onSubmit={f.submitWithScope}
              />
            )}
            <div className="flex justify-between">
              {f.mode === 'edit' ? (
                <Button variant="destructive" onClick={f.requestDelete} disabled={f.isPending}>
                  削除
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={f.requestSave} disabled={f.isPending}>
                保存
              </Button>
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Input
              placeholder="タイトル"
              value={f.title}
              onChange={(e) => f.setTitle(e.target.value)}
              maxLength={200}
              autoFocus={f.mode === 'create'}
            />
            {f.suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-11 z-10 rounded-lg border border-border bg-card shadow-lg">
                {f.suggestions.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => f.applySuggestion(s)}
                  >
                    <span>{s.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.isAllDay ? '終日' : s.startTimeLocal}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="w-full border-t border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  onClick={f.dismissSuggestions}
                >
                  候補を閉じる
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="all-day"
              checked={f.isAllDay}
              onCheckedChange={(v) => f.setIsAllDay(v === true)}
            />
            <Label htmlFor="all-day">終日</Label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              className="w-40"
              value={f.dateKey}
              onChange={(e) => f.setDateKey(e.target.value)}
            />
            {f.isAllDay ? (
              <>
                <span className="text-sm text-muted-foreground">〜</span>
                <Input
                  type="date"
                  className="w-40"
                  value={f.endDateKey}
                  onChange={(e) => f.setEndDateKey(e.target.value)}
                />
              </>
            ) : (
              <>
                <Input
                  type="time"
                  className="w-28"
                  value={f.startTime}
                  onChange={(e) => f.setStartTime(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">〜</span>
                <Input
                  type="time"
                  className="w-28"
                  value={f.endTime}
                  onChange={(e) => f.setEndTime(e.target.value)}
                />
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>対象メンバー (誰の予定か)</Label>
            <div className="flex flex-wrap gap-2">
              {f.members.map((m) => {
                const selected = f.targetMemberIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      f.setTargetMemberIds(
                        selected
                          ? f.targetMemberIds.filter((id) => id !== m.id)
                          : [...f.targetMemberIds, m.id],
                      )
                    }
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm',
                      selected && 'border-primary bg-primary/10',
                    )}
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full', MEMBER_BG[m.color])} />
                    {m.displayName}
                  </button>
                )
              })}
            </div>
          </div>

          {!f.isAllDay && (
            <div className="space-y-1.5">
              <Label>リマインダー</Label>
              <Select
                value={f.reminderMinutes === null ? '' : String(f.reminderMinutes)}
                onChange={(e) =>
                  f.setReminderMinutes(e.target.value === '' ? null : Number(e.target.value))
                }
              >
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>繰り返し</Label>
            <RecurrenceEditor
              value={f.recurrence}
              onChange={f.setRecurrence}
              baseDate={f.baseDate}
            />
          </div>

          <div className="space-y-1.5">
            <Label>メモ</Label>
            <Textarea value={f.memo} onChange={(e) => f.setMemo(e.target.value)} maxLength={2000} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 繰り返し予定の編集スコープ3択 (F-03: この予定のみ / これ以降すべて / すべて) */
function ScopeDialog({
  action,
  onCancel,
  onSubmit,
}: {
  action: 'save' | 'delete'
  onCancel: () => void
  onSubmit: (scope: EditScope) => void
}) {
  const [scope, setScope] = useState<EditScope>('this')
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/50 p-4">
      <p className="mb-3 text-sm font-medium">
        繰り返し予定を{action === 'save' ? '変更' : '削除'}する範囲
      </p>
      <div className="space-y-3">
        <RadioGroup
          value={scope}
          onValueChange={(v) => setScope(v as EditScope)}
          className="space-y-2"
        >
          {(
            [
              ['this', 'この予定のみ'],
              ['following', 'これ以降すべて'],
              ['all', 'すべての予定'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={value} />
              {label}
            </label>
          ))}
        </RadioGroup>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            キャンセル
          </Button>
          <Button size="sm" onClick={() => onSubmit(scope)}>
            OK
          </Button>
        </div>
      </div>
    </div>
  )
}
