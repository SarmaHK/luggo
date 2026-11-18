import { getAdminPageContext } from '@/lib/admin/pageContext'
import { AdminShell } from '@/components/admin/AdminShell'
import { HubCard } from '@/components/admin/HubCard'
import { HubForm } from '@/components/admin/HubForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Hubs — Admin' }

export default async function AdminHubsPage() {
  const { supabase, profile } = await getAdminPageContext()

  // Bag counts come from a database function (see supabase/performance_migration.sql). Fetched
  // together with the hubs; the old per-booking query below is only a fallback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bagCountsPromise = (supabase.rpc as any)('admin_hub_bag_counts') as Promise<{ data: { hub_id: string; bags: number }[] | null; error: unknown }>

  // Hubs with current booking counts
  const hubsPromise = supabase
    .from('hubs')
    .select('id, name, alias, location, address, capacity, open_time, close_time, active, image_url, latitude, longitude')
    .order('name') as unknown as Promise<{
      data: {
        id: string
        name: string
        alias: string
        location: string
        address: string
        capacity: number
        open_time: string
        close_time: string
        active: boolean
        image_url: string | null
        latitude: number | null
        longitude: number | null
      }[] | null
      error: unknown
    }>

  const [{ data: hubs }, bagCounts] = await Promise.all([hubsPromise, bagCountsPromise])

  const bagsByHub: Record<string, number> = {}
  if (!bagCounts.error && bagCounts.data) {
    bagCounts.data.forEach((r) => { bagsByHub[r.hub_id] = Number(r.bags) })
  } else {
    // Function not installed yet: count in code (slower, and grows with bookings).
    const { data: activeBags } = await supabase
      .from('bookings')
      .select('hub_id, booking_bags(id)')
      .in('status', ['active_storage', 'pickup_requested', 'overstayed']) as {
        data: { hub_id: string; booking_bags: { id: string }[] }[] | null
        error: unknown
      }
    activeBags?.forEach((b) => {
      bagsByHub[b.hub_id] = (bagsByHub[b.hub_id] ?? 0) + (b.booking_bags?.length ?? 0)
    })
  }

  return (
    <AdminShell userName={profile?.name ?? '—'} userRole={profile?.role ?? 'admin'}>
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-extrabold text-ocean-900 mb-1">Hubs</h1>
        <p className="text-sm text-gray-500 mb-8">{hubs?.length ?? 0} hubs registered</p>

        {/* Add new hub */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8 shadow-sm">
          <h2 className="font-bold text-ocean-900 mb-1 text-base">Add New Hub</h2>
          <p className="text-xs text-gray-500 mb-5">
            Configure the name, alias prefix, location coordinates, capacity, and business hours for a new luggage hub.
          </p>
          <HubForm />
        </div>

        <div className="space-y-4">
          {hubs?.map((hub) => {
            const bags = bagsByHub[hub.id] ?? 0
            return (
              <HubCard
                key={hub.id}
                hub={hub}
                bags={bags}
              />
            )
          })}
        </div>
      </div>
    </AdminShell>
  )
}
