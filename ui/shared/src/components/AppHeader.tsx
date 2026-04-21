import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import logo from '../../../assets/logo/tradeops-logo.png'
import { useLanguage } from './LanguageContext'
import { useAuth } from './AuthContext'
import { useRuntime } from './RuntimeContext'

function formatHeaderTime(language: 'tr' | 'en') {
  const now = new Date()
  return now.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusLabel(
  language: 'tr' | 'en',
  status: 'running' | 'starting' | 'stopped',
) {
  if (language === 'tr') {
    if (status === 'running') return 'AKTİF'
    if (status === 'starting') return 'BAŞLIYOR'
    return 'KAPALI'
  }

  if (status === 'running') return 'RUNNING'
  if (status === 'starting') return 'STARTING'
  return 'STOPPED'
}

export default function AppHeader() {
  const { language, setLanguage, t } = useLanguage()
  const { user, setUser } = useAuth()
  const { status, stopAll } = useRuntime()
  const navigate = useNavigate()

  const [headerTime, setHeaderTime] = useState(() =>
    formatHeaderTime(language as 'tr' | 'en'),
  )
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)

  useEffect(() => {
    setHeaderTime(formatHeaderTime(language as 'tr' | 'en'))

    const interval = window.setInterval(() => {
      setHeaderTime(formatHeaderTime(language as 'tr' | 'en'))
    }, 30000)

    return () => window.clearInterval(interval)
  }, [language])

  async function handleConfirmedLogout() {
    if (logoutBusy) return

    try {
      setLogoutBusy(true)

      try {
        await stopAll()
      } catch {
        // stop all hata verse bile logout devam etsin
      }

      setUser(null)
      setShowLogoutConfirm(false)
      navigate('/login', { replace: true })
    } finally {
      setLogoutBusy(false)
    }
  }

  return (
    <>
      <header className="topbar app-header-fixed">
        <div className="header-left">
          <div className="brand-section">
            <img src={logo} alt="TradeOPS Logo" className="logo" />
            <div>
              <h1 className="brand">{t.brand}</h1>
              <p className="status-line">{headerTime}</p>
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="electronic-status-panel">
            <div className="electronic-status-item">
              <span
                className={`electronic-dot ${
                  status.server_status === 'running'
                    ? 'green'
                    : status.server_status === 'starting'
                      ? 'yellow'
                      : 'red'
                }`}
              />
              <span className="electronic-label">SERVER</span>
              <span className="electronic-value">
                {getStatusLabel(language as 'tr' | 'en', status.server_status)}
              </span>
              <span className="electronic-meta">R:{status.server_restart_count}</span>
            </div>

            <div className="electronic-divider" />

            <div className="electronic-status-item">
              <span
                className={`electronic-dot ${
                  status.tws_status === 'running' ? 'green' : 'red'
                }`}
              />
              <span className="electronic-label">TWS</span>
              <span className="electronic-value">
                {getStatusLabel(
                  language as 'tr' | 'en',
                  status.tws_status === 'running' ? 'running' : 'stopped',
                )}
              </span>
              <span className="electronic-meta">
                {status.tws_path_exists ? 'PATH OK' : 'PATH ERR'}
              </span>
            </div>
          </div>
        </div>

        <div className="header-right">
          <Link to="/" className="header-nav-btn">
            {language === 'tr' ? 'Anasayfa' : 'Home'}
          </Link>

          <Link to="/broker" className="header-nav-btn">
            {language === 'tr' ? 'Broker Paneli' : 'Broker Panel'}
          </Link>

          {user?.userType === 'ADMIN' ? (
            <Link to="/admin-panel" className="header-nav-btn">
              {language === 'tr' ? 'Admin Paneli' : 'Admin Panel'}
            </Link>
          ) : (
            <button type="button" className="header-nav-btn disabled-nav-btn" disabled>
              {language === 'tr' ? 'Admin Paneli' : 'Admin Panel'}
            </button>
          )}

          <Link
            to="/user-panel"
            className="header-nav-btn header-user-btn header-user-btn-wide"
            title={language === 'tr' ? 'Kullanıcı paneli için tıklayınız' : 'Click to open user panel'}
          >
            <span className="header-user-name">{user?.username || 'Guest'}</span>
            <span className="header-user-role">{user?.userType || 'CLIENT'}</span>
          </Link>

          <div className="header-flag-switch">
            <button
              type="button"
              className={`flag-btn ${language === 'tr' ? 'active' : ''}`}
              onClick={() => setLanguage('tr')}
              title="Turkish"
            >
              🇹🇷
            </button>
            <button
              type="button"
              className={`flag-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
              title="English"
            >
              🇬🇧
            </button>
          </div>

          <button
            type="button"
            className="primary-btn header-logout-btn"
            disabled={logoutBusy}
            onClick={() => setShowLogoutConfirm(true)}
          >
            {logoutBusy
              ? language === 'tr'
                ? 'Çıkılıyor...'
                : 'Logging out...'
              : language === 'tr'
                ? 'Çıkış Yap'
                : 'Log Out'}
          </button>
        </div>
      </header>

      {showLogoutConfirm && (
        <div className="app-confirm-overlay">
          <div className="app-confirm-card">
            <div className="app-confirm-title">
              {language === 'tr' ? 'Çıkış Onayı' : 'Logout Confirmation'}
            </div>

            <div className="app-confirm-text">
              {language === 'tr'
                ? 'Çıkış yaparsanız server ve TWS kapatılacaktır. Trade işlemleri otomatik olarak çalışmayacaktır. Devam etmek istiyor musunuz?'
                : 'If you log out, both server and TWS will be stopped. Trade operations will no longer run automatically. Do you want to continue?'}
            </div>

            <div className="app-confirm-actions">
              <button
                type="button"
                className="secondary-btn"
                disabled={logoutBusy}
                onClick={() => setShowLogoutConfirm(false)}
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>

              <button
                type="button"
                className="primary-btn"
                disabled={logoutBusy}
                onClick={handleConfirmedLogout}
              >
                {logoutBusy
                  ? language === 'tr'
                    ? 'Çıkış yapılıyor...'
                    : 'Logging out...'
                  : language === 'tr'
                    ? 'Çıkış Yap'
                    : 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}