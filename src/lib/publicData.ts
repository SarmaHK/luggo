import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { LISTINGS_HIDDEN } from '@/lib/booking-pause'
import { type BagType } from '@/types/database'

export type PublicRateRow = { bag_type: BagType; hourly_rate: number; daily_cap: number }
export type PublicHub = { name: string; alias: string | null; location: string | null; address: string | null }

/**
 * Data every visitor sees on the home page (cheapest rates across active hubs, and which
 * cities have a live hub). It is the same for everyone, so it is cached for five minutes
 * instead of being fetched from Supabase on every page view. Hub or price changes in the
 * admin therefore show on the home page within five minutes.
 */
export const getPublicHomeData = unstable_cache(
  async (): Promise<{ rateRows: PublicRateRow[]; liveHubs: PublicHub[] }> => {
    const svc = createServiceClient()
    const [rates, hubs] = await Promise.all([
      svc
        .from('hub_bag_rates' as never)
        .select('bag_type, hourly_rate, daily_cap, hubs!inner(active)')
        .eq('hubs.active', true) as unknown as Promise<{ data: PublicRateRow[] | null }>,
      LISTINGS_HIDDEN
        ? Promise.resolve({ data: [] as PublicHub[] })
        : (svc.from('hubs').select('name, alias, location, address').eq('active', true) as unknown as Promise<{ data: PublicHub[] | null }>),
    ])
    return { rateRows: rates.data ?? [], liveHubs: hubs.data ?? [] }
  },
  ['public-home-data'],
  { revalidate: 300 },
)
