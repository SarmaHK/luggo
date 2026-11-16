import type { Metadata } from 'next'

/**
 * Canonical URL + hreflang alternates (including x-default) for a public page.
 * `path` is the English path without locale prefix, e.g. '/about' or '/' for home.
 * English is served without a prefix (localePrefix: 'as-needed').
 */
export function localizedAlternates(locale: string, path: string): NonNullable<Metadata['alternates']> {
  const clean = path === '/' ? '' : path
  const en = clean || '/'
  return {
    canonical: locale === 'en' ? en : `/${locale}${clean}`,
    languages: {
      en,
      si: `/si${clean}`,
      ta: `/ta${clean}`,
      'x-default': en,
    },
  }
}
