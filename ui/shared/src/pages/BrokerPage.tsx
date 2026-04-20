import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import { useLanguage } from '../components/LanguageContext'
import { useRuntime } from '../components/RuntimeContext'
import { useAuth } from '../components/AuthContext'
import { useNavigate } from 'react-router-dom'

const LOCK_STORAGE_KEY = 'tradeops_broker_locked'

export default function BrokerPage() {
  const { language } = useLanguage()
  const {
    status,
    logs,
    startTws,
    stopTws,
    restartTws,
    startServer,
    stopServer,
    restartServer,
    stopAll,
    clearLogs,
    runRuntimeTest,
    verifyLockPassword,
  } = useRuntime()
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [isLocked, setIsLocked] = useState(() => {
    try {
      return sessionStorage.getItem(LOCK_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [lockPassword, setLockPassword] = useState('')
  const [lockError, setLockError] = useState('')
  const [controlsBusy, setControlsBusy] = useState(false)

  const logEndRef = useRef<HTMLDivElement | null>(null)
  const logContainerRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)

  useEffect(() => {
    try {
      sessionStorage.setItem(LOCK_STORAGE_KEY, isLocked ? '1' : '0')
    } catch {
      // sessiz
    }
  }, [isLocked])

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const sidebarInfo = useMemo(
    () => [
      {
        label: language === 'tr' ? 'Server Time Zone' : 'Server Time Zone',
        value: status.app_timezone || '-',
      },
      {
        label: language === 'tr' ? 'IBKR Port' : 'IBKR Port',
        value: status.ibkr_port || '-',
      },
    ],
    [language, status],
  )

  async function runAction(action: () => Promise<any>, successMessage?: string) {
    if (controlsBusy) return

    try {
      setControlsBusy(true)
      setActionError(false)
      const result = await action()
      if (successMessage) setActionMessage(successMessage)
      return result
    } catch (error) {
      setActionError(true)
      setActionMessage(error instanceof Error ? error.message : 'Request failed.')
      throw error
    } finally {
      window.setTimeout(() => {
        setControlsBusy(false)
      }, 2500)
    }
  }

  async function handleRuntimeTest() {
    const result = await runAction(
      () => runRuntimeTest(),
      language === 'tr' ? 'Runtime test tamamlandı.' : 'Runtime test completed.',
    )
    if (!result) return

    setActionError(false)
    setActionMessage(
      language === 'tr'
        ? `Test tamamlandı • TWS Path: ${result.tws_path_exists ? 'OK' : 'HATA'} • main.py: ${result.main_path_exists ? 'OK' : 'HATA'}`
        : `Runtime test completed • TWS Path: ${result.tws_path_exists ? 'OK' : 'ERROR'} • main.py: ${result.main_path_exists ? 'OK' : 'ERROR'}`,
    )
  }

  async function handleExit() {
    try {
      await stopAll()
    } catch {
      // yine de devam
    }
  
    setUser(null)
    setShowExitConfirm(false)
  
    try {
      window.close()
    } catch {
      // browser preview modunda gerçek pencere kapanmayabilir
    }
  
    navigate('/login', { replace: true })
  }

  async function handleUnlock() {
    const ok = await verifyLockPassword(lockPassword)

    if (!ok) {
      setLockError(language === 'tr' ? 'Şifre hatalı.' : 'Incorrect password.')
      return
    }

    setLockError('')
    setLockPassword('')
    setIsLocked(false)
  }

  function handleLogScroll() {
    const container = logContainerRef.current
    if (!container) return

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight

    shouldAutoScrollRef.current = distanceFromBottom < 40
  }

  const twsRunning = status.tws_status === 'running'
  const serverRunning = status.server_status === 'running'
  const serverStarting = status.server_status === 'starting'

  return (
    <div className={`app-shell ${isLocked ? 'app-shell-locked' : ''}`}>
      <AppHeader />

      <main className="broker-layout">
        <aside className="broker-sidebar">
          

          <div className="sidebar-section">
            <div className="sidebar-title">
              {language === 'tr' ? 'Yönetim' : 'Control'}
            </div>

            <button
              type="button"
              className="sidebar-primary-btn"
              disabled={controlsBusy || twsRunning}
              onClick={() =>
                runAction(
                  () => startTws(),
                  language === 'tr'
                    ? `TWS başlatıldı. Lütfen TWS uygulamasında giriş bilgilerinizle giriş yapın. Şu an ${status.ibkr_mode} modundasınız.`
                    : `TWS started. Please sign in within the TWS application. Current trade mode is ${status.ibkr_mode}.`,
                )
              }
            >
              {language === 'tr' ? 'TWS Başlat' : 'Launch TWS'}
            </button>

            <div className="sidebar-double-row">
              <button
                type="button"
                className="sidebar-stop-btn"
                disabled={controlsBusy || !twsRunning}
                onClick={() =>
                  runAction(
                    () => stopTws(),
                    language === 'tr' ? 'TWS durduruldu.' : 'TWS stopped.',
                  )
                }
              >
                {language === 'tr' ? 'TWS Durdur' : 'Stop TWS'}
              </button>

              <button
                type="button"
                className="sidebar-secondary-btn"
                disabled={controlsBusy}
                onClick={() =>
                  runAction(
                    () => restartTws(),
                    language === 'tr' ? 'TWS yeniden başlatıldı.' : 'TWS restarted.',
                  )
                }
              >
                {language === 'tr' ? 'TWS Restart' : 'TWS Restart'}
              </button>
            </div>

            <button
              type="button"
              className="sidebar-primary-btn"
              disabled={controlsBusy || serverRunning || serverStarting}
              onClick={() =>
                runAction(
                  () => startServer(),
                  language === 'tr'
                    ? 'Server başlatıldı. Sürekli çalışma izleniyor.'
                    : 'Server started. Continuous runtime is being monitored.',
                )
              }
            >
              {language === 'tr' ? 'Server Başlat' : 'Start Server'}
            </button>

            <div className="sidebar-double-row">
  <button
    type="button"
    className="sidebar-stop-btn"
    disabled={controlsBusy || !serverRunning}
    onClick={() =>
      runAction(
        () => stopServer(),
        language === 'tr' ? 'Server durduruldu.' : 'Server stopped.',
      )
    }
  >
    {language === 'tr' ? 'Server Durdur' : 'Stop Server'}
  </button>

  <button
    type="button"
    className="sidebar-secondary-btn"
    disabled={controlsBusy}
    onClick={() =>
      runAction(
        () => restartServer(),
        language === 'tr'
          ? 'Server yeniden başlatıldı.'
          : 'Server restarted.',
      )
    }
  >
    {language === 'tr' ? 'Server Restart' : 'Server Restart'}
  </button>
</div>

<button
  type="button"
  className="sidebar-secondary-btn"
  disabled={controlsBusy}
  onClick={handleRuntimeTest}
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
    <button type="button" className="sidebar-nav-btn">
      {language === 'tr' ? 'Cüzdan Özeti' : 'Wallet Overview'}
    </button>

    <button type="button" className="sidebar-nav-btn">
      {language === 'tr' ? 'Parametreler' : 'Parameters'}
    </button>

    <button type="button" className="sidebar-nav-btn">
      {language === 'tr' ? 'Emirler' : 'Orders'}
    </button>

    <button type="button" className="sidebar-nav-btn">
      {language === 'tr' ? 'Trade Aktivitesi' : 'Trade Activity'}
    </button>

    <button type="button" className="sidebar-nav-btn">
      {language === 'tr' ? 'Sorun Bildir' : 'Report Issue'}
    </button>
  </div>
</div>

<div className="sidebar-double-row sidebar-bottom-actions">
  <button
    type="button"
    className="sidebar-secondary-btn lock-btn"
    onClick={() => {
      setIsLocked(true)
      setLockError('')
      setLockPassword('')
    }}
  >
    <span className="lock-btn-icon">🔑</span>
    <span>{language === 'tr' ? 'Kilitle' : 'Lock'}</span>
  </button>

  <button
    type="button"
    className="sidebar-exit-btn"
    onClick={() => setShowExitConfirm(true)}
  >
    EXIT
  </button>
</div>
</aside>

<section className="broker-main">
  <div className="broker-summary-grid compact four-cols">
    <div className="broker-summary-card compact-card">
      <div className="broker-summary-label">
        {language === 'tr' ? 'Server Süreci' : 'Server Process'}
      </div>

      <div className="broker-summary-row">
        <div className="broker-summary-value">
          {status.server_status === 'running'
            ? language === 'tr'
              ? 'Aktif'
              : 'Running'
            : status.server_status === 'starting'
              ? language === 'tr'
                ? 'Başlıyor'
                : 'Starting'
              : language === 'tr'
                ? 'Kapalı'
                : 'Stopped'}
        </div>

        <div className="broker-summary-meta">
          PID: {status.server_pid ?? '-'} • R:{status.server_restart_count}/{status.server_retry_limit}
        </div>
      </div>
    </div>

    <div className="broker-summary-card compact-card">
      <div className="broker-summary-label">TWS</div>

      <div className="broker-summary-row">
        <div className="broker-summary-value">
          {status.tws_status === 'running'
            ? language === 'tr'
              ? 'Aktif'
              : 'Running'
            : language === 'tr'
              ? 'Kapalı'
              : 'Stopped'}
        </div>

        <div className="broker-summary-meta">
          {status.tws_path_exists ? 'PATH OK' : 'PATH ERR'}
        </div>
      </div>
    </div>

    <div className="broker-summary-card compact-card">
      <div className="broker-summary-label">
        {language === 'tr' ? 'Trade Modu' : 'Trade Mode'}
      </div>

      <div className="broker-summary-row">
        <div
          className={`broker-summary-mode ${
            status.ibkr_mode === 'LIVE' ? 'live' : 'paper'
          }`}
        >
          {status.ibkr_mode === 'LIVE' ? 'LIVE' : 'PAPER'}
        </div>

        <div className="broker-summary-meta">
          {language === 'tr' ? 'İşlem modu' : 'Execution mode'}
        </div>
      </div>
    </div>

    <div className="broker-summary-card compact-card">
      <div className="broker-summary-label">
        {language === 'tr' ? 'Çalışma Bilgisi' : 'Runtime Info'}
      </div>

      <div className="broker-summary-info-list">
        {sidebarInfo.map((item) => (
          <div className="broker-summary-info-row" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value || '-'}</strong>
          </div>
        ))}
      </div>
    </div>
  </div>

  {actionMessage && (
    <div className={actionError ? 'error-box-global' : 'broker-action-banner'}>
      {actionMessage}
    </div>
  )}

  <div className="broker-log-card">
    <div className="broker-log-header">
      <div className="broker-log-title">
        {language === 'tr' ? 'Canlı Log Ekranı' : 'Live Log Console'}
      </div>

      <button
        type="button"
        className="sidebar-secondary-btn small-log-btn"
        onClick={() => clearLogs()}
      >
        {language === 'tr' ? 'Temizle' : 'Clear'}
      </button>
    </div>

    <div
      ref={logContainerRef}
      className="broker-log-console"
      onScroll={handleLogScroll}
    >
      {logs.length === 0 ? (
        <div className="broker-log-empty">
          {language === 'tr' ? 'Henüz log yok.' : 'No logs yet.'}
        </div>
      ) : (
        logs.map((line, index) => (
          <div className="broker-log-line" key={`${index}-${line}`}>
            {line}
          </div>
        ))
      )}
      <div ref={logEndRef} />
    </div>
  </div>
</section>

{showExitConfirm && (
  <div className="app-confirm-overlay">
    <div className="app-confirm-card">
      <div className="app-confirm-title">
        {language === 'tr' ? 'Uygulamadan Çık' : 'Exit Application'}
      </div>

      <div className="app-confirm-text">
        {language === 'tr'
          ? 'Çıkış yaparsanız server ve TWS durdurulacaktır. Trade işlemleri otomatik olarak çalışmayacaktır. Devam etmek istiyor musunuz?'
          : 'If you exit, both server and TWS will be stopped. Trade operations will no longer run automatically. Do you want to continue?'}
      </div>

      <div className="app-confirm-actions">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setShowExitConfirm(false)}
        >
          {language === 'tr' ? 'İptal' : 'Cancel'}
        </button>

        <button type="button" className="primary-btn" onClick={handleExit}>
          {language === 'tr' ? 'Durdur ve Çık' : 'Stop and Exit'}
        </button>
      </div>
    </div>
  </div>
)}
      </main>
      {isLocked && (
          <div className="broker-lock-overlay">
            <div className="broker-lock-card">
              <div className="broker-lock-title">
                {language === 'tr' ? 'Ekran Kilitli' : 'Screen Locked'}
              </div>
              <div className="broker-lock-subtitle">
                {language === 'tr'
                  ? 'Arka planda sistem çalışmaya devam ediyor. Şifreyi unuttuysanız uygulamayı kapatıp yeniden giriş yapmanız gerekir. Bu durumda server ve TWS uygulamasını yeniden başlatmanız gerekecektir.'
                  : 'The system continues to run in the background. If you forgot your password, you must close the application and log in again. In that case, you will need to restart both the server and the TWS application.'}
              </div>

              <input
                className="broker-lock-input"
                type="password"
                maxLength={4}
                value={lockPassword}
                onChange={(e) => setLockPassword(e.target.value)}
                placeholder={language === 'tr' ? '4 haneli şifre' : '4-digit password'}
              />

              {lockError && <div className="error-box-global">{lockError}</div>}

              <button type="button" className="primary-btn" onClick={handleUnlock}>
                {language === 'tr' ? 'Kilidi Aç' : 'Unlock'}
              </button>
            </div>
          </div>
        )}

      <Footer />
    </div>
  )
}