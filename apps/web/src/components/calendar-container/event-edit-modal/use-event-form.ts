import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useAppToast } from '@/hooks/use-app-toast'
import type { FamilyInfo } from '@/hooks/use-me'
import type { Occurrence, SuggestItem } from '@/lib/api-types'
import { useTRPC } from '@/lib/trpc'
import { jstDateKey } from '@/utils/date-format'
import { buildRRuleBody, parseRRuleBodyToForm, type RecurrenceForm } from '@/utils/recurrence'

export type EditTarget =
  | { mode: 'create'; dateKey: string; defaultMemberIds?: string[] }
  | { mode: 'edit'; occurrence: Occurrence }

export type EditScope = 'this' | 'following' | 'all'

type EventTimeInput =
  | { kind: 'timed'; startAt: Date; endAt: Date; timezone: string }
  | { kind: 'allDay'; startDate: string; endDate: string }

/** JST 壁時計の日付+時刻 → UTC Date (S-4: 入力は常に Asia/Tokyo) */
function jstToUtc(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time}:00+09:00`)
}

function occStartParts(occ: Occurrence): { dateKey: string; time: string } {
  if (occ.time.kind === 'timed') {
    const key = jstDateKey(occ.time.startAt)
    const t = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(occ.time.startAt)
    return { dateKey: key, time: t }
  }
  return { dateKey: occ.time.startDate, time: '10:00' }
}

/** 予定フォームのロジック集約 (06 §2 規約: container の use-*.ts)。F-03 全域 */
export function useEventForm(target: EditTarget, family: FamilyInfo, onClose: () => void) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const toast = useAppToast()

  const editing = target.mode === 'edit' ? target.occurrence : null
  const initialDateKey =
    target.mode === 'create' ? target.dateKey : occStartParts(target.occurrence).dateKey

  const [title, setTitle] = useState(editing?.title ?? '')
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [isAllDay, setIsAllDay] = useState(editing !== null && editing.time.kind === 'allDay')
  const [dateKey, setDateKey] = useState(initialDateKey)
  const [endDateKey, setEndDateKey] = useState(
    editing?.time.kind === 'allDay' ? editing.time.endDate : initialDateKey,
  )
  const [startTime, setStartTime] = useState(
    editing !== null ? occStartParts(editing).time : '10:00',
  )
  const [endTime, setEndTime] = useState(() => {
    if (editing?.time.kind === 'timed') {
      return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(editing.time.endAt)
    }
    return '11:00'
  })
  const [targetMemberIds, setTargetMemberIds] = useState<string[]>(() => {
    if (editing !== null) {
      return editing.targetMemberIds
    }
    // create 時: カレンダーのメンバーフィルタを初期値に (削除済みメンバーは除外)
    const activeIds = new Set(family.members.filter((m) => !m.isDeleted).map((m) => m.id))
    const defaults = target.mode === 'create' ? (target.defaultMemberIds ?? []) : []
    return defaults.filter((id) => activeIds.has(id))
  })
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    editing?.reminderMinutesBefore ?? null,
  )
  // 編集時: サーバの rrule はマスタ側にしかないため、isRecurring な occurrence の
  // 繰り返し変更は「カスタム維持 (undefined=変更なし)」から開始する
  const [recurrence, setRecurrence] = useState<RecurrenceForm | null>(
    target.mode === 'create' ? { freq: 'none' } : null,
  )
  const [scopeDialog, setScopeDialog] = useState<'save' | 'delete' | null>(null)

  // 過去予定サジェスト (S-5): create 時のみ・300ms デバウンス
  const [debouncedTitle, setDebouncedTitle] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTitle(title), 300)
    return () => clearTimeout(timer)
  }, [title])
  const [suggestDismissed, setSuggestDismissed] = useState(false)
  const suggestQuery = useQuery({
    ...trpc.event.suggest.queryOptions({ query: debouncedTitle }),
    enabled: target.mode === 'create' && debouncedTitle.trim().length > 0 && !suggestDismissed,
  })

  const applySuggestion = (s: SuggestItem) => {
    setTitle(s.title)
    setLocation(s.location ?? '')
    setIsAllDay(s.isAllDay)
    setTargetMemberIds(s.targetMemberIds)
    if (!s.isAllDay && s.startTimeLocal !== null && s.durationMinutes !== null) {
      setStartTime(s.startTimeLocal)
      const start = jstToUtc(dateKey, s.startTimeLocal)
      const end = new Date(start.getTime() + s.durationMinutes * 60000)
      setEndTime(
        new Intl.DateTimeFormat('ja-JP', {
          timeZone: 'Asia/Tokyo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(end),
      )
    }
    setSuggestDismissed(true)
  }

  const buildTime = (): EventTimeInput =>
    isAllDay
      ? { kind: 'allDay', startDate: dateKey, endDate: endDateKey < dateKey ? dateKey : endDateKey }
      : {
          kind: 'timed',
          startAt: jstToUtc(dateKey, startTime),
          endAt: jstToUtc(dateKey, endTime),
          timezone: 'Asia/Tokyo',
        }

  const baseDate = useMemo(() => {
    const d = new Date(`${dateKey}T00:00:00Z`)
    return { weekday: d.getUTCDay(), day: d.getUTCDate() }
  }, [dateKey])

  const invalidateAndClose = async (message: string) => {
    await queryClient.invalidateQueries(trpc.event.pathFilter())
    toast.success(message)
    onClose()
  }

  const createMutation = useMutation(
    trpc.event.create.mutationOptions({
      onSuccess: () => invalidateAndClose('予定を作成しました'),
      onError: (e) => toast.error(e.message),
    }),
  )
  const updateMutation = useMutation(
    trpc.event.update.mutationOptions({
      onSuccess: () => invalidateAndClose('予定を更新しました'),
      onError: (e) => toast.error(e.message),
    }),
  )
  const deleteMutation = useMutation(
    trpc.event.delete.mutationOptions({
      onSuccess: () => invalidateAndClose('予定を削除しました'),
      onError: (e) => toast.error(e.message),
    }),
  )

  const submitCreate = () => {
    const rrule = recurrence === null ? null : buildRRuleBody(recurrence, baseDate)
    createMutation.mutate({
      title,
      memo: memo.trim() === '' ? null : memo,
      location: location.trim() === '' ? null : location,
      time: buildTime(),
      rrule,
      targetMemberIds,
      reminderMinutesBefore: reminderMinutes,
    })
  }

  const submitUpdate = (scope: EditScope) => {
    if (editing === null) return
    updateMutation.mutate({
      eventId: editing.eventId,
      scope,
      originalStartAt: editing.originalStartAt,
      occurrenceTime: editing.time,
      changes: {
        title,
        memo: memo.trim() === '' ? null : memo,
        location: location.trim() === '' ? null : location,
        time: buildTime(),
        targetMemberIds,
        reminderMinutesBefore: reminderMinutes,
        // 'this' はマスタの繰り返しを触らない。'all'/'following' も明示変更時のみ
        ...(scope !== 'this' && recurrence !== null
          ? { rrule: buildRRuleBody(recurrence, baseDate) }
          : {}),
      },
    })
  }

  const submitDelete = (scope: EditScope) => {
    if (editing === null) return
    deleteMutation.mutate({
      eventId: editing.eventId,
      scope,
      originalStartAt: editing.originalStartAt,
    })
  }

  const requestSave = () => {
    if (title.trim().length === 0) {
      toast.error('タイトルを入力してください')
      return
    }
    if (target.mode === 'create') {
      submitCreate()
    } else if (editing?.isRecurring === true) {
      setScopeDialog('save')
    } else {
      submitUpdate('all')
    }
  }

  const requestDelete = () => {
    if (editing?.isRecurring === true) {
      setScopeDialog('delete')
    } else {
      submitDelete('all')
    }
  }

  return {
    mode: target.mode,
    isRecurring: editing?.isRecurring ?? false,
    members: family.members.filter((m) => !m.isDeleted),
    title,
    setTitle,
    memo,
    setMemo,
    location,
    setLocation,
    isAllDay,
    setIsAllDay,
    dateKey,
    setDateKey,
    endDateKey,
    setEndDateKey,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    targetMemberIds,
    setTargetMemberIds,
    reminderMinutes,
    setReminderMinutes,
    recurrence,
    setRecurrence,
    baseDate,
    suggestions: suggestDismissed ? [] : (suggestQuery.data ?? []),
    applySuggestion,
    dismissSuggestions: () => setSuggestDismissed(true),
    scopeDialog,
    closeScopeDialog: () => setScopeDialog(null),
    submitWithScope: (scope: EditScope) => {
      setScopeDialog(null)
      if (scopeDialog === 'save') {
        submitUpdate(scope)
      } else {
        submitDelete(scope)
      }
    },
    requestSave,
    requestDelete,
    isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  }
}

export { parseRRuleBodyToForm }
