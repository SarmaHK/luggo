/**
 * Timezone-safe date formatting helper for Sri Lanka Standard Time (Asia/Colombo)
 */
// App locale → Intl locale. English keeps en-GB's day-month order.
const INTL_LOCALES: Record<string, string> = { en: 'en-GB', si: 'si-LK', ta: 'ta-LK' }

export function formatInSLT(dateStr: string | Date, options: Intl.DateTimeFormatOptions = {}, locale = 'en'): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return new Intl.DateTimeFormat(INTL_LOCALES[locale] ?? locale, {
    timeZone: 'Asia/Colombo',
    ...options
  }).format(date)
}

export function formatDateTimeSLT(dateStr: string | Date, locale = 'en'): string {
  return formatInSLT(dateStr, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }, locale)
}

export function formatDateSLT(dateStr: string | Date, locale = 'en'): string {
  return formatInSLT(dateStr, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }, locale)
}

/**
 * Start and end of the current Sri Lanka calendar day. Sri Lanka has no daylight saving
 * (always UTC+05:30), and the server runs in UTC, so "today" must not be taken from the
 * server's own clock.
 */
export function colomboDayRange(now: Date = new Date()): { start: Date; end: Date } {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const start = new Date(`${ymd}T00:00:00+05:30`)
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) }
}
