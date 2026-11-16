import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/navigation'
import { Logo } from '@/components/ui/Logo'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { PartnerForm } from '@/components/partners/PartnerForm'
import { localizedAlternates } from '@/lib/i18n/seo'
import { createServiceClient } from '@/lib/supabase/service'
import { cleanInviteToken, cleanRefCode } from '@/lib/validators/partner'
import { ArrowLeft, Banknote, CalendarCheck, ClipboardCheck, QrCode, Send, Store } from 'lucide-react'

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'Meta' })
  return { title: t('partnersTitle'), description: t('partnersDescription'), alternates: localizedAlternates(locale, '/partners') }
}

type InviteState = { token: string; businessName: string | null } | 'invalid' | null

// An invite link is only honoured while it is unused and unexpired.
async function loadInvite(raw: string | undefined): Promise<InviteState> {
  if (!raw) return null
  const token = cleanInviteToken(raw)
  if (!token) return 'invalid'
  const { data } = await createServiceClient()
    .from('partner_invites' as never)
    .select('business_name')
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle() as { data: { business_name: string | null } | null }
  return data ? { token, businessName: data.business_name } : 'invalid'
}

export default async function PartnersPage(props: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ref?: string; invite?: string }>
}) {
  const { locale } = await props.params
  const searchParams = await props.searchParams
  const t = await getTranslations('Partners')
  const invite = await loadInvite(searchParams.invite)
  const ref = cleanRefCode(searchParams.ref)

  const benefits = [
    { icon: Banknote, key: 'earn' },
    { icon: CalendarCheck, key: 'simple' },
    { icon: QrCode, key: 'setup' },
  ] as const
  const steps = [
    { icon: Send, key: 'apply' },
    { icon: ClipboardCheck, key: 'review' },
    { icon: Store, key: 'live' },
  ] as const

  return (
    <main id="main-content" className="min-h-screen bg-white text-ocean-900">
      <nav aria-label={t('navLabel')} className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
          <Link href="/" aria-label={t('homeLabel')} className="shrink-0 inline-flex min-h-11 items-center"><Logo size="sm" /></Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/" aria-label={t('backHome')} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold hover:bg-gray-50 sm:px-3"><ArrowLeft size={18} aria-hidden="true" /><span className="hidden sm:inline">{t('backHome')}</span></Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <p className="text-ocean-600 text-xs sm:text-sm font-bold uppercase tracking-widest mb-3">{t('eyebrow')}</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4 sm:mb-6">{t('title')}</h1>
        <p className="text-gray-600 text-base sm:text-lg leading-relaxed max-w-2xl">{t('intro')}</p>
        <a href="#apply" className="mt-6 sm:mt-8 flex w-full sm:inline-flex sm:w-auto min-h-12 items-center justify-center rounded-2xl bg-brand px-6 font-bold text-white hover:bg-brand/90">{t('applyCta')}</a>

        <section className="mt-10 sm:mt-14" aria-labelledby="partner-benefits">
          <h2 id="partner-benefits" className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{t('benefitsTitle')}</h2>
          <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            {benefits.map(({ icon: Icon, key }) => (
              <div key={key} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 sm:p-6 flex gap-4 sm:block">
                <Icon aria-hidden="true" className="text-ocean-600 shrink-0 sm:mb-4" size={24} />
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2">{t(`benefits.${key}.title`)}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{t(`benefits.${key}.text`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 sm:mt-14" aria-labelledby="partner-steps">
          <h2 id="partner-steps" className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{t('howTitle')}</h2>
          <ol className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            {steps.map(({ icon: Icon, key }, i) => (
              <li key={key} className="border border-gray-100 rounded-2xl p-4 sm:p-6 flex gap-4 sm:block">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 sm:mb-3 shrink-0">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean-900 text-sm font-bold text-white">{i + 1}</span>
                  <Icon aria-hidden="true" className="text-ocean-600" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2">{t(`how.${key}.title`)}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{t(`how.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="apply" className="mt-10 sm:mt-14 scroll-mt-4" aria-labelledby="partner-apply">
          <h2 id="partner-apply" className="text-xl sm:text-2xl font-bold mb-2">{t('formTitle')}</h2>
          <p className="text-gray-600 text-sm sm:text-base mb-5 sm:mb-6">{t('formIntro')}</p>
          {invite === 'invalid' && (
            <p role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{t('inviteInvalid')}</p>
          )}
          {invite && invite !== 'invalid' && invite.businessName && (
            <p className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{t('invitedFor', { name: invite.businessName })}</p>
          )}
          <PartnerForm
            locale={locale}
            refCode={ref}
            inviteToken={invite && invite !== 'invalid' ? invite.token : null}
            initialBusinessName={invite && invite !== 'invalid' ? invite.businessName ?? '' : ''}
          />
        </section>
      </div>
    </main>
  )
}
