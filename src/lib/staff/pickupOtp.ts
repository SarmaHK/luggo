import { createHmac, randomInt, timingSafeEqual } from 'crypto'

// Pickup codes are proof that the person at the counter holds the customer's phone.
// Six digits, stored only as a keyed hash tied to the booking, so reading the table
// (including as hub staff) does not reveal a usable code.

const PREFIX = 'h1:'

function secret(): string {
  const value = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!value) throw new Error('OTP hashing secret is not configured')
  return value
}

export function generatePickupOtp(): string {
  return randomInt(100000, 1000000).toString()
}

export function hashPickupOtp(otp: string, bookingId: string): string {
  return PREFIX + createHmac('sha256', secret()).update(`${bookingId}:${otp}`).digest('hex')
}

/** Constant-time comparison. Codes stored before hashing was introduced never match. */
export function pickupOtpMatches(stored: string | null, otp: string, bookingId: string): boolean {
  if (!stored || !stored.startsWith(PREFIX)) return false
  const expected = Buffer.from(stored)
  const actual = Buffer.from(hashPickupOtp(otp, bookingId))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
