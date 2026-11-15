'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/navigation'
import { Copy, Link2 } from 'lucide-react'
import { createPartnerInvite } from '@/lib/partners/actions'

const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1'

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} aria-label="Link" onFocus={e => e.currentTarget.select()} className={`${inputClass} font-mono text-xs bg-gray-50`} />
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch {}
        }}
        className="min-h-11 shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        <Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function PartnerInviteForm({ siteUrl }: { siteUrl: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [businessName, setBusinessName] = useState('')
  const [note, setNote] = useState('')
  const [days, setDays] = useState('14')
  const [refCode, setRefCode] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cleanRef = refCode.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setUrl(null)
    startTransition(async () => {
      const result = await createPartnerInvite({ businessName, note, days: Number(days) })
      if (result.error || !result.url) { setError(result.error ?? 'Failed to create invite link.'); return }
      setUrl(result.url)
      setBusinessName('')
      setNote('')
      router.refresh()
    })
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-ocean-900 flex items-center gap-2"><Link2 size={16} aria-hidden="true" /> One-time invite link</h2>
        <p className="text-sm text-gray-600">For one specific business. It works once and then expires.</p>
        <div>
          <label className={labelClass}>Business name (pre-fills the form)</label>
          <input value={businessName} onChange={e => setBusinessName(e.target.value)} maxLength={120} className={inputClass} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Internal note</label>
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Valid (days)</label>
            <input type="number" min={1} max={90} required value={days} onChange={e => setDays(e.target.value)} className={inputClass} />
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        <button type="submit" disabled={isPending} className="min-h-11 rounded-xl bg-ocean-900 px-4 text-sm font-bold text-white hover:bg-ocean-800 disabled:opacity-60">{isPending ? 'Creating…' : 'Create invite link'}</button>
        {url && <CopyRow value={url} />}
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <h2 className="font-bold text-ocean-900 flex items-center gap-2"><Link2 size={16} aria-hidden="true" /> Shareable referral link</h2>
        <p className="text-sm text-gray-600">Anyone can apply through it, any number of times. The code is saved on each application so you can see who referred it.</p>
        <div>
          <label className={labelClass}>Referral code (letters, numbers, - and _)</label>
          <input value={refCode} onChange={e => setRefCode(e.target.value)} maxLength={40} placeholder="e.g. kamal or expo-2026" className={inputClass} />
        </div>
        <CopyRow value={cleanRef ? `${siteUrl}/partners?ref=${cleanRef}` : `${siteUrl}/partners`} />
      </div>
    </div>
  )
}
