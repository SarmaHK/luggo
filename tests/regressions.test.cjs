const test = require('node:test')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { bookingReferenceRange } = require('../src/lib/utils/bookingReference.ts')
const { parseExtensionOrder } = require('../src/lib/utils/paymentOrder.ts')
const { normalizePhone, sendPhoneCodeSchema, verifyPhoneCodeSchema } = require('../src/lib/validators/phone.ts')
const { createBookingSchema } = require('../src/lib/validators/booking.ts')
const { calculateBagPriceForHours, calculateLateFee } = require('../src/lib/utils/pricing.ts')
const { verifyPayhereIPN } = require('../src/lib/utils/payhere.ts')
const { verifyCron } = require('../src/lib/utils/cron.ts')
const { NextRequest } = require('next/server')
const id = '12345678-abcd-1234-abcd-123456789abc'

test('walk-in and partial UUID references produce a valid UUID range', () => {
  assert.deepEqual(bookingReferenceRange('WI-ABCDEF12'), {
    lower: 'abcdef12-0000-0000-0000-000000000000', upper: 'abcdef12-ffff-ffff-ffff-ffffffffffff',
  })
  assert.deepEqual(bookingReferenceRange(id), { lower: id, upper: id })
  for (const value of ['123', 'WI-invalid!', '%', 'abcdef12345678901234567890123456789']) assert.equal(bookingReferenceRange(value), null)
})
test('extension order parser preserves UUID hyphens, duration, and quoted end time', () => {
  const end = Date.UTC(2026, 9, 10, 12)
  assert.deepEqual(parseExtensionOrder(`ext_${id}_24_${end}`), { paymentId: id, hours: 24, endTime: new Date(end).toISOString() })
  assert.deepEqual(parseExtensionOrder(`ext-${id}-4`), { paymentId: id, hours: 4, endTime: null })
  for (const value of [`ext_${id}_0`, `ext_${id}_169`, `ext_${id}_2.5`, `ext_${id}_4oops`, `ext_bad_4`, `ext_${id}_4_9999999999999999999`]) assert.equal(parseExtensionOrder(value), null)
})
test('phone aliases share the same canonical identity and rate-limit key', () => {
  for (const value of ['0771234567', '+94 77 123 4567', '94771234567', '771234567']) assert.equal(normalizePhone(value), '+94771234567')
  for (const value of ['garbage0771234567', '123', '++x', '']) assert.equal(sendPhoneCodeSchema.safeParse({ phone: value }).success, false)
  assert.equal(verifyPhoneCodeSchema.safeParse({ phone: '0771234567', otp: '123456', name: 9 }).success, false)
  assert.equal(verifyPhoneCodeSchema.safeParse({ phone: '0771234567', otp: 123456 }).success, false)
  assert.equal(verifyPhoneCodeSchema.safeParse({ phone: '0771234567', otp: '123456' }).success, true)
})
test('daily caps allow a zero-cost extension and late fees respect grace and half hours', () => {
  assert.equal(calculateBagPriceForHours('small', 8), 600)
  assert.equal(calculateBagPriceForHours('small', 10), 600)
  assert.equal(calculateBagPriceForHours('small', 25), 680)
  const start = new Date('2026-10-10T10:00:00Z'), end = new Date('2026-10-10T11:00:00Z')
  assert.equal(calculateLateFee([{ bag_type: 'small' }], start, end, new Date('2026-10-10T11:15:00Z')), 0)
  assert.equal(calculateLateFee([{ bag_type: 'small' }], start, end, new Date('2026-10-10T11:16:00Z')), 40)
})
test('booking validation rejects malformed dates, missing terms and zero duration', () => {
  const valid = { hub_id: id, start_time: '2099-01-01T10:00:00+05:30', end_time: '2099-01-01T11:00:00+05:30', bags: [{ bag_type: 'small' }], terms_accepted: true }
  assert.equal(createBookingSchema.safeParse(valid).success, true)
  for (const overrides of [{ end_time: valid.start_time }, { terms_accepted: false }, { bags: [] }, { start_time: 'bad' }]) assert.equal(createBookingSchema.safeParse({ ...valid, ...overrides }).success, false)
})
test('payment signature cannot confirm a changed amount or unsuccessful payment', () => {
  const params = { merchant_id: 'merchant', order_id: id, payhere_amount: '120.00', payhere_currency: 'LKR', status_code: '2', merchant_secret: 'test-secret' }
  const md5 = value => createHash('md5').update(value).digest('hex').toUpperCase()
  const md5sig = md5(params.merchant_id + id + '120.00LKR2' + md5(params.merchant_secret))
  assert.equal(verifyPayhereIPN({ ...params, md5sig }), true)
  assert.equal(verifyPayhereIPN({ ...params, md5sig, payhere_amount: '1.00' }), false)
  assert.equal(verifyPayhereIPN({ ...params, md5sig, status_code: '0' }), false)
})
test('cron endpoints require the configured bearer secret', () => {
  const previous = process.env.CRON_SECRET
  process.env.CRON_SECRET = 'test-cron'
  try {
    assert.equal(verifyCron(new NextRequest('http://localhost/api/cron/expire-bookings')).status, 401)
    assert.equal(verifyCron(new NextRequest('http://localhost/api/cron/expire-bookings', { headers: { authorization: 'Bearer test-cron' } })), null)
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  }
})

const serviceModule = require('../src/lib/supabase/service.ts')
const webhook = require('../src/app/api/webhooks/payhere/route.ts')
function signedNotification(orderId = `ext_${id}_4_1791633600000`) {
  const values = { merchant_id: 'test-merchant', order_id: orderId, payment_id: 'gateway-123', payhere_amount: '120.00', payhere_currency: 'LKR', status_code: '2' }
  const md5 = value => createHash('md5').update(value).digest('hex').toUpperCase()
  values.md5sig = md5(values.merchant_id + values.order_id + values.payhere_amount + values.payhere_currency + values.status_code + md5('test-secret'))
  return new NextRequest('http://localhost/api/webhooks/payhere', { method: 'POST', body: new URLSearchParams(values) })
}
test('webhook asks the gateway to retry when the database transaction fails', async () => {
  const original = serviceModule.createServiceClient
  const previousMerchant = process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID
  const previousSecret = process.env.PAYHERE_MERCHANT_SECRET
  process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID = 'test-merchant'
  process.env.PAYHERE_MERCHANT_SECRET = 'test-secret'
  let called = false
  serviceModule.createServiceClient = () => ({
    from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { type: 'extension' }, error: null }) }; return query },
    rpc: async (name, args) => { called = true; assert.equal(name, 'apply_payhere_payment'); assert.equal(args.p_extension_hours, 4); assert.equal(args.p_payment_id, id); return { error: { message: 'simulated database failure' } } },
  })
  try { assert.equal((await webhook.POST(signedNotification())).status, 500); assert.equal(called, true) }
  finally {
    serviceModule.createServiceClient = original
    if (previousMerchant === undefined) delete process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID; else process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID = previousMerchant
    if (previousSecret === undefined) delete process.env.PAYHERE_MERCHANT_SECRET; else process.env.PAYHERE_MERCHANT_SECRET = previousSecret
  }
})
test('concurrently consumed OTP cannot establish another session', async () => {
  process.env.OTP_HASH_SECRET = 'test-otp-secret'
  const original = serviceModule.createServiceClient
  let calls = 0
  serviceModule.createServiceClient = () => ({ from: () => {
    const query = { select: () => query, eq: () => query, is: () => query, gte: () => query, order: () => query, limit: () => query,
      single: async () => ({ data: { otp: 'hash', expires_at: '2099-01-01' } }), update: () => query,
      then: resolve => { calls++; return Promise.resolve({ data: [], error: null }).then(resolve) } }
    return query
  } })
  try {
    const { POST } = require('../src/app/api/auth/phone/verify/route.ts')
    const req = new NextRequest('http://localhost/api/auth/phone/verify', { method: 'POST', body: JSON.stringify({ phone: '0771234567', otp: '123456' }), headers: { 'content-type': 'application/json' } })
    assert.equal((await POST(req)).status, 400)
    assert.equal(calls, 1)
  } finally { serviceModule.createServiceClient = original }
})

test('a reminder already claimed by another request sends no notification', async () => {
  const original = serviceModule.createServiceClient
  const previous = process.env.CRON_SECRET
  process.env.CRON_SECRET = 'test-cron'
  const filters = []
  let claimAttempted = false
  serviceModule.createServiceClient = () => ({ from: table => {
    assert.equal(table, 'bookings')
    const query = { select: () => query, eq: (column, value) => { filters.push([column, value]); return query },
      is: (column, value) => { filters.push([column, value]); return query }, gt: () => query, lte: () => query,
      update: () => { claimAttempted = true; return query }, maybeSingle: async () => ({ data: null, error: null }),
      then: resolve => Promise.resolve({ data: [{ id, end_time: new Date(Date.now() + 60 * 60000).toISOString(), users: { id, name: 'Test' }, hubs: { name: 'Hub' } }], error: null }).then(resolve) }
    return query
  } })
  try {
    const { GET } = require('../src/app/api/cron/pickup-reminders/route.ts')
    const response = await GET(new NextRequest('http://localhost/api/cron/pickup-reminders', { headers: { authorization: 'Bearer test-cron' } }))
    assert.deepEqual(await response.json(), { sent: 0 })
    assert.equal(claimAttempted, true)
    assert.ok(filters.some(([column, value]) => column === 'reminder_sent_at' && value === null))
    assert.ok(filters.some(([column, value]) => column === 'status' && value === 'active_storage'))
  } finally {
    serviceModule.createServiceClient = original
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous
  }
})

test('bookings cannot be inserted or deleted directly by customers', () => {
  const fs = require('node:fs')
  for (const file of ['schema.sql', 'supabase/schema.sql', 'supabase/security_fix_01_bookings_no_client_insert.sql']) {
    const sql = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /create policy "bookings: insert own bookings"/i, file)
    assert.match(sql, /revoke insert, delete on public\.bookings from authenticated, anon/i, file)
  }
})

test('staff can only read users who have a booking at their hub', () => {
  const fs = require('node:fs')
  for (const file of ['schema.sql', 'supabase/schema.sql', 'supabase/security_fix_02_staff_users_hub_scope.sql']) {
    const sql = fs.readFileSync(file, 'utf8')
    const start = sql.indexOf('create policy "users: staff see own hub customers"')
    assert.ok(start >= 0, file)
    const policy = sql.slice(start, sql.indexOf(';', start))
    assert.match(policy, /public\.bookings/, file)
    assert.match(policy, /is_staff_at_hub\(b\.hub_id\)/, file)
    assert.doesNotMatch(policy, /from public\.hub_staff hs\s+where hs\.user_id = auth\.uid\(\) and hs\.active = true\s*\)/i, file)
  }
})

test('phone code cannot sign in to a staff or admin account', async () => {
  process.env.OTP_HASH_SECRET = 'test-otp-secret'
  // @supabase/ssr exports a non-configurable getter, so swap the whole cached module instead.
  const ssrPath = require.resolve('@supabase/ssr')
  const routePath = require.resolve('../src/app/api/auth/phone/verify/route.ts')
  const originalSsrEntry = require.cache[ssrPath]
  const originalRouteEntry = require.cache[routePath]
  const originalService = serviceModule.createServiceClient
  const sessionCalls = []
  const run = async role => {
    sessionCalls.length = 0
    let generatedLink = false
    serviceModule.createServiceClient = () => ({
      rpc: async () => ({ data: { allowed: true, retry_after_ms: 0 }, error: null }),
      auth: { admin: {
        getUserById: async () => ({ data: { user: { phone: '+94771234567', phone_confirmed_at: '2026-01-01' } } }),
        generateLink: async () => { generatedLink = true; return { data: null, error: new Error('should not be called') } },
        createUser: async () => { generatedLink = true; return { data: null, error: new Error('should not be called') } },
      } },
      from: table => {
        const query = { select: () => query, eq: () => query, is: () => query, gte: () => query, order: () => query, limit: () => query,
          in: () => query, update: () => query, delete: () => query,
          single: async () => ({ data: { otp: 'hash', expires_at: '2099-01-01' } }),
          maybeSingle: async () => ({ data: table === 'users' ? { id, email: 'staff@luggo.lk', role } : null, error: null }),
          then: resolve => Promise.resolve({ data: [{ phone: '+94771234567' }], error: null }).then(resolve) }
        return query
      },
    })
    require.cache[ssrPath] = { id: ssrPath, filename: ssrPath, loaded: true, exports: { createServerClient: () => ({ auth: {
      getUser: async () => ({ data: { user: null } }),
      verifyOtp: async () => { sessionCalls.push('verifyOtp'); return { error: null } },
    } }) } }
    delete require.cache[routePath]
    const { POST } = require('../src/app/api/auth/phone/verify/route.ts')
    const req = new NextRequest('http://localhost/api/auth/phone/verify', { method: 'POST', body: JSON.stringify({ phone: '0771234567', otp: '123456' }), headers: { 'content-type': 'application/json' } })
    const response = await POST(req)
    return { status: response.status, generatedLink, sessionCalls: [...sessionCalls] }
  }
  try {
    for (const role of ['hub_staff', 'support_admin', 'ops_admin', 'master_admin']) {
      assert.deepEqual(await run(role), { status: 403, generatedLink: false, sessionCalls: [] }, role)
    }
    const customer = await run('customer')
    assert.notEqual(customer.status, 403)
    assert.equal(customer.generatedLink, true)
  } finally {
    serviceModule.createServiceClient = originalService
    if (originalSsrEntry) require.cache[ssrPath] = originalSsrEntry; else delete require.cache[ssrPath]
    if (originalRouteEntry) require.cache[routePath] = originalRouteEntry; else delete require.cache[routePath]
  }
})

test('phone_otps is locked to the service role (RLS on, no client grants)', () => {
  const sql = require('node:fs').readFileSync('supabase/security_fix_03_phone_otps_rls.sql', 'utf8').replace(/--.*$/gm, '')
  assert.match(sql, /alter table public\.phone_otps enable row level security/i)
  assert.match(sql, /revoke all on public\.phone_otps from anon, authenticated/i)
  assert.doesNotMatch(sql, /create policy/i)
})
