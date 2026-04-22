import { useState } from 'react'
import { useLanguage } from './LanguageContext'
import { useAppLock } from './AppLockContext'

export default function AppLockOverlay() {
  const { language } = useLanguage()
  const { isLocked, unlockApp } = useAppLock()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isLocked) return null

  async function handleUnlock() {
    if (busy) return

    try {
      setBusy(true)
      setError('')

      const ok = await unlockApp(password)

      if (!ok) {
        setError(language === 'tr' ? 'Şifre hatalı.' : 'Incorrect password.')
        return
      }

      setPassword('')
      setError('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="global-lock-overlay">
      <div className="global-lock-card">
        <div className="global-lock-title">
          {language === 'tr' ? 'Uygulama Kilitli' : 'Application Locked'}
        </div>

        <div className="global-lock-text">
          {language === 'tr'
            ? 'Sistem arka planda çalışmaya devam ediyor. Uygulama kilitliyken hiçbir sayfaya erişilemez. Açmak için 4 haneli app şifrenizi girin.'
            : 'The system continues to run in the background. No pages can be accessed while the app is locked. Enter your 4-digit app password to unlock.'}
        </div>

        <input
          className="trade-config-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={password}
          onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder={language === 'tr' ? '4 haneli şifre' : '4-digit password'}
        />

        {error && <div className="error-box-global">{error}</div>}

        <div className="app-confirm-actions">
          <button
            type="button"
            className="primary-btn"
            onClick={handleUnlock}
            disabled={busy || password.length !== 4}
          >
            {busy
              ? language === 'tr'
                ? 'Kontrol ediliyor...'
                : 'Checking...'
              : language === 'tr'
                ? 'Kilidi Aç'
                : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  )
}