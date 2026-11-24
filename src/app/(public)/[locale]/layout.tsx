import LocalizedRootLayout from '@/components/shared/LocalizedRootLayout'
import PublicAnalytics from '@/components/shared/PublicAnalytics'

export { generateMetadata, generateStaticParams, viewport } from '@/components/shared/LocalizedRootLayout'

const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() ?? ''
const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? ''

export default async function PublicLayout(props: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  const clarity = /^[a-z0-9]+$/i.test(clarityId) ? clarityId : ''
  const ga = /^G-[A-Z0-9]+$/.test(gaId) ? gaId : ''

  return (
    <LocalizedRootLayout
      {...props}
      analytics={(clarity || ga) && <PublicAnalytics locale={locale} clarityId={clarity} gaId={ga} />}
    />
  )
}
