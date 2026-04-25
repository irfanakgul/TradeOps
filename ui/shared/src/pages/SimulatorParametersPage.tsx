import { useEffect, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import SimulatorTabs from '../components/SimulatorTabs'
import { useLanguage } from '../components/LanguageContext'
import { useRuntime } from '../components/RuntimeContext'

type SimParams = {
  SIM_IBKR_MODE: string
  SIM_IBKR_HOST: string
  SIM_IBKR_PORT: string
  SIM_IBKR_CLIENT_ID: string
}

export default function SimulatorParametersPage() {
  const { language } = useLanguage()
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

  const [params, setParams] = useState<SimParams>({
    SIM_IBKR_MODE: 'PAPER',
    SIM_IBKR_HOST: '127.0.0.1',
    SIM_IBKR_PORT: '7497',
    SIM_IBKR_CLIENT_ID: '1',
  })
  const [draft, setDraft] = useState<SimParams>(params)
  const [editMode, setEditMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [controlsBusy, setControlsBusy] = useState(false)
  const [banner, setBanner] = useState('')
  const [error, setError] = useState('')

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

  async function loadParams() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('http://127.0.0.1:8000/api/simulator/parameters')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Parameters failed.')
      }

      setParams(result.params)
      setDraft(result.params)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parameters failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setLoading(true)
      setError('')
      setBanner('')

      const response = await fetch('http://127.0.0.1:8000/api/simulator/parameters/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: draft }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Save failed.')
      }

      setParams(result.params)
      setDraft(result.params)
      setEditMode(false)
      setBanner(language === 'tr' ? 'Parametreler kaydedildi.' : 'Parameters saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParams()
  }, [])

  const hasChanges = JSON.stringify(params) !== JSON.stringify(draft)

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
            <SimulatorTabs />

            <div className="focus-topbar">
              <div>
                <div className="trade-config-section-title">
                  Simulator Parameters
                </div>
                <div className="trade-config-field-note">
                  TEST/SIM IBKR connection info
                </div>
              </div>

              <div className="focus-topbar-actions">
                {!editMode ? (
                  <button
                    type="button"
                    className="sidebar-secondary-btn"
                    onClick={() => setEditMode(true)}
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="sidebar-primary-btn"
                      disabled={!hasChanges || loading}
                      onClick={handleSave}
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      className="sidebar-stop-btn"
                      onClick={() => {
                        setDraft(params)
                        setEditMode(false)
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="sim-mode-badge-row">
              <span
                className={`sim-mode-badge ${
                  draft.SIM_IBKR_MODE === 'LIVE' ? 'live' : 'paper'
                }`}
              >
                SIM MODE: {draft.SIM_IBKR_MODE}
              </span>
            </div>

            {hasChanges && editMode && (
              <div className="broker-action-banner">
                {language === 'tr'
                  ? 'Kaydedilmemiş değişiklikler var.'
                  : 'You have unsaved changes.'}
              </div>
            )}

            {banner && <div className="success-box">{banner}</div>}
            {error && <div className="error-box-global">{error}</div>}

            <div className="trade-config-field-grid">
              <div className="trade-config-field-card">
                <div className="trade-config-field-label">SIM_IBKR_MODE</div>
                {editMode ? (
                  <select
                    className="trade-config-input"
                    value={draft.SIM_IBKR_MODE}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        SIM_IBKR_MODE: e.target.value,
                        SIM_IBKR_PORT: e.target.value === 'LIVE' ? '7496' : '7497',
                      }))
                    }
                  >
                    <option value="PAPER">PAPER</option>
                    <option value="LIVE">LIVE</option>
                  </select>
                ) : (
                  <div className="trade-config-value">{draft.SIM_IBKR_MODE}</div>
                )}
              </div>

              <div className="trade-config-field-card">
                <div className="trade-config-field-label">SIM_IBKR_HOST</div>
                {editMode ? (
                  <input
                    className="trade-config-input"
                    value={draft.SIM_IBKR_HOST}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, SIM_IBKR_HOST: e.target.value }))
                    }
                  />
                ) : (
                  <div className="trade-config-value">{draft.SIM_IBKR_HOST}</div>
                )}
              </div>

              <div className="trade-config-field-card">
                <div className="trade-config-field-label">SIM_IBKR_PORT</div>
                {editMode ? (
                  <input
                    className="trade-config-input"
                    value={draft.SIM_IBKR_PORT}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        SIM_IBKR_PORT: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                  />
                ) : (
                  <div className="trade-config-value">{draft.SIM_IBKR_PORT}</div>
                )}
              </div>

              <div className="trade-config-field-card">
                <div className="trade-config-field-label">SIM_IBKR_CLIENT_ID</div>
                {editMode ? (
                  <input
                    className="trade-config-input"
                    value={draft.SIM_IBKR_CLIENT_ID}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        SIM_IBKR_CLIENT_ID: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                  />
                ) : (
                  <div className="trade-config-value">{draft.SIM_IBKR_CLIENT_ID}</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}