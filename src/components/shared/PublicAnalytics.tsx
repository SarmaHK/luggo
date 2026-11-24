'use client'

import Script from 'next/script'
import { useState, useSyncExternalStore } from 'react'

const preferenceKey = 'luggo-analytics-consent'
const preferenceEvent = 'luggo-analytics-consent-change'

const labels = {
  en: ['Analytics settings', 'Allow optional analytics to help improve Luggo?', 'Allow analytics', 'Decline analytics'],
  si: ['විශ්ලේෂණ සැකසුම්', 'Luggo වැඩිදියුණු කිරීමට විකල්ප විශ්ලේෂණයට ඉඩ දෙන්නද?', 'විශ්ලේෂණයට ඉඩ දෙන්න', 'විශ්ලේෂණය ප්‍රතික්ෂේප කරන්න'],
  ta: ['பகுப்பாய்வு அமைப்புகள்', 'Luggo-ஐ மேம்படுத்த விருப்பப் பகுப்பாய்வை அனுமதிக்கவா?', 'பகுப்பாய்வை அனுமதி', 'பகுப்பாய்வை நிராகரி'],
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === preferenceKey && event.oldValue === 'granted' && event.newValue !== 'granted') {
      stopAnalytics()
      return
    }
    onChange()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(preferenceEvent, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(preferenceEvent, onChange)
  }
}

function stopAnalytics() {
  const analyticsWindow = window as Window & {
    clarity?: (command: 'consentv2', state: { ad_Storage: 'denied'; analytics_Storage: 'denied' }) => void
    gtag?: (command: 'consent', action: 'update', state: { analytics_storage: 'denied' }) => void
  }
  analyticsWindow.clarity?.('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' })
  analyticsWindow.gtag?.('consent', 'update', { analytics_storage: 'denied' })
  // Removing Script elements does not unload analytics that already started.
  window.location.reload()
}

function getPreference() {
  try {
    return localStorage.getItem(preferenceKey)
  } catch {
    return null
  }
}

export default function PublicAnalytics({ locale, clarityId, gaId }: {
  locale: string
  clarityId: string
  gaId: string
}) {
  const savedPreference = useSyncExternalStore(subscribe, getPreference, () => null)
  const [sessionPreference, setSessionPreference] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const preference = sessionPreference ?? savedPreference
  const [settings, prompt, allow, decline] = labels[locale as keyof typeof labels] ?? labels.en

  function savePreference(value: 'granted' | 'denied') {
    try {
      localStorage.setItem(preferenceKey, value)
      window.dispatchEvent(new Event(preferenceEvent))
    } catch {
      setSessionPreference(value)
    }
    setSettingsOpen(false)
    if (preference === 'granted' && value === 'denied') stopAnalytics()
  }

  return (
    <aside aria-label={settings} className="mx-auto max-w-7xl px-4 py-3 text-sm">
      <button type="button" onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen} className="underline">
        {settings}
      </button>
      {settingsOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p>{prompt}</p>
          <button type="button" className="underline" onClick={() => savePreference('granted')}>{allow}</button>
          <button type="button" className="underline" onClick={() => savePreference('denied')}>{decline}</button>
        </div>
      )}
      {preference === 'granted' && clarityId && (
        <Script id="luggo-clarity" strategy="afterInteractive">{`
          window.clarity = window.clarity || function () {
            (window.clarity.q = window.clarity.q || []).push(arguments);
          };
          window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
          var clarityTag = document.createElement('script');
          clarityTag.async = true;
          clarityTag.src = ${JSON.stringify(`https://www.clarity.ms/tag/${clarityId}`)};
          document.head.appendChild(clarityTag);
        `}</Script>
      )}
      {preference === 'granted' && gaId && (
        <>
          <Script id="luggo-google-analytics" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag() { window.dataLayer.push(arguments); }
            gtag('consent', 'default', {
              analytics_storage: 'granted', ad_storage: 'denied',
              ad_user_data: 'denied', ad_personalization: 'denied'
            });
            gtag('js', new Date());
            gtag('config', ${JSON.stringify(gaId)}, { allow_google_signals: false });
          `}</Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
        </>
      )}
    </aside>
  )
}
