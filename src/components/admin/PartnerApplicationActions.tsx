'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/navigation'
import { approvePartnerApplication, rejectPartnerApplication } from '@/lib/partners/actions'

const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1'

export function PartnerApplicationActions({ id, suggestedCapacity }: { id: string; suggestedCapacity: number | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [alias, setAlias] = useState('')
  const [capacity, setCapacity] = useState(String(suggestedCapacity ?? 20))
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [note, setNote] = useState('')

  function approve(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await approvePartnerApplication(id, {
        alias, capacity: Number(capacity), latitude: Number(latitude), longitude: Number(longitude),
      })
      if (result.error) { setError(result.error); return }
      if (result.warning) setWarning(result.warning)
      setMode('idle')
      router.refresh()
    })
  }

  function reject(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await rejectPartnerApplication(id, note)
      if (result.error) { setError(result.error); return }
      setMode('idle')
      router.refresh()
    })
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      {warning && <p role="alert" className="mb-3 text-sm font-medium text-amber-800">{warning}</p>}
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode('approve')} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">Approve…</button>
          <button type="button" onClick={() => setMode('reject')} className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">Reject…</button>
        </div>
      )}

      {mode === 'approve' && (
        <form onSubmit={approve} className="space-y-3">
          <p className="text-sm text-gray-600">Creates the hub as <b>inactive</b> and a staff account for the applicant. Switch the hub on from Hubs when it is ready.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>Hub alias *</label>
              <input required value={alias} onChange={e => setAlias(e.target.value.toUpperCase())} pattern="[A-Z]{2,6}" maxLength={6} placeholder="KDY" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Capacity (bags) *</label>
              <input required type="number" min={1} max={1000} value={capacity} onChange={e => setCapacity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Latitude *</label>
              <input required type="number" step="any" min={-90} max={90} value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="6.9271" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Longitude *</label>
              <input required type="number" step="any" min={-180} max={180} value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="79.8612" className={inputClass} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{isPending ? 'Approving…' : 'Approve and create hub'}</button>
            <button type="button" onClick={() => { setMode('idle'); setError(null) }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-gray-600">Cancel</button>
          </div>
        </form>
      )}

      {mode === 'reject' && (
        <form onSubmit={reject} className="space-y-3">
          <div>
            <label className={labelClass}>Reason (internal note)</label>
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} className={inputClass} />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{isPending ? 'Rejecting…' : 'Reject application'}</button>
            <button type="button" onClick={() => { setMode('idle'); setError(null) }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-gray-600">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
