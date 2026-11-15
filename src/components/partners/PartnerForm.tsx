'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { submitPartnerApplication } from '@/lib/partners/actions'
import { PARTNER_BUSINESS_TYPES, type PartnerBusinessType } from '@/lib/validators/partner'

interface Props {
  locale: string
  refCode: string | null
  inviteToken: string | null
  initialBusinessName: string
}

const fieldClass =
  'w-full min-h-12 px-4 py-3 rounded-2xl border border-gray-300 hover:border-gray-400 bg-white text-ocean-900 text-base md:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand'

export function PartnerForm({ locale, refCode, inviteToken, initialBusinessName }: Props) {
  const t = useTranslations('Partners')
  const typeId = useId()
  const notesId = useId()
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState(initialBusinessName)
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [businessType, setBusinessType] = useState<PartnerBusinessType>('hotel')
  const [capacity, setCapacity] = useState('')
  const [openTime, setOpenTime] = useState('')
  const [closeTime, setCloseTime] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await submitPartnerApplication({
        businessName, contactName, phone, email, city, address, businessType,
        storageCapacity: capacity ? Number(capacity) : undefined,
        openTime, closeTime, notes,
        locale: locale === 'si' || locale === 'ta' ? locale : 'en',
        ref: refCode ?? undefined,
        invite: inviteToken ?? undefined,
        website,
      })
      if (result.ok) setDone(true)
      else setError(t(`errors.${result.error}`))
    })
  }

  if (done) {
    return (
      <div role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle aria-hidden="true" className="mx-auto mb-4 text-emerald-600" size={40} />
        <h3 className="text-xl font-bold text-ocean-900 mb-2">{t('successTitle')}</h3>
        <p className="text-gray-700">{t('successText')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-gray-200 bg-gray-50 p-5 sm:p-8 space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <Input label={t('fields.businessName')} required maxLength={120} autoComplete="organization" value={businessName} onChange={e => setBusinessName(e.target.value)} />
        <Input label={t('fields.contactName')} required maxLength={100} autoComplete="name" value={contactName} onChange={e => setContactName(e.target.value)} />
        <Input label={t('fields.phone')} hint={t('fields.phoneHint')} required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        <Input label={t('fields.email')} required type="email" maxLength={200} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        <Input label={t('fields.city')} required maxLength={80} autoComplete="address-level2" value={city} onChange={e => setCity(e.target.value)} />
        <Input label={t('fields.address')} required minLength={5} maxLength={250} autoComplete="street-address" value={address} onChange={e => setAddress(e.target.value)} />
        <div>
          <label htmlFor={typeId} className="block text-sm font-medium text-ocean-800 mb-1.5">{t('fields.businessType')}</label>
          <select id={typeId} required value={businessType} onChange={e => setBusinessType(e.target.value as PartnerBusinessType)} className={fieldClass}>
            {PARTNER_BUSINESS_TYPES.map(type => <option key={type} value={type}>{t(`types.${type}`)}</option>)}
          </select>
        </div>
        <Input label={t('fields.capacity')} hint={t('fields.capacityHint')} type="number" inputMode="numeric" min={1} max={1000} value={capacity} onChange={e => setCapacity(e.target.value)} />
        <Input label={t('fields.openTime')} type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} />
        <Input label={t('fields.closeTime')} type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
      </div>

      <div>
        <label htmlFor={notesId} className="block text-sm font-medium text-ocean-800 mb-1.5">{t('fields.notes')}</label>
        <textarea id={notesId} rows={3} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('fields.notesHint')} className={fieldClass} />
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <div aria-hidden="true" className="hidden">
        <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
      </div>

      {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

      <Button type="submit" size="lg" fullWidth loading={isPending}>{isPending ? t('submitting') : t('submit')}</Button>
      <p className="text-xs text-gray-600 text-center">{t('consent')}</p>
    </form>
  )
}
