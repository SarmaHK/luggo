import type { Metadata, Viewport } from 'next'
import '@/app/globals.css'
import { MotionConfig } from '@/components/shared/MotionProvider'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { locales } from '@/i18n-config'
import { siteUrl } from '@/lib/site-url'

// Lets pages that do not read cookies or the request be built once per language and served from the cache.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params
  const t = await getTranslations({ locale, namespace: 'Meta' })
  return {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | Luggo',
    default: t('siteTitle'),
  },
  description: t('siteDescription'),
  keywords: [
    'luggage storage Sri Lanka',
    'left luggage Sri Lanka',
    'short term luggage storage',
    'luggage storage network',
    'store bags safely',
    'travel hands-free',
  ],
  authors: [{ name: 'Luggo' }],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Luggo',
  },

  openGraph: {
    type: 'website',
    siteName: 'Luggo',
    title: t('ogTitle'),
    description: t('ogDescription'),
    images: [{ url: '/images/hubs/bia.png', width: 1200, height: 630, alt: 'Luggo luggage storage' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: t('ogTitle'),
    description: t('ogDescription'),
    images: ['/images/hubs/bia.png'],
  },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#038cc9' },
    { media: '(prefers-color-scheme: dark)',  color: '#011a2e' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout(
  props: {
    children: React.ReactNode
    params: Promise<{ locale: string }>
    analytics?: React.ReactNode
  }
) {
  const params = await props.params;

  const {
    locale
  } = params;

  const {
    children
  } = props;

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <head>
        {/* Returning visitors and reduced-motion users never get the splash. Decided before first paint
            (the splash is in the server HTML), so it cannot flash white and fade out. Key matches SplashScreen. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('luggo_splash_seen')==='1'||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.setAttribute('data-splash-skip','')}catch(e){}" }} />
        <style dangerouslySetInnerHTML={{ __html: '[data-splash-skip] .luggo-splash{display:none!important}' }} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#011a2e" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>

      <body suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Colombo">
          <MotionConfig>{children}</MotionConfig>
          {props.analytics}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
