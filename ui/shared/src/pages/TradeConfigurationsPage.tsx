import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import { useRuntime } from '../components/RuntimeContext'
import { useSelectedUser } from '../components/SelectedUserContext'

type ConfigField = {
  key: string
  label: string
  description: string
  type: string
  editable: boolean
  value: string
}

type ConfigRow = {
  exchange_code: string
  fields: ConfigField[]
}

type ConfigSection = {
  file_group: string
  title: string
  fields?: ConfigField[]
  rows?: ConfigRow[]
}

type TradeConfigResponse = {
  username: string
  sections: ConfigSection[]
  message?: string
}

export default function TradeConfigurationsPage() {
  const { language } = useLanguage()
  const { user } = useAuth()
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
  const { availableUsers, selectedUsername, setSelectedUsername, canSelectAll } =
    useSelectedUser()

  const [data, setData] = useState<TradeConfigResponse | null>(null)
  const [draft, setDraft] = useState<TradeConfigResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [controlsBusy, setControlsBusy] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [banner, setBanner] = useState('')

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(data) !== JSON.stringify(draft)
  }, [data, draft])

  async function runAction(action: () => Promise<any>) {
    if (controlsBusy) return
    try {
      setControlsBusy(true)
      await action()
    } finally {
      window.setTimeout(() => setControlsBusy(false), 2000)
    }
  }

  async function loadConfigs() {
    if (!user?.username || !user?.userType) return

    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        requesting_username: user.username,
        requesting_user_type: user.userType,
        selected_username: selectedUsername,
      })

      const response = await fetch(
        `http://127.0.0.1:8000/api/trade-configurations?${params.toString()}`
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Trade configurations failed.')
      }

      setData(result)
      setDraft(JSON.parse(JSON.stringify(result)))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'tr'
            ? 'Veri alınamadı.'
            : 'Failed to load data.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [user?.username, user?.userType, selectedUsername])

  function updateFieldValue(
    fileGroup: string,
    key: string,
    value: string,
    exchangeCode?: string
  ) {
    if (!draft) return

    const updated = JSON.parse(JSON.stringify(draft)) as TradeConfigResponse

    for (const section of updated.sections) {
      if (section.file_group !== fileGroup) continue

      if (section.fields) {
        for (const field of section.fields) {
          if (field.key === key) {
            field.value = value
          }
        }
      }

      if (section.rows) {
        for (const row of section.rows) {
          if (row.exchange_code !== exchangeCode) continue
          for (const field of row.fields) {
            if (field.key === key) {
              field.value = value
            }
          }
        }
      }
    }

    const envLocalSection = updated.sections.find((s) => s.file_group == "env_local")
    if (envLocalSection?.fields) {
      const ibkrModeField = envLocalSection.fields.find((f) => f.key === 'IBKR_MODE')
      const ibkrPortField = envLocalSection.fields.find((f) => f.key === 'IBKR_PORT')
      if (ibkrModeField && ibkrPortField) {
        ibkrPortField.value = ibkrModeField.value === 'LIVE' ? '7496' : '7497'
      }
    }

    setDraft(updated)
  }

  async function handleSave() {
    if (!draft || !user?.username || !user?.userType) return

    try {
      setLoading(true)
      setError('')
      setBanner('')

      const response = await fetch('http://127.0.0.1:8000/api/trade-configurations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesting_username: user.username,
          requesting_user_type: user.userType,
          selected_username: selectedUsername,
          sections: draft.sections,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Save failed.')
      }

      setData(result)
      setDraft(JSON.parse(JSON.stringify(result)))
      setEditMode(false)
      setBanner(
        language === 'tr'
          ? 'Parametreler başarıyla kaydedildi.'
          : 'Parameters saved successfully.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetDefaults() {
    if (!user?.username || !user?.userType) return

    try {
      setLoading(true)
      setError('')
      setBanner('')

      const response = await fetch('http://127.0.0.1:8000/api/trade-configurations/reset-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesting_username: user.username,
          requesting_user_type: user.userType,
          selected_username: selectedUsername,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Reset failed.')
      }

      setData(result)
      setDraft(JSON.parse(JSON.stringify(result)))
      setEditMode(false)
      setBanner(
        language === 'tr'
          ? 'Varsayılan parametreler yüklendi.'
          : 'Default parameters loaded.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExit() {
    try {
      await stopAll()
    } catch {
      //
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="broker-layout">
        <BrokerSidebar
          activeItem="trade-configurations"
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
          <div className="wallet-tabs-row">
            <div className="wallet-mode-tabs">
              <button
                type="button"
                className="wallet-tab-btn active"
              >
                {language === 'tr' ? 'Trade Configurations' : 'Trade Configurations'}
              </button>
            </div>

            <div className="wallet-user-filter">
              <label className="wallet-user-filter-label">
                {language === 'tr' ? 'Kullanıcı' : 'User'}
              </label>

              {canSelectAll ? (
                <select
                  className="wallet-user-select"
                  value={selectedUsername}
                  onChange={(e) => setSelectedUsername(e.target.value)}
                  disabled={editMode}
                >
                  {availableUsers.map((username) => (
                    <option key={username} value={username}>
                      {username}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="wallet-user-static">{selectedUsername}</div>
              )}
            </div>
          </div>

          <div className="trade-config-toolbar">
            <button
              type="button"
              className="sidebar-secondary-btn"
              onClick={() => {
                setEditMode((prev) => !prev)
                setDraft(JSON.parse(JSON.stringify(data)))
              }}
            >
              {editMode
                ? language === 'tr' ? 'Cancel Edit' : 'Cancel Edit'
                : language === 'tr' ? 'Edit' : 'Edit'}
            </button>

            <button
              type="button"
              className="sidebar-primary-btn"
              disabled={!editMode || !hasUnsavedChanges || loading}
              onClick={handleSave}
            >
              {language === 'tr' ? 'Kaydet' : 'Save'}
            </button>

            <button
              type="button"
              className="sidebar-stop-btn"
              disabled={loading}
              onClick={handleResetDefaults}
            >
              {language === 'tr' ? 'Reset Parameters' : 'Reset Parameters'}
            </button>
          </div>

          {editMode && hasUnsavedChanges && (
            <div className="broker-action-banner">
              {language === 'tr'
                ? 'Kaydedilmemiş değişiklikler var.'
                : 'You have unsaved changes.'}
            </div>
          )}

          {banner && <div className="success-box">{banner}</div>}
          {error && <div className="error-box-global">{error}</div>}
          {loading && <div className="broker-action-banner">{language === 'tr' ? 'Yükleniyor...' : 'Loading...'}</div>}

          {(draft?.sections ?? []).map((section) => (
            <div key={section.file_group} className="trade-config-section-card">
              <div className="trade-config-section-title">{section.title}</div>

              {section.fields && (
                <div className="trade-config-field-grid">
                  {section.fields.map((field) => (
                    <div key={field.key} className="trade-config-field-card">
                      <div className="trade-config-field-label">{field.label}</div>
                      <div className="trade-config-field-note">{field.description}</div>

                      {editMode && field.editable ? (
                        field.type === 'select' && field.key === 'IBKR_MODE' ? (
                          <select
                            className="trade-config-input"
                            value={field.value}
                            onChange={(e) =>
                              updateFieldValue(section.file_group, field.key, e.target.value)
                            }
                          >
                            <option value="PAPER">PAPER</option>
                            <option value="LIVE">LIVE</option>
                          </select>
                        ) : (
                          <input
                            className="trade-config-input"
                            value={field.value}
                            onChange={(e) =>
                              updateFieldValue(section.file_group, field.key, e.target.value)
                            }
                          />
                        )
                      ) : (
                        <div className={`trade-config-value ${!field.editable ? 'readonly' : ''}`}>
                          {String(field.value)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {section.rows && (
                <div className="trade-config-exchange-list">
                  {section.rows.map((row) => (
                    <div key={row.exchange_code} className="trade-config-exchange-card">
                      <div className="trade-config-exchange-title">{row.exchange_code}</div>

                      <div className="trade-config-field-grid">
                        {row.fields.map((field) => (
                          <div key={`${row.exchange_code}-${field.key}`} className="trade-config-field-card">
                            <div className="trade-config-field-label">{field.label}</div>
                            <div className="trade-config-field-note">{field.description}</div>

                            {editMode && field.editable ? (
                              <input
                                className="trade-config-input"
                                value={field.value}
                                onChange={(e) =>
                                  updateFieldValue(
                                    section.file_group,
                                    field.key,
                                    e.target.value,
                                    row.exchange_code
                                  )
                                }
                              />
                            ) : (
                              <div className={`trade-config-value ${!field.editable ? 'readonly' : ''}`}>
                                {String(field.value)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  )
}