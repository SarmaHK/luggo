import { type SupabaseClient } from '@supabase/supabase-js'

// Plain module on purpose: a function exported from a 'use server' file becomes a callable endpoint.
//
// A unique DB index (hub_id, slot_number) guards against two concurrent registrations at the same
// hub claiming the same slot. On a conflict we just recompute against the current occupancy and retry.

export async function allocateSlotForBooking(
  supabase: SupabaseClient,
  hubId: string,
  bookingId: string,
  attemptsLeft = 3
): Promise<number> {
  // 1. Fetch occupied slot numbers
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('slot_number, status, end_time')
    .eq('hub_id', hubId)
    .not('slot_number', 'is', null)
    .in('status', [
      'confirmed',
      'pending_payment',
      'arrived',
      'identity_verified',
      'sealing_in_progress',
      'sealed_waiting_user_confirmation',
      'active_storage',
      'pickup_requested',
      'overstayed',
      'late_fee_pending'
    ])

  if (error) {
    throw new Error(`Failed to query slots: ${error.message}`)
  }

  const now = new Date()
  const occupiedSlots = new Set<number>()
  if (bookings) {
    for (const b of bookings) {
      if (b.status === 'confirmed' || b.status === 'pending_payment') {
        // If booking pickup time has passed, release slot (meaning we don't count it as occupied)
        const pickupTime = new Date(b.end_time)
        if (pickupTime <= now) {
          continue
        }
      }
      occupiedSlots.add(b.slot_number)
    }
  }

  // 2. Find first free slot between 1 and 20
  let allocatedSlot = 0
  for (let i = 1; i <= 20; i++) {
    if (!occupiedSlots.has(i)) {
      allocatedSlot = i
      break
    }
  }

  if (allocatedSlot === 0) {
    throw new Error('All 20 storage slots are currently occupied at this hub.')
  }

  // 3. Save allocated slot
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ slot_number: allocatedSlot })
    .eq('id', bookingId)

  if (updateError) {
    // Unique violation (Postgres code 23505) means another concurrent
    // registration just took this slot — recompute occupancy and retry.
    if (updateError.code === '23505' && attemptsLeft > 0) {
      return allocateSlotForBooking(supabase, hubId, bookingId, attemptsLeft - 1)
    }
    throw new Error(`Failed to save slot allocation: ${updateError.message}`)
  }

  return allocatedSlot
}
