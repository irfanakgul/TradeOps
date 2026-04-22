import { Link } from 'react-router-dom'
import { useLanguage } from './LanguageContext'
import { useAppLock } from './AppLockContext'

type BrokerSidebarProps = {
  controlsBusy: boolean
  twsRunning: boolean
  serverRunning: boolean
  serverStarting: boolean
  onStartTws: () => void
  onStopTws: () => void
  onRestartTws: () => void
  onStartServer: () => void
  onStopServer: () => void
  onRestartServer: () => void
  onRuntimeTest: () => void
  onLock: () => void
  onExit: () => void
  activeItem?: 'broker' | 'wallet' | 'orders' | 'trade-configurations'
}

export default function BrokerSidebar({
  controlsBusy,
  twsRunning,
  serverRunning,
  serverStarting,
  onStartTws,
  onStopTws,
  onRestartTws,
  onStartServer,
  onStopServer,
  onRestartServer,
  onRuntimeTest,
  onLock,
  onExit,
  activeItem = 'broker',
}: BrokerSidebarProps) {
  const { language } = useLanguage()
  const { lockApp } = useAppLock()

  return (
    <aside className="broker-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title">
          {language === 'tr' ? 'Yönetim' : 'Control'}
        </div>

        <button
          type="button"
          className="sidebar-primary-btn"
          disabled={controlsBusy || twsRunning}
          onClick={onStartTws}
        >
          {language === 'tr' ? 'TWS Başlat' : 'Launch TWS'}
        </button>

        <div className="sidebar-double-row">
          <button
            type="button"
            className="sidebar-stop-btn"
            disabled={controlsBusy || !twsRunning}
            onClick={onStopTws}
          >
            {language === 'tr' ? 'TWS Durdur' : 'Stop TWS'}
          </button>

          <button
            type="button"
            className="sidebar-secondary-btn"
            disabled={controlsBusy}
            onClick={onRestartTws}
          >
            {language === 'tr' ? 'TWS Restart' : 'TWS Restart'}
          </button>
        </div>

        <button
          type="button"
          className="sidebar-primary-btn"
          disabled={controlsBusy || serverRunning || serverStarting}
          onClick={onStartServer}
        >
          {language === 'tr' ? 'Server Başlat' : 'Start Server'}
        </button>

        <div className="sidebar-double-row">
          <button
            type="button"
            className="sidebar-stop-btn"
            disabled={controlsBusy || !serverRunning}
            onClick={onStopServer}
          >
            {language === 'tr' ? 'Server Durdur' : 'Stop Server'}
          </button>

          <button
            type="button"
            className="sidebar-secondary-btn"
            disabled={controlsBusy}
            onClick={onRestartServer}
          >
            {language === 'tr' ? 'Server Restart' : 'Server Restart'}
          </button>
        </div>

        <button
          type="button"
          className="sidebar-secondary-btn"
          disabled={controlsBusy}
          onClick={onRuntimeTest}
        >
          {language === 'tr' ? 'Server Test' : 'Runtime Test'}
        </button>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section sidebar-scroll-section">
        <div className="sidebar-title">
          {language === 'tr' ? 'Görünümler' : 'Views'}
        </div>

        <div className="sidebar-scroll-list">
          <Link
            to="/trade-configurations"
            className={`sidebar-nav-btn sidebar-link-btn ${
              activeItem === 'trade-configurations' ? 'active' : ''
            }`}
          >
            {language === 'tr' ? 'Trade Configurations' : 'Trade Configurations'}
          </Link>

          <Link
            to="/wallet-overview"
            className={`sidebar-nav-btn sidebar-link-btn ${
              activeItem === 'wallet' ? 'active' : ''
            }`}
          >
            {language === 'tr' ? 'Cüzdan Özeti' : 'Wallet Overview'}
          </Link>

          <Link
            to="/orders"
            className={`sidebar-nav-btn sidebar-link-btn ${
              activeItem === 'orders' ? 'active' : ''
            }`}
          >
            {language === 'tr' ? 'Emirler' : 'Orders'}
          </Link>

          <Link to="/contact" className="sidebar-nav-btn sidebar-link-btn">
            {language === 'tr' ? 'Sorun Bildir' : 'Report Issue'}
          </Link>
        </div>
      </div>

      <div className="sidebar-double-row sidebar-bottom-actions">
        <button
          type="button"
          className="sidebar-secondary-btn lock-btn"
          onClick={() => {
            lockApp()
            onLock()
          }}
        >
          <span className="lock-btn-icon">🔑</span>
          <span>{language === 'tr' ? 'Kilitle' : 'Lock'}</span>
        </button>

        <button
          type="button"
          className="sidebar-exit-btn"
          onClick={onExit}
        >
          EXIT
        </button>
      </div>
    </aside>
  )
}