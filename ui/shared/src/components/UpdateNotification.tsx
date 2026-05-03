import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useLanguage } from './LanguageContext'
import { useUpdate } from './UpdateContext'
import { useAuth } from './AuthContext'

export default function UpdateNotification() {
  const { language } = useLanguage()
  const {
    needsUpdate, release, currentVersion, dismissed, dismiss,
    postUpdateNotice, dismissPostUpdate,
  } = useUpdate()
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  // Post-update success toast: auto-dismiss after 4.5s
  useEffect(() => {
    if (!postUpdateNotice) return
    const id = window.setTimeout(() => dismissPostUpdate(), 4500)
    return () => window.clearTimeout(id)
  }, [postUpdateNotice, dismissPostUpdate])

  async function handleUpdateNow() {
    if (!release || installing) return
    setInstallError(null)
    setInstalling(true)
    try {
      if (user) {
        try {
          await fetch('http://127.0.0.1:8000/api/session/save-pending-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user }),
          })
        } catch {
          // not fatal
        }
      }

      try {
        await invoke('mark_update_in_progress')
      } catch {
        // not fatal
      }

      await invoke('install_update', { url: release.download_url })
    } catch (err) {
      setInstalling(false)
      setInstallError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleLater() {
    if (installing) return
    setModalOpen(false)
    if (!release?.is_mandatory) dismiss()
  }

  async function handleQuitApp() {
    if (installing) return
    try {
      await invoke('quit_app')
    } catch {
      // fallback
    }
  }

  // ── Post-update success toast (top-right, auto-dismiss) ──
  const successToast = postUpdateNotice ? (
    <div className="update-success-toast" key="post-update">
      <span className="update-success-icon">✓</span>
      <div className="update-success-body">
        <div className="update-success-title">
          {language === 'tr' ? 'Güncelleme Tamamlandı' : 'Update Complete'}
        </div>
        <div className="update-success-sub">
          {language === 'tr'
            ? `Şu anki sürüm: v${currentVersion}`
            : `Now running: v${currentVersion}`}
        </div>
      </div>
      <button
        type="button"
        className="update-success-close"
        onClick={dismissPostUpdate}
        aria-label="dismiss"
      >×</button>
    </div>
  ) : null

  // If there's no pending update info, only the toast may render
  if (!needsUpdate || !release) {
    return successToast
  }

  const notes =
    (language === 'tr' ? release.release_notes_tr : release.release_notes_en) ||
    release.release_notes_en ||
    release.release_notes_tr ||
    ''

  // Pop-up modal (mandatory or first opportunity)
  if (modalOpen || (release.is_mandatory && !dismissed)) {
    return (
      <>
        {successToast}
        <div className="app-confirm-overlay">
          <div className="app-confirm-card update-modal-card">
            <div className="update-modal-icon">⬆</div>
            <div className="app-confirm-title">
              {language === 'tr' ? 'Yeni Güncelleme Mevcut' : 'New Update Available'}
            </div>
            <div className="update-modal-version">
              <span className="update-modal-version-pill">v{currentVersion}</span>
              <span className="update-modal-arrow">→</span>
              <span className="update-modal-version-pill new">v{release.version}</span>
              {release.is_mandatory && (
                <span className="update-modal-mandatory">
                  {language === 'tr' ? 'Zorunlu' : 'Mandatory'}
                </span>
              )}
            </div>
            {notes && (
              <div className="update-modal-notes">
                <div className="update-modal-notes-label">
                  {language === 'tr' ? 'Sürüm notları' : 'Release notes'}
                </div>
                <div className="update-modal-notes-body">{notes}</div>
              </div>
            )}
            {installing && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(33, 150, 243, 0.12)',
                border: '1px solid rgba(100, 181, 246, 0.32)',
                fontSize: '0.85rem', color: '#cfdaeb',
              }}>
                {language === 'tr'
                  ? 'Yeni sürüm indiriliyor… Uygulama birazdan kapanıp tekrar açılacak. Lütfen bekleyin.'
                  : 'Downloading new version… The app will quit and re-launch shortly. Please wait.'}
              </div>
            )}
            {installError && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(229, 57, 53, 0.12)',
                border: '1px solid rgba(229, 57, 53, 0.32)',
                fontSize: '0.85rem', color: '#ff8a80',
              }}>
                {language === 'tr' ? 'Güncelleme başarısız: ' : 'Update failed: '}{installError}
              </div>
            )}
            <div className="app-confirm-actions">
              {release.is_mandatory ? (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleQuitApp}
                  disabled={installing}
                  title={language === 'tr'
                    ? 'Güncellemeden çıkış. Tekrar açtığınızda yine sorulacak.'
                    : 'Quit without updating. You will be asked again next time.'}
                >
                  {language === 'tr' ? 'Çıkış Yap' : 'Quit App'}
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleLater}
                  disabled={installing}
                >
                  {language === 'tr' ? 'Sonra' : 'Later'}
                </button>
              )}
              <button
                type="button"
                className="primary-btn"
                onClick={handleUpdateNow}
                disabled={installing}
              >
                {installing
                  ? (language === 'tr' ? 'İndiriliyor…' : 'Downloading…')
                  : (language === 'tr' ? 'Şimdi Güncelle' : 'Update Now')}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Compact banner (dismissable, persistent until dismissed or new version arrives)
  if (dismissed) {
    return successToast
  }

  return (
    <>
      {successToast}
      <div className="update-banner">
        <span className="update-banner-icon">⬆</span>
        <span className="update-banner-text">
          {language === 'tr'
            ? `Yeni sürüm yayınlandı: v${release.version}`
            : `New version available: v${release.version}`}
        </span>
        <button
          type="button"
          className="update-banner-btn primary"
          onClick={() => setModalOpen(true)}
        >
          {language === 'tr' ? 'Detaylar' : 'Details'}
        </button>
        <button
          type="button"
          className="update-banner-btn dismiss"
          onClick={dismiss}
          title={language === 'tr' ? 'Kapat' : 'Dismiss'}
        >
          ×
        </button>
      </div>
    </>
  )
}
