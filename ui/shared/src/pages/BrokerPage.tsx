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
    startServer,
    stopServer,
    stopAll,
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

  async function handleRuntimeTest() {
    try {
      const result = await runRuntimeTest()
      setActionError(false)
      setActionMessage(
        language === 'tr'
          ? `Test tamamlandı • TWS Path: ${result.tws_path_exists ? 'OK' : 'HATA'} • main.py: ${result.main_path_exists ? 'OK' : 'HATA'}`
          : `Runtime test completed • TWS Path: ${result.tws_path_exists ? 'OK' : 'ERROR'} • main.py: ${result.main_path_exists ? 'OK' : 'ERROR'}`,
      )
    } catch (error) {
      setActionError(true)
      setActionMessage(error instanceof Error ? error.message : 'Runtime test failed.')
    }
  }

  async function handleExit() {
    try {
      await stopAll()
    } catch {
      // yine de çıkışa devam
    }

    setUser(null)
    setShowExitConfirm(false)

    try {
      window.close()
    } catch {
      // browser preview
    }

    navigate('/login')
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
  
    // eğer kullanıcı aşağıdaysa auto-scroll aktif
    // yukarı çıkarsa devre dışı
    shouldAutoScrollRef.current = distanceFromBottom < 40
  }
  return (
    <div className="app-shell">
      <AppHeader />

      <main className="broker-layout">
        <aside className="broker-sidebar">
          <div
            className={`broker-mode-bar ${status.ibkr_mode === 'LIVE' ? 'live' : 'paper'}`}
          >
            {status.ibkr_mode === 'LIVE'
              ? language === 'tr'
                ? 'LIVE MODU AKTİF'
                : 'LIVE MODE ACTIVE'
              : language === 'tr'
                ? 'PAPER MODU AKTİF'
                : 'PAPER MODE ACTIVE'}
          </div>

          <div className="sidebar-section">
          <div className="sidebar-title">
            {language === 'tr' ? 'Yönetim' : 'Control'}
          </div>

          <button
              type="button"
              className="sidebar-primary-btn"
              onClick={async () => {
                try {
                  await startTws()
                  setActionError(false)
                  setActionMessage(language === 'tr' ? 'TWS başlatıldı.' : 'TWS started.')
                } catch (error) {
                  setActionError(true)
                  setActionMessage(error instanceof Error ? error.message : 'TWS start failed.')
                }
              }}
            >
              {language === 'tr' ? 'TWS Başlat' : 'Launch TWS'}
            </button>

            <div className="sidebar-double-row">
              <button
                type="button"
                className="sidebar-secondary-btn"
                onClick={async () => {
                  try {
                    await stopTws()
                    setActionError(false)
                    setActionMessage(language === 'tr' ? 'TWS durduruldu.' : 'TWS stopped.')
                  } catch (error) {
                    setActionError(true)
                    setActionMessage(error instanceof Error ? error.message : 'TWS stop failed.')
                  }
                }}
              >
                {language === 'tr' ? 'TWS Durdur' : 'Stop TWS'}
              </button>

              <button
                type="button"
                className="sidebar-secondary-btn"
                onClick={handleRuntimeTest}
              >
                {language === 'tr' ? 'Server Test' : 'Runtime Test'}
              </button>
            </div>

            <button
              type="button"
              className="sidebar-primary-btn"
              onClick={async () => {
                try {
                  await startServer()
                  setActionError(false)
                  setActionMessage(
                    language === 'tr'
                      ? 'Server başlatıldı. Sürekli çalışma izleniyor.'
                      : 'Server started. Continuous runtime is being monitored.',
                  )
                } catch (error) {
                  setActionError(true)
                  setActionMessage(error instanceof Error ? error.message : 'Server start failed.')
                }
              }}
            >
              {language === 'tr' ? 'Server Başlat' : 'Start Server'}
            </button>

            <button
              type="button"
              className="sidebar-secondary-btn"
              onClick={async () => {
                try {
                  await stopServer()
                  setActionError(false)
                  setActionMessage(language === 'tr' ? 'Server durduruldu.' : 'Server stopped.')
                } catch (error) {
                  setActionError(true)
                  setActionMessage(error instanceof Error ? error.message : 'Server stop failed.')
                }
              }}
            >
              {language === 'tr' ? 'Server Durdur' : 'Stop Server'}
            </button>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
          <div className="sidebar-title">
            {language === 'tr' ? 'Görünümler' : 'Views'}
          </div>

          <button type="button" className="sidebar-nav-btn">
            {language === 'tr' ? 'Parametreler' : 'Parameters'}
          </button>

          <button type="button" className="sidebar-nav-btn">
            {language === 'tr' ? 'Cüzdan Özeti' : 'Wallet Overview'}
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

          <div className="sidebar-divider" />

          <div className="sidebar-section sidebar-info-box">
            <div className="sidebar-title">
              {language === 'tr' ? 'Çalışma Bilgisi' : 'Runtime Info'}
            </div>

            {sidebarInfo.map((item) => (
              <div className="sidebar-info-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value || '-'}</strong>
              </div>
            ))}

            <div className="sidebar-mini-status">
              <div className="mini-status-item">
                <span
                  className={`mini-status-dot ${
                    status.server_status === 'running'
                      ? 'green'
                      : status.server_status === 'starting'
                        ? 'yellow'
                        : 'red'
                  }`}
                />
                <span>{language === 'tr' ? 'Server' : 'Server'}</span>
              </div>

              <div className="mini-status-item">
                <span
                  className={`mini-status-dot ${status.tws_status === 'running' ? 'green' : 'red'}`}
                />
                <span>TWS</span>
              </div>
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
            <span>{language === 'tr' ? 'Ekranı Kilitle' : 'Lock Screen'}</span>
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
          <div className="broker-summary-grid compact">
            <div className="broker-summary-card">
              <div className="broker-summary-label">
                {language === 'tr' ? 'Server Süreci' : 'Server Process'}
              </div>
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
              <div className="broker-summary-sub">
                PID: {status.server_pid ?? '-'} • Restart: {status.server_restart_count}
              </div>
            </div>

            <div className="broker-summary-card">
              <div className="broker-summary-label">TWS</div>
              <div className="broker-summary-value">
                {status.tws_status === 'running'
                  ? language === 'tr'
                    ? 'Aktif'
                    : 'Running'
                  : language === 'tr'
                    ? 'Kapalı'
                    : 'Stopped'}
              </div>
              <div className="broker-summary-sub">
                {language === 'tr' ? 'Path Kontrolü' : 'Path Check'}:{' '}
                {status.tws_path_exists ? 'OK' : 'ERROR'}
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
              <div>
                <div className="broker-log-title">
                  {language === 'tr' ? 'Canlı Log Ekranı' : 'Live Log Console'}
                </div>
                <div className="broker-log-subtitle">
                  {language === 'tr'
                    ? 'main.py ve runtime olayları burada akacaktır.'
                    : 'main.py and runtime events will stream here.'}
                </div>
              </div>
            </div>

            <div
              ref={logContainerRef}
              className="broker-log-console"
              onScroll={handleLogScroll}
            >
              {logs.length === 0 ? (
                <div className="broker-log-empty">
                  {language === 'tr'
                    ? 'Henüz log yok. TWS veya server başlatıldığında burada görünecek.'
                    : 'No logs yet. They will appear here when TWS or server starts.'}
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

        {isLocked && (
          <div className="broker-lock-overlay">
            <div className="broker-lock-card">
              <div className="broker-lock-title">
                {language === 'tr' ? 'Ekran Kilitli' : 'Screen Locked'}
              </div>
              <div className="broker-lock-subtitle">
                {language === 'tr'
                  ? 'Arka planda sistem çalışmaya devam ediyor.'
                  : 'The system continues to run in the background.'}
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

        {showExitConfirm && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3>{language === 'tr' ? 'Uygulamadan Çık' : 'Exit Application'}</h3>
              <p className="register-subtitle">
                {language === 'tr'
                  ? 'Çıkış yaparsanız server ve TWS durdurulacaktır. Devam etmek istiyor musunuz?'
                  : 'If you exit, both server and TWS will be stopped. Do you want to continue?'}
              </p>

              <div className="modal-actions">
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

      <Footer />
    </div>
  )
}