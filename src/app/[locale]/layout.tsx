import LocalizedRootLayout from '@/components/shared/LocalizedRootLayout'

export { generateMetadata, generateStaticParams, viewport } from '@/components/shared/LocalizedRootLayout'

export default function ApplicationLayout(props: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  return <LocalizedRootLayout {...props} />
}
