import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  type BaseDate,
  type RecurrenceEnd,
  type RecurrenceForm,
  recurrenceSummary,
  WEEKDAY_LABELS,
} from '@/utils/recurrence'

type Props = {
  value: RecurrenceForm | null // null = カスタム (UIサブセット外) を維持
  onChange: (form: RecurrenceForm) => void
  baseDate: BaseDate
}

const DEFAULT_END: RecurrenceEnd = { type: 'never' }

/** 繰り返し設定 UI (F-03: Googleカレンダー相当の頻度・曜日・第n曜日・終了条件) */
export function RecurrenceEditor({ value, onChange, baseDate }: Props) {
  if (value === null) {
    return (
      <p className="text-xs text-muted-foreground">
        この予定はカスタムの繰り返し設定です (このまま保存すると設定を維持します)
      </p>
    )
  }

  const freqValue = value.freq
  const handleFreqChange = (freq: string) => {
    if (freq === 'none') onChange({ freq: 'none' })
    else if (freq === 'daily') onChange({ freq: 'daily', interval: 1, end: DEFAULT_END })
    else if (freq === 'weekly')
      onChange({ freq: 'weekly', interval: 1, weekdays: [baseDate.weekday], end: DEFAULT_END })
    else if (freq === 'monthlyDate') onChange({ freq: 'monthlyDate', end: DEFAULT_END })
    else if (freq === 'monthlyNth') onChange({ freq: 'monthlyNth', end: DEFAULT_END })
    else onChange({ freq: 'yearly', end: DEFAULT_END })
  }

  return (
    <div className="space-y-2">
      <Select value={freqValue} onChange={(e) => handleFreqChange(e.target.value)}>
        <option value="none">繰り返さない</option>
        <option value="daily">毎日</option>
        <option value="weekly">毎週</option>
        <option value="monthlyDate">毎月 (同じ日付)</option>
        <option value="monthlyNth">
          毎月 (第{Math.ceil(baseDate.day / 7)}
          {WEEKDAY_LABELS[baseDate.weekday]}曜日)
        </option>
        <option value="yearly">毎年</option>
      </Select>

      {value.freq === 'weekly' && (
        <div className="flex gap-1">
          {WEEKDAY_LABELS.map((label, i) => {
            const selected = value.weekdays.includes(i)
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const weekdays = selected
                    ? value.weekdays.filter((d) => d !== i)
                    : [...value.weekdays, i]
                  onChange({
                    ...value,
                    weekdays: weekdays.length > 0 ? weekdays : [baseDate.weekday],
                  })
                }}
                className={cn(
                  'h-9 w-9 rounded-full border border-border text-xs font-medium',
                  selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {(value.freq === 'daily' || value.freq === 'weekly') && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          間隔:
          <Input
            type="number"
            min={1}
            max={30}
            className="h-8 w-20"
            value={value.interval}
            onChange={(e) => onChange({ ...value, interval: Math.max(1, Number(e.target.value)) })}
          />
          {value.freq === 'daily' ? '日ごと' : '週ごと'}
        </label>
      )}

      {value.freq !== 'none' && (
        <div className="flex items-center gap-2">
          <Select
            className="h-8 w-32"
            value={value.end.type}
            onChange={(e) => {
              const t = e.target.value
              const end: RecurrenceEnd =
                t === 'until'
                  ? { type: 'until', date: new Date().toISOString().slice(0, 10) }
                  : t === 'count'
                    ? { type: 'count', count: 10 }
                    : { type: 'never' }
              onChange({ ...value, end })
            }}
          >
            <option value="never">終了なし</option>
            <option value="until">終了日</option>
            <option value="count">回数</option>
          </Select>
          {value.end.type === 'until' && (
            <Input
              type="date"
              className="h-8 w-40"
              value={value.end.date}
              onChange={(e) => onChange({ ...value, end: { type: 'until', date: e.target.value } })}
            />
          )}
          {value.end.type === 'count' && (
            <label className="flex items-center gap-1 text-sm text-muted-foreground">
              <Input
                type="number"
                min={1}
                max={999}
                className="h-8 w-20"
                value={value.end.count}
                onChange={(e) =>
                  onChange({
                    ...value,
                    end: { type: 'count', count: Math.max(1, Number(e.target.value)) },
                  })
                }
              />
              回
            </label>
          )}
        </div>
      )}

      {value.freq !== 'none' && (
        <p className="text-xs text-muted-foreground">{recurrenceSummary(value, baseDate)}</p>
      )}
    </div>
  )
}
