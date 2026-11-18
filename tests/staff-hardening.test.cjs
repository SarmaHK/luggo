const test = require('node:test')
const assert = require('node:assert/strict')
const { hubProfileUpdateSchema, walkInBookingSchema, walkInPickupWindowError } = require('../src/lib/validators/staff.ts')
const { generatePickupOtp, hashPickupOtp, pickupOtpMatches } = require('../src/lib/staff/pickupOtp.ts')
const { colomboDayRange } = require('../src/lib/utils/timezone.ts')

process.env.OTP_HASH_SECRET = 'test-secret'
const booking = '12345678-abcd-1234-abcd-123456789abc'
const otherBooking = '99999999-abcd-1234-abcd-123456789abc'

test('hub staff can edit only the allowed hub fields', () => {
  const ok = hubProfileUpdateSchema.safeParse({ name: 'Fort Hub', address: '1 Main Street', open_time: '09:00:00', close_time: '21:30', active_days: ['monday', 'sunday'], active: false })
  assert.equal(ok.success, true)
  for (const extra of [{ capacity: 100000 }, { alias: 'HACK' }, { latitude: 1 }, { image_url: 'x' }, { id: booking }, { staff_paused: false }]) {
    assert.equal(hubProfileUpdateSchema.safeParse({ name: 'Fort Hub', ...extra }).success, false, JSON.stringify(extra))
  }
  assert.equal(hubProfileUpdateSchema.safeParse({ open_time: '25:00' }).success, false)
  assert.equal(hubProfileUpdateSchema.safeParse({ active_days: ['funday'] }).success, false)
  assert.equal(hubProfileUpdateSchema.safeParse({ name: 'ab' }).success, false)
})

test('walk-in input is validated and the phone is normalised', () => {
  const base = { name: 'Nimal Perera', phone: '071 234 5678', nicPassportRef: 'N1234567', bagTypes: ['small', 'regular'], expectedPickupTime: '2026-12-01T10:00:00.000Z', paymentMethod: 'pay_at_hub' }
  const ok = walkInBookingSchema.safeParse({ ...base, hubId: 'ignored', bagCount: 2 })
  assert.equal(ok.success, true)
  assert.equal(ok.data.phone, '+94712345678')
  assert.equal('hubId' in ok.data, false)
  for (const bad of [{ bagTypes: [] }, { bagTypes: Array(11).fill('small') }, { bagTypes: ['huge'] }, { phone: '123' }, { name: 'x' }, { expectedPickupTime: 'soon' }, { paymentMethod: 'free' }]) {
    assert.equal(walkInBookingSchema.safeParse({ ...base, ...bad }).success, false, JSON.stringify(bad))
  }
})

test('walk-in pickup must be in the future and within 30 days', () => {
  const now = new Date('2026-11-18T10:00:00Z')
  assert.match(walkInPickupWindowError(new Date('2026-11-18T09:00:00Z'), now), /future/)
  assert.match(walkInPickupWindowError(new Date('2026-12-30T10:00:00Z'), now), /30 days/)
  assert.equal(walkInPickupWindowError(new Date('2026-11-19T10:00:00Z'), now), null)
})

test('pickup codes are six digits, hashed, and tied to their booking', () => {
  for (let i = 0; i < 200; i++) assert.match(generatePickupOtp(), /^\d{6}$/)
  const hash = hashPickupOtp('123456', booking)
  assert.ok(hash.startsWith('h1:') && !hash.includes('123456'))
  assert.equal(pickupOtpMatches(hash, '123456', booking), true)
  assert.equal(pickupOtpMatches(hash, '123457', booking), false)
  assert.equal(pickupOtpMatches(hash, '123456', otherBooking), false)
  // a plaintext code stored before hashing existed, or nothing at all, never matches
  assert.equal(pickupOtpMatches('123456', '123456', booking), false)
  assert.equal(pickupOtpMatches(null, '123456', booking), false)
})

test('"today" is the Sri Lanka calendar day, not the server day', () => {
  // 20:00 UTC on 18 Nov is 01:30 on 19 Nov in Sri Lanka
  const late = colomboDayRange(new Date('2026-11-18T20:00:00Z'))
  assert.equal(late.start.toISOString(), '2026-11-18T18:30:00.000Z')
  assert.equal(late.end.toISOString(), '2026-11-19T18:29:59.999Z')
  const noon = colomboDayRange(new Date('2026-11-18T10:00:00Z'))
  assert.equal(noon.start.toISOString(), '2026-11-17T18:30:00.000Z')
})
