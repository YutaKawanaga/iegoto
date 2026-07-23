import { InvitationRepository } from '@iegoto/db'
import { z } from 'zod'
import { authedProcedure, familyProcedure, featureFlags, router } from '../trpc.js'
import { getMe } from './account/usecases/get-me.js'
import { createEvent } from './event/usecases/create-event.js'
import { deleteEvent } from './event/usecases/delete-event.js'
import { listMyAssignedEvents, listUnassignedEvents } from './event/usecases/list-assignments.js'
import { listEventsInRange } from './event/usecases/list-events-in-range.js'
import { suggestPastEvents } from './event/usecases/suggest-past-events.js'
import { updateEvent } from './event/usecases/update-event.js'
import { issueInvitation } from './family/usecases/issue-invitation.js'
import { joinFamilyByInvitation, previewInvitation } from './family/usecases/join-family.js'
import { renameFamily } from './family/usecases/rename-family.js'
import { signUpFamily } from './family/usecases/sign-up-family.js'
import { addMember } from './member/usecases/add-member.js'
import { leaveFamily } from './member/usecases/leave-family.js'
import { softDeleteMember } from './member/usecases/soft-delete-member.js'
import { updateMember } from './member/usecases/update-member.js'
import { withEventChangeNotification } from './push/notify-event-change.js'
import * as push from './push/usecases/push-usecases.js'
import {
  editScopeSchema,
  eventChangesSchema,
  eventTimeSchema,
  memberColorSchema,
} from './schemas.js'
import * as shopping from './shopping/usecases/shopping-usecases.js'

/**
 * tRPC router (07 §3): procedure は「入力検証 → ctx → usecase 呼び出し」だけの薄い adapter。
 * ロジック・クエリをここに書かない
 */
export const appRouter = router({
  account: router({
    me: authedProcedure.query(({ ctx }) => getMe(ctx)),
  }),

  family: router({
    signUp: authedProcedure
      .input(
        z.object({
          familyName: z.string().min(1).max(50),
          myDisplayName: z.string().min(1).max(30),
        }),
      )
      .mutation(({ ctx, input }) => signUpFamily(ctx, input)),
    rename: familyProcedure
      .input(z.object({ name: z.string().min(1).max(50) }))
      .mutation(({ ctx, input }) => renameFamily(ctx, input)),
    invitation: router({
      issue: familyProcedure.mutation(({ ctx }) => issueInvitation(ctx)),
      active: familyProcedure.query(async ({ ctx }) => {
        const active = await new InvitationRepository(ctx.db).findActive(ctx.familyId, new Date())
        return active === null ? null : { expiresAt: active.expiresAt }
      }),
      revoke: familyProcedure.mutation(async ({ ctx }) => {
        await new InvitationRepository(ctx.db).revokeAllActive(ctx.familyId, new Date())
      }),
      preview: authedProcedure
        .input(z.object({ token: z.string().min(1).max(200) }))
        .query(({ ctx, input }) => previewInvitation(ctx, input.token)),
      join: authedProcedure
        .input(
          z.object({
            token: z.string().min(1).max(200),
            mode: z.enum(['new', 'link']),
            displayName: z.string().min(1).max(30).optional(),
            memberId: z.string().uuid().optional(),
          }),
        )
        .mutation(({ ctx, input }) => joinFamilyByInvitation(ctx, input)),
    }),
  }),

  member: router({
    add: familyProcedure
      .input(
        z.object({ displayName: z.string().min(1).max(30), color: memberColorSchema.optional() }),
      )
      .mutation(({ ctx, input }) => addMember(ctx, input)),
    update: familyProcedure
      .input(
        z.object({
          memberId: z.string().uuid(),
          displayName: z.string().min(1).max(30).optional(),
          color: memberColorSchema.optional(),
          icon: z.string().max(16).nullable().optional(),
        }),
      )
      .mutation(({ ctx, input }) => updateMember(ctx, input)),
    softDelete: familyProcedure
      .input(z.object({ memberId: z.string().uuid() }))
      .mutation(({ ctx, input }) => softDeleteMember(ctx, input)),
    leave: familyProcedure.mutation(({ ctx }) => leaveFamily(ctx)),
  }),

  event: router({
    listInRange: familyProcedure
      .input(z.object({ start: z.date(), end: z.date() }))
      .query(({ ctx, input }) => listEventsInRange(ctx, input)),
    create: familyProcedure
      .input(
        z.object({
          title: z.string().min(1).max(200),
          memo: z.string().max(2000).nullable().optional(),
          location: z.string().max(200).nullable().optional(),
          time: eventTimeSchema,
          rrule: z.string().max(500).nullable().optional(),
          targetMemberIds: z.array(z.string().uuid()).max(20),
          assigneeMemberId: z.string().uuid().nullable().optional(),
          reminderMinutesBefore: z
            .number()
            .int()
            .min(0)
            .max(7 * 24 * 60)
            .nullable()
            .optional(),
        }),
      )
      .mutation(({ ctx, input }) => createEvent(ctx, input)),
    update: familyProcedure
      .input(
        z.object({
          eventId: z.string().uuid(),
          scope: editScopeSchema,
          originalStartAt: z.date().optional(),
          occurrenceTime: eventTimeSchema.optional(),
          changes: eventChangesSchema,
        }),
      )
      .mutation(({ ctx, input }) =>
        withEventChangeNotification(ctx, input.eventId, '変更', () => updateEvent(ctx, input)),
      ),
    delete: familyProcedure
      .input(
        z.object({
          eventId: z.string().uuid(),
          scope: editScopeSchema,
          originalStartAt: z.date().optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        withEventChangeNotification(ctx, input.eventId, '削除', () => deleteEvent(ctx, input)),
      ),
    suggest: familyProcedure
      .input(z.object({ query: z.string().max(200) }))
      .query(({ ctx, input }) => suggestPastEvents(ctx, input)),
    myAssigned: familyProcedure.query(({ ctx }) => listMyAssignedEvents(ctx)),
    unassigned: familyProcedure.query(({ ctx }) => listUnassignedEvents(ctx)),
  }),

  push: router({
    status: familyProcedure.query(({ ctx }) => push.getPushStatus(ctx)),
    subscribe: familyProcedure
      .input(
        z.object({
          endpoint: z.string().url().max(2000),
          p256dh: z.string().min(1).max(500),
          auth: z.string().min(1).max(500),
        }),
      )
      .mutation(({ ctx, input }) => push.subscribePush(ctx, input)),
    unsubscribe: familyProcedure
      .input(z.object({ endpoint: z.string().url().max(2000) }))
      .mutation(({ ctx, input }) => push.unsubscribePush(ctx, input)),
    updateSetting: familyProcedure
      .input(
        z.object({
          eventCreated: z.boolean(),
          eventChanged: z.boolean(),
          reminder: z.boolean(),
        }),
      )
      .mutation(({ ctx, input }) => push.updateNotificationSetting(ctx, input)),
  }),

  shopping: router({
    lists: familyProcedure.query(({ ctx }) => shopping.listShoppingLists(ctx)),
    createList: familyProcedure
      .input(z.object({ name: z.string().min(1).max(50) }))
      .mutation(({ ctx, input }) => shopping.createList(ctx, input)),
    renameList: familyProcedure
      .input(z.object({ listId: z.string().uuid(), name: z.string().min(1).max(50) }))
      .mutation(({ ctx, input }) => shopping.renameList(ctx, input)),
    deleteList: familyProcedure
      .input(z.object({ listId: z.string().uuid() }))
      .mutation(({ ctx, input }) => shopping.deleteList(ctx, input)),
    addItem: familyProcedure
      .input(z.object({ listId: z.string().uuid(), name: z.string().min(1).max(100) }))
      .mutation(({ ctx, input }) => shopping.addItem(ctx, input)),
    setItemChecked: familyProcedure
      .input(z.object({ itemId: z.string().uuid(), checked: z.boolean() }))
      .mutation(({ ctx, input }) => shopping.setItemChecked(ctx, input)),
    deleteItem: familyProcedure
      .input(z.object({ itemId: z.string().uuid() }))
      .mutation(({ ctx, input }) => shopping.deleteItem(ctx, input)),
    uncheckedCount: familyProcedure.query(({ ctx }) => shopping.countUnchecked(ctx)),
    frequentItems: familyProcedure.query(({ ctx }) => shopping.frequentItemNames(ctx)),
  }),

  featureFlags: router({
    list: familyProcedure.query(({ ctx }) => featureFlags.evaluateAll(ctx.familyId)),
  }),
})

export type AppRouter = typeof appRouter
