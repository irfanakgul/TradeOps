import { Link, useNavigate } from 'react-router-dom'
import logo from '../../../assets/logo/tradeops-logo.png'
import { useLanguage, type Language } from './LanguageContext'
import { useAuth } from './AuthContext'
import { useRuntime } from './RuntimeContext'

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
  const { status } = useRuntime()
  const navigate = useNavigate()

  function handleLogout() {
    setUser(null)
    navigate('/login')
  }

  return (
    <header className="topbar app-header-fixed">
      <div className="header-left">
        <div className="brand-section">
          <img src={logo} alt="TradeOPS Logo" className="logo" />
          <div>
            <h1 className="brand">{t.brand}</h1>
            <p className="status-line">
              {t.status}: <span className="status-ready">{t.statusReady}</span>
            </p>
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
              {getStatusLabel(language, status.server_status)}
            </span>
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
              {getStatusLabel(language, status.tws_status === 'running' ? 'running' : 'stopped')}
            </span>
          </div>
        </div>
      </div>

      <div className="header-right">
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

        <Link to="/user-panel" className="header-user-box header-user-link">
          <div className="header-user-name">
            {user?.username || (language === 'tr' ? 'Misafir' : 'Guest')}
          </div>
          <div className="header-user-role">{user?.userType || 'CLIENT'}</div>
        </Link>

        <select
          className="header-language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
        >
          <option value="tr">TURKISH</option>
          <option value="en">ENGLISH</option>
        </select>

        <button type="button" className="primary-btn header-logout-btn" onClick={handleLogout}>
          {language === 'tr' ? 'Çıkış Yap' : 'Log Out'}
        </button>
      </div>
    </header>
  )
}