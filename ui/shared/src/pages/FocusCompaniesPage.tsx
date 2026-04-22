import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import { useRuntime } from '../components/RuntimeContext'
import { useSelectedUser } from '../components/SelectedUserContext'

type FocusCompanyRow = {
  USERNAME: string
  SYMBOL: string
  EXCHANGE: string
  COUNTRY: string | null
  USER_IN_SCOPE: boolean
  SECTOR: string | null
  COMPANY_NAME: string | null
}

type ExchangeSummaryRow = {
  EXCHANGE: string
  total_count: number
  in_scope_count: number
}

type FocusCompaniesResponse = {
  username: string
  all_exchanges: string[]
  allowed_exchanges: string[]
  display_exchange_map: Record<string, string>
  exchange_summary: ExchangeSummaryRow[]
  rows: FocusCompanyRow[]
}

type RowKey = string

function makeRowKey(row: FocusCompanyRow): RowKey {
  return `${row.USERNAME}__${row.SYMBOL}__${row.EXCHANGE}`
}

export default function FocusCompaniesPage() {
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

  const {
    availableUsers,
    selectedUsername,
    setSelectedUsername,
    canSelectAll,
  } = useSelectedUser()

  const [data, setData] = useState<FocusCompaniesResponse | null>(null)
  const [draftRows, setDraftRows] = useState<FocusCompanyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [controlsBusy, setControlsBusy] = useState(false)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')
  const [editMode, setEditMode] = useState(false)

  const [searchText, setSearchText] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'TRUE' | 'FALSE'>('ALL')
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([])

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

  async function loadData() {
    if (!user?.username || !user?.userType) return

    try {
      setLoading(true)
      setError('')
      setBanner('')

      const response = await fetch('http://127.0.0.1:8000/api/focus-companies', {
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
        throw new Error(result?.detail?.message || 'Focus companies failed.')
      }

      setData(result)
      setDraftRows(result.rows || [])
      setSelectedExchanges(result.allowed_exchanges || [])
      setEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load focus companies.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.username, user?.userType, selectedUsername])

  const sectors = useMemo(() => {
    const values = new Set<string>()
    draftRows.forEach((row) => {
      if (row.SECTOR?.trim()) values.add(row.SECTOR.trim())
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [draftRows])

  const countries = useMemo(() => {
    const values = new Set<string>()
    draftRows.forEach((row) => {
      if (row.COUNTRY?.trim()) values.add(row.COUNTRY.trim())
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [draftRows])

  const enabledExchangeSet = useMemo(() => {
    return new Set((data?.allowed_exchanges || []).map((x) => x.toUpperCase()))
  }, [data])

  const visibleRows = useMemo(() => {
    return draftRows.filter((row) => {
      const exchange = (row.EXCHANGE || '').toUpperCase()
      if (!selectedExchanges.includes(exchange)) return false

      const q = searchText.trim().toLowerCase()
      if (q) {
        const haystack = [
          row.SYMBOL,
          row.EXCHANGE,
          row.COUNTRY || '',
          row.SECTOR || '',
          row.COMPANY_NAME || '',
          row.USERNAME,
        ]
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(q)) return false
      }

      if (sectorFilter && (row.SECTOR || '') !== sectorFilter) return false
      if (countryFilter && (row.COUNTRY || '') !== countryFilter) return false

      if (scopeFilter === 'TRUE' && row.USER_IN_SCOPE !== true) return false
      if (scopeFilter === 'FALSE' && row.USER_IN_SCOPE !== false) return false

      return true
    })
  }, [draftRows, selectedExchanges, searchText, sectorFilter, countryFilter, scopeFilter])

  const originalRowMap = useMemo(() => {
    const map = new Map<RowKey, FocusCompanyRow>()
    ;(data?.rows || []).forEach((row) => {
      map.set(makeRowKey(row), row)
    })
    return map
  }, [data])

  const changedRows = useMemo(() => {
    return draftRows.filter((row) => {
      const original = originalRowMap.get(makeRowKey(row))
      return original && original.USER_IN_SCOPE !== row.USER_IN_SCOPE
    })
  }, [draftRows, originalRowMap])

  const hasUnsavedChanges = changedRows.length > 0

  function updateRowScope(rowKey: RowKey, nextValue: boolean) {
    setDraftRows((prev) =>
      prev.map((row) =>
        makeRowKey(row) === rowKey
          ? { ...row, USER_IN_SCOPE: nextValue }
          : row,
      ),
    )
  }

  function applyFilteredScope(nextValue: boolean) {
    const visibleKeySet = new Set(visibleRows.map((row) => makeRowKey(row)))
    setDraftRows((prev) =>
      prev.map((row) =>
        visibleKeySet.has(makeRowKey(row))
          ? { ...row, USER_IN_SCOPE: nextValue }
          : row,
      ),
    )
  }

  function toggleExchange(exchange: string) {
    if (!enabledExchangeSet.has(exchange.toUpperCase())) return

    setSelectedExchanges((prev) =>
      prev.includes(exchange)
        ? prev.filter((item) => item !== exchange)
        : [...prev, exchange],
    )
  }

  async function handleSaveAndExit() {
    if (!user?.username || !hasUnsavedChanges) return

    try {
      setLoading(true)
      setError('')
      setBanner('')

      const payload = changedRows.map((row) => ({
        username: row.USERNAME,
        symbol: row.SYMBOL,
        exchange: row.EXCHANGE,
        user_in_scope: row.USER_IN_SCOPE,
      }))

      const response = await fetch('http://127.0.0.1:8000/api/focus-companies/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: payload }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Save failed.')
      }

      setBanner(
        language === 'tr'
          ? 'Değişiklikler kaydedildi.'
          : 'Changes saved successfully.',
      )

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  function handleCancelEdit() {
    setDraftRows(data?.rows || [])
    setEditMode(false)
    setError('')
    setBanner('')
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
          <div className="trade-config-section-card">
            <div className="focus-topbar">
              <div>
                <div className="trade-config-section-title">FOCUS COMPANIES</div>
                
              </div>

              <div className="focus-topbar-actions">
                {canSelectAll ? (
                  <select
                    className="wallet-user-select"
                    value={selectedUsername}
                    onChange={(e) => setSelectedUsername(e.target.value)}
                    disabled={loading}
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

                {!editMode ? (
                  <button
                    type="button"
                    className="sidebar-secondary-btn"
                    onClick={() => setEditMode(true)}
                    disabled={loading}
                  >
                    {language === 'tr' ? 'Edit' : 'Edit'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="sidebar-primary-btn"
                      onClick={handleSaveAndExit}
                      disabled={loading || !hasUnsavedChanges}
                    >
                      {language === 'tr' ? 'Kaydet ve Çık' : 'Save and Exit'}
                    </button>

                    <button
                      type="button"
                      className="sidebar-stop-btn"
                      onClick={handleCancelEdit}
                      disabled={loading}
                    >
                      {language === 'tr' ? 'İptal' : 'Cancel'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {hasUnsavedChanges && editMode && (
              <div className="broker-action-banner">
                {language === 'tr'
                  ? 'Kaydedilmemiş değişiklikler var.'
                  : 'You have unsaved changes.'}
              </div>
            )}

            {banner && <div className="success-box">{banner}</div>}
            {error && <div className="error-box-global">{error}</div>}

            <div className="focus-summary-grid">
              {(data?.exchange_summary || []).map((item) => (
                <div key={item.EXCHANGE} className="focus-summary-card">
                  <div className="focus-summary-title">
                    {data?.display_exchange_map?.[item.EXCHANGE] || item.EXCHANGE}
                  </div>
                  <div className="focus-summary-line">
                    <span>{language === 'tr' ? 'In Scope' : 'In Scope'}</span>
                    <strong>{item.in_scope_count}</strong>
                  </div>
                  <div className="focus-summary-line">
                    <span>{language === 'tr' ? 'Toplam' : 'Total'}</span>
                    <strong>{item.total_count}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="focus-exchange-filter-row">
              {(data?.all_exchanges || []).map((exchange) => {
                const enabled = enabledExchangeSet.has(exchange.toUpperCase())
                const selected = selectedExchanges.includes(exchange)

                return (
                  <button
                    key={exchange}
                    type="button"
                    className={`focus-exchange-chip ${
                      selected ? 'selected' : ''
                    } ${!enabled ? 'disabled' : ''}`}
                    onClick={() => toggleExchange(exchange)}
                    disabled={!enabled}
                  >
                    {data?.display_exchange_map?.[exchange] || exchange}
                  </button>
                )
              })}
            </div>

            <div className="focus-filters-grid">
              <input
                className="trade-config-input"
                placeholder={
                  language === 'tr'
                    ? 'Ara: sembol, şirket, sektör, ülke...'
                    : 'Search: symbol, company, sector, country...'
                }
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />

              <select
                className="trade-config-input"
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="">{language === 'tr' ? 'Tüm Sektörler' : 'All Sectors'}</option>
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>

              <select
                className="trade-config-input"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              >
                <option value="">{language === 'tr' ? 'Tüm Ülkeler' : 'All Countries'}</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>

              <select
                className="trade-config-input"
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as 'ALL' | 'TRUE' | 'FALSE')}
              >
                <option value="ALL">{language === 'tr' ? 'Tüm Scope' : 'All Scope'}</option>
                <option value="TRUE">True</option>
                <option value="FALSE">False</option>
              </select>
            </div>

            {editMode && (
              <div className="focus-bulk-actions">
                <button
                  type="button"
                  className="sidebar-secondary-btn"
                  onClick={() => applyFilteredScope(true)}
                >
                  {language === 'tr' ? 'Filtreleneni True Yap' : 'Set Filtered True'}
                </button>

                <button
                  type="button"
                  className="sidebar-stop-btn"
                  onClick={() => applyFilteredScope(false)}
                >
                  {language === 'tr' ? 'Filtreleneni False Yap' : 'Set Filtered False'}
                </button>
              </div>
            )}

            <div className="focus-table-wrap">
              <table className="orders-table focus-table">
                <thead>
                  <tr>
                    <th>USERNAME</th>
                    <th>SYMBOL</th>
                    <th>EXCHANGE</th>
                    <th>COUNTRY</th>
                    <th>USER_IN_SCOPE</th>
                    <th>SECTOR</th>
                    <th>COMPANY_NAME</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="orders-empty-cell">
                        {language === 'tr' ? 'Veri yok.' : 'No data.'}
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => {
                      const rowKey = makeRowKey(row)
                      const changed = originalRowMap.get(rowKey)?.USER_IN_SCOPE !== row.USER_IN_SCOPE

                      return (
                        <tr key={rowKey} className={changed ? 'focus-row-changed' : ''}>
                          <td>{row.USERNAME}</td>
                          <td>{row.SYMBOL}</td>
                          <td>{data?.display_exchange_map?.[row.EXCHANGE] || row.EXCHANGE}</td>
                          <td>{row.COUNTRY || '-'}</td>
                          <td>
                            {editMode ? (
                              <select
                                className="focus-scope-select"
                                value={String(row.USER_IN_SCOPE)}
                                onChange={(e) =>
                                  updateRowScope(rowKey, e.target.value === 'true')
                                }
                              >
                                <option value="true">True</option>
                                <option value="false">False</option>
                              </select>
                            ) : (
                              <span className={`focus-scope-badge ${row.USER_IN_SCOPE ? 'true' : 'false'}`}>
                                {String(row.USER_IN_SCOPE)}
                              </span>
                            )}
                          </td>
                          <td>{row.SECTOR || '-'}</td>
                          <td>{row.COMPANY_NAME || '-'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}