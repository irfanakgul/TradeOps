import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import logo from '../assets/tradeops-logo.svg'
import { useLanguage, type Language } from './LanguageContext'
import { useAuth } from './AuthContext'
import { useRuntime } from './RuntimeContext'
import HeaderNotifications from './HeaderNotifications'

function RuntimeDot({
  active,
  label,
}: {
  active: boolean
  label: string
}) {
  return (
    <div className="header-runtime-pill">
      <span className={`header-runtime-dot ${active ? 'active' : 'inactive'}`} />
      <span>{label}</span>
    </div>
  )
}

export default function AppHeader() {
  const { language, setLanguage, t } = useLanguage()
  const { user, setUser } = useAuth()
  const { status, stopAll } = useRuntime()
  const navigate = useNavigate()
  const location = useLocation()

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const isLoggedIn = Boolean(user?.username)
  const isAppPage =
    location.pathname === '/broker' ||
    location.pathname === '/user-panel' ||
    location.pathname === '/admin-panel' ||
    location.pathname === '/wallet-overview' ||
    location.pathname === '/orders' ||
    location.pathname === '/trade-configurations' ||
    location.pathname === '/focus-companies' ||
    location.pathname === '/notifications' ||
    location.pathname.startsWith('/admin-panel/')

  async function handleLogoutConfirmed() {
    try {
      await stopAll()
    } catch {
      //
    }

    setUser(null)
    setShowLogoutConfirm(false)
    navigate('/', { replace: true })
  }

  return (
    <>
      <header className="topbar">
        <div className="brand-section">
          <img src={logo} alt="TradeOPS Logo" className="logo" />
          <div>
            <h1 className="brand">
              <span className="brand-trade">Trade</span>
              <span className="brand-ops">OPS</span>
            </h1>
            <p className="brand-slogan">Precision · Automation · Execution</p>
          </div>
        </div>

        {!isLoggedIn ? (
          <div className="topbar-actions">
            <div className="header-flag-switch" role="group" aria-label="Language">
              <button
                type="button"
                className={`flag-btn ${language === 'tr' ? 'active' : ''}`}
                onClick={() => setLanguage('tr' as Language)}
                title="Türkçe"
              >
                🇹🇷
              </button>

              <button
                type="button"
                className={`flag-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => setLanguage('en' as Language)}
                title="English"
              >
                🇬🇧
              </button>
            </div>

            <Link to="/login" className="secondary-btn link-btn">
              {t.login}
            </Link>

            <Link to="/register" className="primary-btn link-btn">
              {t.register}
            </Link>
          </div>
        ) : (
          <div className="topbar-actions">
            <div className="header-runtime-group">
              <RuntimeDot
                active={status.server_status === 'running'}
                label={language === 'tr' ? 'Server' : 'Server'}
              />
              <RuntimeDot
                active={status.tws_status === 'running'}
                label="TWS"
              />
            </div>

            {isAppPage && (
              <Link to="/" className="secondary-btn link-btn">
                {language === 'tr' ? 'Ana Sayfa' : 'Home'}
              </Link>
            )}

            <Link
              to="/broker"
              className={`header-nav-btn ${location.pathname === '/broker' ? 'active' : ''}`}
            >
              {language === 'tr' ? 'Broker Paneli' : 'Broker Panel'}
            </Link>

            <Link
              to="/admin-panel"
              className={`header-nav-btn ${
                location.pathname === '/admin-panel' || location.pathname.startsWith('/admin-panel/')
                  ? 'active'
                  : ''
              }`}
            >
              {language === 'tr' ? 'Admin Paneli' : 'Admin Panel'}
            </Link>

            {user.userType === 'ADMIN' && (
              <Link
                to="/simulator/wallet-overview"
                className={`header-nav-btn ${
                  location.pathname.startsWith('/simulator') ? 'active' : ''
                }`}
              >
                Simulator
              </Link>
            )}

            <Link
              to="/user-panel"
              className="header-nav-btn header-user-btn header-user-btn-wide"
              title={language === 'tr' ? 'Kullanıcı paneli için tıklayınız' : 'Click to open user panel'}
            >
              <span className="header-user-name">{user.username}</span>
              <span className="header-user-role">{user.userType || 'CLIENT'}</span>
            </Link>

            <div className="header-flag-switch" role="group" aria-label="Language">
              <button
                type="button"
                className={`flag-btn ${language === 'tr' ? 'active' : ''}`}
                onClick={() => setLanguage('tr' as Language)}
                title="Türkçe"
              >
                🇹🇷
              </button>

              <button
                type="button"
                className={`flag-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => setLanguage('en' as Language)}
                title="English"
              >
                🇬🇧
              </button>
            </div>

            <HeaderNotifications />

            <button
              type="button"
              className="secondary-btn link-btn"
              onClick={() => setShowLogoutConfirm(true)}
            >
              Logout
            </button>
          </div>
        )}
      </header>

      {showLogoutConfirm && (
        <div className="app-confirm-overlay">
          <div className="app-confirm-card">
            <div className="app-confirm-title">
              {language === 'tr' ? 'Çıkış Yap' : 'Log Out'}
            </div>

            <div className="app-confirm-text">
              {language === 'tr'
                ? 'Çıkış yaparsanız server ve TWS durdurulacaktır. Trade işlemleri otomatik olarak çalışmayacaktır. Devam etmek istiyor musunuz?'
                : 'If you log out, both server and TWS will be stopped. Trade operations will no longer run automatically. Do you want to continue?'}
            </div>

            <div className="app-confirm-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowLogoutConfirm(false)}
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={handleLogoutConfirmed}
              >
                {language === 'tr' ? 'Çıkış Yap' : 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}