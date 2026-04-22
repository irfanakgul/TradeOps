import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'

type PendingNotification = {
  user_notification_id: number
  title: string
  message: string
}

function playNotificationChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      // @ts-expect-error legacy
      window.webkitAudioContext

    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0.0001, now)
    gain1.gain.exponentialRampToValueAtTime(0.08, now + 0.01)
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.2)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1174, now + 0.16)
    gain2.gain.setValueAtTime(0.0001, now + 0.16)
    gain2.gain.exponentialRampToValueAtTime(0.07, now + 0.18)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.16)
    osc2.stop(now + 0.36)
  } catch {
    //
  }
}

export default function NotificationPopupGate() {
  const { user } = useAuth()
  const { language } = useLanguage()
  const navigate = useNavigate()

  const [pending, setPending] = useState<PendingNotification | null>(null)
  const lastPlayedIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!user?.username) return

    let cancelled = false

    async function checkPending() {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/user/notifications/pending-popup?username=${encodeURIComponent(user.username)}`
        )
        const result = await response.json()

        if (!cancelled && response.ok && result.notification) {
          const incoming = result.notification as PendingNotification
          setPending(incoming)

          if (lastPlayedIdRef.current !== incoming.user_notification_id) {
            lastPlayedIdRef.current = incoming.user_notification_id
            playNotificationChime()
          }
        }
      } catch {
        //
      }
    }

    checkPending()
    const timer = window.setInterval(checkPending, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [user?.username])

  if (!pending) return null

  async function handleDismiss() {
    await fetch('http://127.0.0.1:8000/api/user/notifications/dismiss-popup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_notification_id: pending.user_notification_id }),
    })
    setPending(null)
  }

  async function handleRead() {
    await fetch('http://127.0.0.1:8000/api/user/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_notification_id: pending.user_notification_id }),
    })
    setPending(null)
    navigate('/notifications')
  }

  return (
    <div className="global-lock-overlay">
      <div className="global-lock-card">
        <div className="global-lock-title">
          {language === 'tr' ? 'Yeni Bildirim Var' : 'New Notification'}
        </div>

        <div className="trade-config-section-title" style={{ marginTop: 4 }}>
          {pending.title}
        </div>

        <div className="global-lock-text">
          {language === 'tr'
            ? 'Devam etmeden önce bildirimi okumanız veya kapatmanız gerekiyor.'
            : 'You need to read or dismiss the notification before continuing.'}
        </div>

        <div className="notification-popup-preview">
          {pending.message}
        </div>

        <div className="app-confirm-actions">
          <button type="button" className="secondary-btn" onClick={handleDismiss}>
            {language === 'tr' ? 'Kapat' : 'Dismiss'}
          </button>

          <button type="button" className="primary-btn" onClick={handleRead}>
            {language === 'tr' ? 'Oku' : 'Read'}
          </button>
        </div>
      </div>
    </div>
  )
}