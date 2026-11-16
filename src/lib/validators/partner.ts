import { z } from 'zod'
import { normalizePhone } from '@/lib/validators/phone'

export const PARTNER_BUSINESS_TYPES = ['hotel', 'guesthouse', 'shop', 'cafe', 'travel', 'other'] as const
export type PartnerBusinessType = (typeof PARTNER_BUSINESS_TYPES)[number]

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const optionalTime = time.optional().or(z.literal(''))

export const partnerApplicationSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(100),
  phone: z.string().transform(normalizePhone).refine((v): v is string => v !== null),
  email: z.string().trim().toLowerCase().email().max(200),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(250),
  businessType: z.enum(PARTNER_BUSINESS_TYPES),
  storageCapacity: z.number().int().min(1).max(1000).optional(),
  openTime: optionalTime,
  closeTime: optionalTime,
  notes: z.string().trim().max(1000).optional(),
  locale: z.enum(['en', 'si', 'ta']).optional(),
  ref: z.string().optional(),
  invite: z.string().optional(),
  // Honeypot: real people never see or fill this field.
  website: z.string().optional(),
})

export type PartnerApplicationInput = z.input<typeof partnerApplicationSchema>

/** Referral codes from /partners?ref=CODE: short, URL-safe, otherwise ignored. */
export function cleanRefCode(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return /^[A-Za-z0-9_-]{1,40}$/.test(trimmed) ? trimmed : null
}

export function cleanInviteToken(value: string | null | undefined): string | null {
  if (!value) return null
  return /^[A-Za-z0-9_-]{20,64}$/.test(value) ? value : null
}

export const approvePartnerSchema = z.object({
  alias: z.string().regex(/^[A-Z]{2,6}$/, 'Alias must be 2-6 uppercase letters (e.g. CMB)'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(1000, 'Capacity cannot exceed 1000'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})
