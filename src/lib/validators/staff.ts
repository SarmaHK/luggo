import { z } from 'zod'
import { normalizePhone } from '@/lib/validators/phone'

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use a time like 09:00')

/**
 * The only fields a hub staff member may change on their own hub. Anything else (capacity,
 * alias, coordinates, image, rates…) is admin-only. strictObject rejects unknown keys, so a
 * hand-crafted request cannot smuggle extra columns into the update.
 */
export const hubProfileUpdateSchema = z.strictObject({
  name: z.string().trim().min(3).max(100).optional(),
  address: z.string().trim().min(5).max(250).optional(),
  open_time: time.optional(),
  close_time: time.optional(),
  active_days: z.array(z.enum(WEEKDAYS)).max(7).optional(),
  active: z.boolean().optional(),
})

export type HubProfileUpdate = z.infer<typeof hubProfileUpdateSchema>

const MAX_WALK_IN_BAGS = 10

export const walkInBookingSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer name').max(100),
  phone: z.string().transform(normalizePhone).refine((v): v is string => v !== null, 'Enter a valid Sri Lankan phone number'),
  nicPassportRef: z.string().trim().min(3, 'Enter an ID or passport reference').max(30),
  bagTypes: z.array(z.enum(['small', 'regular', 'large'])).min(1, 'Add at least one bag').max(MAX_WALK_IN_BAGS),
  expectedPickupTime: z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Invalid pickup time'),
  paymentMethod: z.enum(['pay_online', 'pay_at_hub']),
})

export type WalkInBookingInput = z.infer<typeof walkInBookingSchema>

/** A walk-in pickup must be in the future and within a month. */
export function walkInPickupWindowError(expected: Date, now = new Date()): string | null {
  if (expected.getTime() <= now.getTime()) return 'Expected pickup time must be in the future.'
  if (expected.getTime() - now.getTime() > 30 * 24 * 60 * 60 * 1000) return 'Walk-in storage is limited to 30 days.'
  return null
}
