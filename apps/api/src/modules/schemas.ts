import { MEMBER_COLORS } from '@iegoto/domain'
import { z } from 'zod'

/** tRPC 入力の形式検証 (zod)。業務ルールは domain 層が担う (07 §5 の役割分担) */

export const memberColorSchema = z.enum(MEMBER_COLORS)

export const eventTimeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('timed'),
    startAt: z.date(),
    endAt: z.date(),
    timezone: z.string().default('Asia/Tokyo'),
  }),
  z.object({
    kind: z.literal('allDay'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
])

export const eventChangesSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  memo: z.string().max(2000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  time: eventTimeSchema.optional(),
  rrule: z.string().max(500).nullable().optional(),
  targetMemberIds: z.array(z.string().uuid()).max(20).optional(),
  assigneeMemberId: z.string().uuid().nullable().optional(),
  reminderMinutesBefore: z
    .number()
    .int()
    .min(0)
    .max(7 * 24 * 60)
    .nullable()
    .optional(),
})

export const editScopeSchema = z.enum(['this', 'following', 'all'])
