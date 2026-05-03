import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'
import { useUpdate } from './UpdateContext'

export default function HeaderNotifications() {
  const { user } = useAuth()
  const { language } = useLanguage()
  const { needsUpdate, dismissed, release } = useUpdate()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user?.username) return

    let cancelled = false

    async function loadBadge() {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/user/notifications/badge?username=${encodeURIComponent(user.username)}`
        )
        const result = await response.json()
        if (!cancelled && response.ok) {
          setUnreadCount(result.unread_count || 0)
        }
      } catch {
        //
      }
    }

    loadBadge()
    const timer = window.setInterval(loadBadge, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [user?.username])

  if (!user?.username) return null

  // Update indicator: shown when there's a pending update the user has
  // dismissed (clicked "Later"). Stays visible until they actually update.
  const showUpdateDot = needsUpdate && dismissed && release != null

  return (
    <button
      type="button"
      className="header-notification-btn"
      onClick={() => navigate('/notifications')}
      title={
        showUpdateDot
          ? (language === 'tr'
              ? `Güncelleme bekliyor (v${release?.version})`
              : `Update pending (v${release?.version})`)
          : (language === 'tr' ? 'Bildirimler' : 'Notifications')
      }
    >
      <span className="header-notification-icon">🔔</span>
      {unreadCount > 0 && (
        <span className="header-notification-badge">{unreadCount}</span>
      )}
      {showUpdateDot && (
        <span
          className="header-notification-update-dot"
          aria-label={language === 'tr' ? 'Güncelleme mevcut' : 'Update available'}
        >⬆</span>
      )}
    </button>
  )
}
