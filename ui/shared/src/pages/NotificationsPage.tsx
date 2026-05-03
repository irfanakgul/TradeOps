import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import { useRuntime } from '../components/RuntimeContext'
import { useUpdate } from '../components/UpdateContext'

type NotificationRow = {
  user_notification_id: number
  notification_id: number
  status: 'UNREAD' | 'READ' | 'DELETED'
  title: string
  message: string
  created_at: string
  created_by: string
  attachment_name?: string | null
}

export default function NotificationsPage() {
  const { language } = useLanguage()
  const { user } = useAuth()
  const { needsUpdate, dismissed, release, undismiss, currentVersion } = useUpdate()
  const navigate = useNavigate()
  const showUpdateEntry = needsUpdate && dismissed && release != null
  const {
    status,
    startTws,
    stopTws,
    restartTws,
    startServer,
    stopServer,
    restartServer,
    runRuntimeTest,
    stopAll,
  } = useRuntime()

  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [controlsBusy, setControlsBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedRow, setSelectedRow] = useState<NotificationRow | null>(null)

  async function runAction(action: () => Promise<any>) {
    if (controlsBusy) return
    try {
      setControlsBusy(true)
      await action()
    } finally {
      window.setTimeout(() => setControlsBusy(false), 2000)
    }
  }

  async function handleExit() {
    try {
      await stopAll()
    } catch {
      //
    }
  }

  async function loadNotifications() {
    if (!user?.username) return

    try {
      setLoading(true)
      setError('')

      const response = await fetch(
        `http://127.0.0.1:8000/api/user/notifications?username=${encodeURIComponent(user.username)}`
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Failed to load notifications.')
      }

      setRows(result.rows || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [user?.username])

  async function markRead(row: NotificationRow) {
    await fetch('http://127.0.0.1:8000/api/user/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_notification_id: row.user_notification_id }),
    })
    await loadNotifications()
  }

  async function markUnread(row: NotificationRow) {
    await fetch('http://127.0.0.1:8000/api/user/notifications/unread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_notification_id: row.user_notification_id }),
    })
    await loadNotifications()
  }

  async function removeRow(row: NotificationRow) {
    await fetch('http://127.0.0.1:8000/api/user/notifications/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_notification_id: row.user_notification_id }),
    })
    if (selectedRow?.user_notification_id === row.user_notification_id) {
      setSelectedRow(null)
    }
    await loadNotifications()
  }

  async function openRow(row: NotificationRow) {
    setSelectedRow(row)
    if (row.status === 'UNREAD') {
      await markRead(row)
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="broker-layout">
        <BrokerSidebar
          activeItem="broker"
          controlsBusy={controlsBusy}
          twsRunning={status.tws_status === 'running'}
          serverRunning={status.server_status === 'running'}
          serverStarting={status.server_status === 'starting'}
          onStartTws={() => runAction(() => startTws())}
          onStopTws={() => runAction(() => stopTws())}
          onRestartTws={() => runAction(() => restartTws())}
          onStartServer={() => runAction(() => startServer())}
          onStopServer={() => runAction(() => stopServer())}
          onRestartServer={() => runAction(() => restartServer())}
          onRuntimeTest={() => runAction(() => runRuntimeTest())}
          onLock={() => {}}
          onExit={handleExit}
        />

        <section className="broker-main wallet-page-main">
          <div className="trade-config-section-card">
            <div className="trade-config-section-title">
              {language === 'tr' ? 'Bildirimler' : 'Notifications'}
            </div>

            {error && <div className="error-box-global">{error}</div>}

            <div className="focus-table-wrap">
              <table className="orders-table focus-table">
                <thead>
                  <tr>
                    <th>{language === 'tr' ? 'Durum' : 'Status'}</th>
                    <th>{language === 'tr' ? 'Başlık' : 'Title'}</th>
                    <th>{language === 'tr' ? 'Gönderen' : 'Created By'}</th>
                    <th>{language === 'tr' ? 'Tarih' : 'Date'}</th>
                    <th>{language === 'tr' ? 'İşlemler' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {showUpdateEntry && release && (
                    <tr
                      className="notification-row-unread clickable-row"
                      onClick={() => {
                        // Bring back the banner so the user can hit Details → modal
                        undismiss()
                        navigate('/')
                      }}
                    >
                      <td>
                        <span
                          className="focus-scope-badge false"
                          style={{
                            background: 'rgba(33,150,243,0.18)',
                            color: '#64b5f6',
                            borderColor: 'rgba(100,181,246,0.32)',
                          }}
                        >
                          ⬆ {language === 'tr' ? 'Güncelleme' : 'Update'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800 }}>
                        {language === 'tr'
                          ? `Yeni sürüm v${release.version} — şu anki: v${currentVersion}`
                          : `New version v${release.version} — current: v${currentVersion}`}
                      </td>
                      <td>System</td>
                      <td>
                        {release.published_at
                          ? new Date(release.published_at).toLocaleString(
                              language === 'tr' ? 'tr-TR' : 'en-US',
                            )
                          : '—'}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="focus-bulk-actions">
                          <button
                            type="button"
                            className="sidebar-secondary-btn"
                            onClick={() => {
                              undismiss()
                              navigate('/')
                            }}
                          >
                            {language === 'tr' ? 'Güncelle' : 'Update'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {rows.length === 0 && !showUpdateEntry ? (
                    <tr>
                      <td colSpan={5} className="orders-empty-cell">
                        {language === 'tr' ? 'Bildirim yok.' : 'No notifications.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.user_notification_id}
                        className={row.status === 'UNREAD' ? 'notification-row-unread clickable-row' : 'clickable-row'}
                        onClick={() => openRow(row)}
                      >
                        <td>
                          <span className={`focus-scope-badge ${row.status === 'UNREAD' ? 'false' : 'true'}`}>
                            {row.status === 'UNREAD'
                              ? language === 'tr' ? 'Okunmadı' : 'Unread'
                              : language === 'tr' ? 'Okundu' : 'Read'}
                          </span>
                        </td>
                        <td style={{ fontWeight: row.status === 'UNREAD' ? 800 : 500 }}>
                          {row.title}
                        </td>
                        <td>{row.created_by}</td>
                        <td>{row.created_at}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="focus-bulk-actions">
                            <button
                              type="button"
                              className="sidebar-secondary-btn"
                              onClick={() => markUnread(row)}
                            >
                              {language === 'tr' ? 'Okunmadı Yap' : 'Mark Unread'}
                            </button>

                            <button
                              type="button"
                              className="sidebar-stop-btn"
                              onClick={() => removeRow(row)}
                            >
                              {language === 'tr' ? 'Sil' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {selectedRow && (
        <div className="app-confirm-overlay">
          <div className="app-confirm-card notification-detail-card">
            <div className="app-confirm-title">{selectedRow.title}</div>
            <div className="app-confirm-text">{selectedRow.message}</div>

            <div className="app-confirm-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => markUnread(selectedRow)}
              >
                {language === 'tr' ? 'Okunmadı Yap' : 'Mark Unread'}
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={() => setSelectedRow(null)}
              >
                {language === 'tr' ? 'Kapat' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}