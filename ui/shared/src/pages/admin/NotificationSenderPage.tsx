import { useEffect, useState } from 'react'
import AdminPanelLayout from '../../components/AdminPanelLayout'
import { useLanguage } from '../../components/LanguageContext'
import { useAuth } from '../../components/AuthContext'

type AdminNotificationRow = {
    id: number
    title: string
    message: string
    attachment_name?: string | null
    created_by: string
    created_at: string
    recipient_count: number
    unread_count: number
    target_summary?: string | null
  }

type TargetRow = {
  target_type: string
  target_value: string
}

type NotificationDetailResponse = {
  detail: {
    id: number
    title: string
    message: string
    attachment_name?: string | null
    created_by: string
    created_at: string
  }
  targets: Array<{
    target_type: string
    target_value?: string | null
  }>
  recipients: Array<{
    username: string
    email?: string | null
    status: string
    delivered_at: string
    read_at?: string | null
  }>
}

export default function NotificationSenderPage() {
  const { language } = useLanguage()
  const { user } = useAuth()

  const [rows, setRows] = useState<AdminNotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [banner, setBanner] = useState('')
  const [error, setError] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<NotificationDetailResponse | null>(null)
  const [showRecipients, setShowRecipients] = useState(false)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targets, setTargets] = useState<TargetRow[]>([
    { target_type: 'ALL_CLIENTS', target_value: '' },
  ])

  async function loadRows() {
    try {
      setLoading(true)
      const response = await fetch('http://127.0.0.1:8000/api/admin/notifications')
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
    loadRows()
  }, [])

  function updateTarget(index: number, key: keyof TargetRow, value: string) {
    setTargets((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    )
  }

  function addTarget() {
    setTargets((prev) => [...prev, { target_type: 'USERNAME', target_value: '' }])
  }

  async function handleSend() {
    try {
      setLoading(true)
      setError('')
      setBanner('')

      const response = await fetch('http://127.0.0.1:8000/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          created_by: user?.username || 'ADMIN',
          targets: targets.map((t) => ({
            target_type: t.target_type,
            target_value: t.target_value || null,
          })),
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Send failed.')
      }

      setBanner(
        language === 'tr'
          ? `Bildirim gönderildi. Alıcı sayısı: ${result.recipient_count}`
          : `Notification sent. Recipient count: ${result.recipient_count}`,
      )

      setTitle('')
      setMessage('')
      setTargets([{ target_type: 'ALL_CLIENTS', target_value: '' }])
      setShowComposer(false)
      await loadRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed.')
    } finally {
      setLoading(false)
    }
  }

  async function openDetail(notificationId: number) {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/admin/notifications/detail?notification_id=${notificationId}`
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Failed to load notification detail.')
      }
      setSelectedDetail(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notification detail.')
    }
  }

  function renderTargetLabel(target: { target_type: string; target_value?: string | null }) {
    if (target.target_type === 'EMAIL') return 'Specific Email'
    if (target.target_type === 'USERNAME') return 'Specific Username'
    if (target.target_type === 'COUNTRY') return `Country: ${target.target_value || '-'}`
    if (target.target_type === 'USER_TYPE') return `User Type: ${target.target_value || '-'}`
    if (target.target_type === 'ALL_CLIENTS') return 'All Clients'
    if (target.target_type === 'ALL_USERS') return 'All Users'
    return target.target_type
  }

  return (
    <AdminPanelLayout>
      <div className="admin-page-card">
        <div className="focus-topbar">
          <div>
            <div className="admin-page-title">
              {language === 'tr' ? 'Notification Sender' : 'Notification Sender'}
            </div>
            <div className="admin-page-note">
              {language === 'tr'
                ? 'Buradan kullanıcılara sistem içi bildirim gönderebilirsiniz.'
                : 'Send in-app notifications to users from here.'}
            </div>
          </div>

          <button
            type="button"
            className="focus-companies-btn"
            onClick={() => setShowComposer((prev) => !prev)}
          >
            {language === 'tr' ? 'Yeni Bildirim Gönder' : 'New Notification'}
          </button>
        </div>

        {banner && <div className="success-box">{banner}</div>}
        {error && <div className="error-box-global">{error}</div>}

        {showComposer && (
          <div className="trade-config-section-card" style={{ marginBottom: 16 }}>
            <div className="focus-filters-grid" style={{ gridTemplateColumns: '1fr' }}>
              <input
                className="trade-config-input"
                placeholder={language === 'tr' ? 'Bildirim Başlığı' : 'Notification Title'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <textarea
                className="contact-form-textarea"
                rows={7}
                placeholder={language === 'tr' ? 'Bildirim İçeriği' : 'Notification Message'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="trade-config-section-title" style={{ marginTop: 10, marginBottom: 10 }}>
              {language === 'tr' ? 'Hedefler' : 'Targets'}
            </div>

            {targets.map((target, index) => (
              <div key={index} className="focus-filters-grid" style={{ marginBottom: 10 }}>
                <select
                  className="trade-config-input"
                  value={target.target_type}
                  onChange={(e) => updateTarget(index, 'target_type', e.target.value)}
                >
                  <option value="ALL_CLIENTS">ALL_CLIENTS</option>
                  <option value="ALL_USERS">ALL_USERS</option>
                  <option value="EMAIL">EMAIL</option>
                  <option value="USERNAME">USERNAME</option>
                  <option value="COUNTRY">COUNTRY</option>
                  <option value="USER_TYPE">USER_TYPE</option>
                </select>

                <input
                  className="trade-config-input"
                  placeholder={language === 'tr' ? 'Hedef değeri (gerekirse)' : 'Target value (if needed)'}
                  value={target.target_value}
                  onChange={(e) => updateTarget(index, 'target_value', e.target.value)}
                />
              </div>
            ))}

            <div className="focus-bulk-actions">
              <button type="button" className="sidebar-secondary-btn" onClick={addTarget}>
                {language === 'tr' ? 'Hedef Ekle' : 'Add Target'}
              </button>

              <button type="button" className="sidebar-primary-btn" onClick={handleSend}>
                {language === 'tr' ? 'Gönder' : 'Send'}
              </button>
            </div>
          </div>
        )}

<div className="focus-table-wrap">
  <table className="orders-table focus-table">
    <thead>
      <tr>
        <th>{language === 'tr' ? 'Başlık' : 'Title'}</th>
        <th>{language === 'tr' ? 'Gönderen' : 'Created By'}</th>
        <th>{language === 'tr' ? 'Tarih' : 'Date'}</th>
        <th>{language === 'tr' ? 'Hedef' : 'Target'}</th>
        <th>{language === 'tr' ? 'Alıcı' : 'Recipients'}</th>
        <th>{language === 'tr' ? 'Okunmayan' : 'Unread'}</th>
        <th>{language === 'tr' ? 'İşlem' : 'Action'}</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 ? (
        <tr>
          <td colSpan={7} className="orders-empty-cell">
            {language === 'tr' ? 'Henüz bildirim yok.' : 'No notifications yet.'}
          </td>
        </tr>
      ) : (
        rows.map((row) => (
          <tr
            key={row.id}
            className="clickable-row"
            onClick={() => openDetail(row.id)}
          >
            <td>{row.title}</td>
            <td>{row.created_by}</td>
            <td>{row.created_at}</td>
            <td>{row.target_summary || '-'}</td>
            <td>{row.recipient_count}</td>
            <td>{row.unread_count}</td>
            <td onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="sidebar-stop-btn"
                onClick={async () => {
                  await fetch('http://127.0.0.1:8000/api/admin/notifications/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_notification_id: row.id }),
                  })
                  loadRows()
                }}
              >
                {language === 'tr' ? 'Sil' : 'Delete'}
              </button>
            </td>
          </tr>
        ))
      )}
    </tbody>
  </table>
</div>
      </div>

      {selectedDetail && (
        <div className="app-confirm-overlay">
          <div className="app-confirm-card notification-detail-card">
            <div className="app-confirm-title">{selectedDetail.detail.title}</div>

            <div className="notification-tag-row">
              {selectedDetail.targets.map((target, index) => (
                <span key={index} className="notification-target-tag">
                  {renderTargetLabel(target)}
                </span>
              ))}
            </div>

            <div className="app-confirm-text">{selectedDetail.detail.message}</div>

            <div className="app-confirm-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowRecipients(true)}
              >
                {language === 'tr' ? 'Alıcıları Gör' : 'View Recipients'}
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={() => setSelectedDetail(null)}
              >
                {language === 'tr' ? 'Kapat' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecipients && selectedDetail && (
        <div className="app-confirm-overlay">
          <div className="app-confirm-card notification-detail-card">
            <div className="app-confirm-title">
              {language === 'tr' ? 'Alıcı E-postaları' : 'Recipient Emails'}
            </div>

            <div className="recipient-list-wrap">
              {selectedDetail.recipients.map((recipient, index) => (
                <div key={`${recipient.username}-${index}`} className="recipient-row">
                  <span>{recipient.username}</span>
                  <strong>{recipient.email || '-'}</strong>
                </div>
              ))}
            </div>

            <div className="app-confirm-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => setShowRecipients(false)}
              >
                {language === 'tr' ? 'Kapat' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPanelLayout>
  )
}