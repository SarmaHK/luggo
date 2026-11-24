import { Link } from '@/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminPageContext } from '@/lib/admin/pageContext'
import { AdminShell } from '@/components/admin/AdminShell'
import { PartnerApplicationActions } from '@/components/admin/PartnerApplicationActions'
import { PartnerInviteForm } from '@/components/admin/PartnerInviteForm'
import { siteUrl } from '@/lib/site-url'
import { format } from 'date-fns'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Partners — Admin' }

const STATUS_FILTERS = [
  { value: 'new', label: 'New' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-gray-100 text-gray-700 border-gray-200',
}

type Application = {
  id: string
  business_name: string
  contact_name: string
  phone: string
  email: string
  city: string
  address: string
  business_type: string
  storage_capacity: number | null
  open_time: string | null
  close_time: string | null
  notes: string | null
  ref_code: string | null
  invite_id: string | null
  status: string
  admin_note: string | null
  created_at: string
  hubs: { name: string; alias: string; active: boolean } | null
}

type Invite = { id: string; business_name: string | null; note: string | null; expires_at: string; used_at: string | null; created_at: string }

function inviteState(invite: Invite): 'Used' | 'Expired' | 'Open' {
  if (invite.used_at) return 'Used'
  return new Date(invite.expires_at).getTime() < Date.now() ? 'Expired' : 'Open'
}

export default async function AdminPartnersPage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams
  // Role is verified from the database inside the shared context before the service client is used.
  const { profile } = await getAdminPageContext()
  const svc = createServiceClient()

  const status = STATUS_FILTERS.some(f => f.value === searchParams.status) ? searchParams.status! : 'new'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (svc.from('partner_applications') as any)
    .select('id, business_name, contact_name, phone, email, city, address, business_type, storage_capacity, open_time, close_time, notes, ref_code, invite_id, status, admin_note, created_at, hubs ( name, alias, active )')
    .order('created_at', { ascending: false })
    .limit(200)
  if (status !== 'all') query = query.eq('status', status)
  const { data: applications, error: loadError } = await query as { data: Application[] | null; error: { message: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invites } = await (svc.from('partner_invites') as any)
    .select('id, business_name, note, expires_at, used_at, created_at')
    .order('created_at', { ascending: false })
    .limit(10) as { data: Invite[] | null }

  return (
    <AdminShell userName={profile?.name ?? '—'} userRole={profile?.role ?? 'admin'}>
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-extrabold text-ocean-900 mb-1">Partners</h1>
        <p className="text-sm text-gray-500 mb-6">Applications from <span className="font-mono">/partners</span> and the links that bring them in.</p>

        {loadError && (
          <p role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            Could not load applications. If this is a new install, run <span className="font-mono">supabase/partner_portal_migration.sql</span> first.
          </p>
        )}

        <PartnerInviteForm siteUrl={siteUrl} />

        {!!invites?.length && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-bold text-ocean-900 mb-3 text-sm">Recent invite links</h2>
            <ul className="divide-y divide-gray-100 text-sm">
              {invites.map(i => {
                const state = inviteState(i)
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-ocean-900">{i.business_name || 'Unnamed business'}{i.note ? <span className="text-gray-500"> — {i.note}</span> : null}</span>
                    <span className="text-xs text-gray-600">{state} · expires {format(new Date(i.expires_at), 'd MMM yyyy')}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-8 mb-4">
          {STATUS_FILTERS.map(({ value, label }) => (
            <Link
              key={value}
              href={value === 'new' ? '/admin/partners' : `/admin/partners?status=${value}`}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                status === value ? 'bg-ocean-900 text-white border-ocean-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="space-y-3">
          {applications?.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-ocean-900">{a.business_name} <span className="font-normal text-gray-500 text-sm">· {a.business_type}</span></p>
                  <p className="text-sm text-gray-600">{a.city} — {a.address}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLE[a.status] ?? STATUS_STYLE.rejected}`}>{a.status}</span>
                  <p className="text-xs text-gray-500 mt-1">{format(new Date(a.created_at), 'd MMM yyyy, HH:mm')}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div><dt className="inline text-gray-500">Contact: </dt><dd className="inline text-ocean-900">{a.contact_name}</dd></div>
                <div><dt className="inline text-gray-500">Phone: </dt><dd className="inline"><a href={`tel:${a.phone}`} className="text-brand font-medium">{a.phone}</a></dd></div>
                <div><dt className="inline text-gray-500">Email: </dt><dd className="inline"><a href={`mailto:${a.email}`} className="text-brand font-medium break-all">{a.email}</a></dd></div>
                <div><dt className="inline text-gray-500">Space: </dt><dd className="inline text-ocean-900">{a.storage_capacity ? `${a.storage_capacity} bags` : 'not stated'}</dd></div>
                <div><dt className="inline text-gray-500">Hours: </dt><dd className="inline text-ocean-900">{a.open_time && a.close_time ? `${a.open_time.slice(0, 5)}–${a.close_time.slice(0, 5)}` : 'not stated'}</dd></div>
                <div><dt className="inline text-gray-500">Source: </dt><dd className="inline text-ocean-900">{a.invite_id ? 'Invite link' : a.ref_code ? `Referral: ${a.ref_code}` : 'Direct'}</dd></div>
              </dl>
              {a.notes && <p className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{a.notes}</p>}
              {a.admin_note && <p className="mt-2 text-xs text-gray-600">Note: {a.admin_note}</p>}
              {a.hubs && <p className="mt-2 text-xs text-gray-600">Hub: {a.hubs.name} ({a.hubs.alias}) · {a.hubs.active ? 'active' : 'inactive'}</p>}
              {a.status === 'new' && <PartnerApplicationActions id={a.id} suggestedCapacity={a.storage_capacity} />}
            </div>
          ))}
          {!loadError && !applications?.length && (
            <p className="py-12 text-center text-sm text-gray-500">No {status === 'all' ? '' : `${status} `}applications yet. Share a link above to get started.</p>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
