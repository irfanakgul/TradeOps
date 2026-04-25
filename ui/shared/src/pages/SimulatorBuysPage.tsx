import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import SimulatorTabs from '../components/SimulatorTabs'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import { useRuntime } from '../components/RuntimeContext'
import { useSelectedUser } from '../components/SelectedUserContext'

type SignalRow = {
  exchange: string
  symbol: string
  date: string
  score: number | null
  target_price: number | null
  signal: string | null
}

type ExitType =
  | 'market'
  | 'limit'
  | 'stop'
  | 'stop_limit'
  | 'market_if_touched'
  | 'trailing_stop_amount'
  | 'trailing_stop_percentage'
  | 'market_on_close'
  | 'market_on_open'

type BuyResult = {
  ok: boolean
  message: string
  buy_shares?: number | null
  buy_price?: number | null
  buy_avg_price?: number | null
  exit_order_status?: string | null
  exit_order_type?: string | null
  exit_detail?: Record<string, unknown>
  buy_status?: string | null
  buy_log?: { time: string; status: string; message: string; errorCode: number }[]
}

type RowState = {
  exit_type: ExitType
  qty: number
  stop_price: string
  limit_price: string
  trigger_price: string
  trail_amount: string
  trailing_percent: number
  result: BuyResult | null
  loading: boolean
}

type WalletFunds = { PAPER: number | null; LIVE: number | null }

const EXIT_TYPES: ExitType[] = [
  'market',
  'limit',
  'stop',
  'stop_limit',
  'market_if_touched',
  'trailing_stop_amount',
  'trailing_stop_percentage',
  'market_on_close',
  'market_on_open',
]

const DEFAULT_SELECTED_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'EURONEXT'])

function defaultRowState(): RowState {
  return {
    exit_type: 'market',
    qty: 1,
    stop_price: '',
    limit_price: '',
    trigger_price: '',
    trail_amount: '',
    trailing_percent: 5,
    result: null,
    loading: false,
  }
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return '-'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function rowKey(row: SignalRow) {
  return `${row.exchange}_${row.symbol}_${row.date}`
}

export default function SimulatorBuysPage() {
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
  const { availableUsers, selectedUsername, setSelectedUsername, canSelectAll } = useSelectedUser()

  const [signals, setSignals] = useState<SignalRow[]>([])
  const [latestDate, setLatestDate] = useState<string | null>(null)
  const [allExchanges, setAllExchanges] = useState<string[]>([])
  const [simMode, setSimMode] = useState('PAPER')
  const [walletFunds, setWalletFunds] = useState<WalletFunds>({ PAPER: null, LIVE: null })

  const [dateTab, setDateTab] = useState<'latest' | 'all'>('latest')
  const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(
    new Set(DEFAULT_SELECTED_EXCHANGES),
  )

  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [controlsBusy, setControlsBusy] = useState(false)

  function getRowState(row: SignalRow): RowState {
    return rowStates[rowKey(row)] ?? defaultRowState()
  }

  function updateRowState(row: SignalRow, updates: Partial<RowState>) {
    const key = rowKey(row)
    setRowStates((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultRowState()), ...updates },
    }))
  }

  async function runAction(action: () => Promise<unknown>) {
    if (controlsBusy) return
    try {
      setControlsBusy(true)
      await action()
    } finally {
      window.setTimeout(() => setControlsBusy(false), 2000)
    }
  }

  async function loadSignals() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://127.0.0.1:8000/api/simulator/buy-signals')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail?.message || 'Failed to load signals.')
      setSignals(data.signals || [])
      setLatestDate(data.latest_date || null)
      setAllExchanges(data.exchanges || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load signals.')
    } finally {
      setLoading(false)
    }
  }

  async function loadSimParams() {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/simulator/parameters')
      const data = await res.json()
      if (res.ok && data.params) setSimMode(data.params.SIM_IBKR_MODE || 'PAPER')
    } catch {
      // sessiz geç
    }
  }

  async function loadWalletFunds() {
    const target = selectedUsername || user?.username
    if (!target) return
    try {
      const params = new URLSearchParams({ username: target })
      const res = await fetch(`http://127.0.0.1:8000/api/simulator/available-funds?${params}`)
      const data = await res.json()
      if (res.ok) {
        setWalletFunds({
          PAPER: data.PAPER ?? null,
          LIVE: data.LIVE ?? null,
        })
      }
    } catch {
      // sessiz geç
    }
  }

  useEffect(() => {
    loadSignals()
    loadSimParams()
    loadWalletFunds()
  }, [user?.username, user?.userType, selectedUsername])

  const filteredSignals = useMemo(() => {
    let rows = signals
    if (dateTab === 'latest' && latestDate) {
      rows = rows.filter((r) => r.date === latestDate)
    }
    return rows.filter((r) => selectedExchanges.has(r.exchange))
  }, [signals, dateTab, latestDate, selectedExchanges])

  function toggleExchange(exch: string) {
    setSelectedExchanges((prev) => {
      const next = new Set(prev)
      if (next.has(exch)) next.delete(exch)
      else next.add(exch)
      return next
    })
  }

  async function handleBuy(row: SignalRow) {
    const state = getRowState(row)
    if (state.loading) return

    updateRowState(row, { loading: true, result: null })

    const payload: Record<string, unknown> = {
      symbol: row.symbol,
      exchange: row.exchange,
      exit_type: state.exit_type,
      qty: state.qty,
      username: user?.username ?? '',
    }

    if (state.exit_type === 'limit') {
      payload.target_price = row.target_price
    } else if (state.exit_type === 'stop') {
      payload.stop_price = parseFloat(state.stop_price || '0')
    } else if (state.exit_type === 'stop_limit') {
      payload.stop_price = parseFloat(state.stop_price || '0')
      payload.limit_price = parseFloat(state.limit_price || '0')
    } else if (state.exit_type === 'market_if_touched') {
      payload.trigger_price = parseFloat(state.trigger_price || '0')
    } else if (state.exit_type === 'trailing_stop_amount') {
      payload.trail_amount = parseFloat(state.trail_amount || '0')
    } else if (state.exit_type === 'trailing_stop_percentage') {
      payload.trailing_percent = state.trailing_percent
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/api/simulator/execute-buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        updateRowState(row, {
          loading: false,
          result: { ok: false, message: data?.detail?.message || 'Request failed.' },
        })
      } else {
        updateRowState(row, { loading: false, result: data as BuyResult })
        loadWalletFunds()
      }
    } catch (err) {
      updateRowState(row, {
        loading: false,
        result: {
          ok: false,
          message: err instanceof Error ? err.message : 'Network error.',
        },
      })
    }
  }

  function renderParamsCell(row: SignalRow) {
    const state = getRowState(row)
    const et = state.exit_type

    if (et === 'market' || et === 'market_on_close' || et === 'market_on_open') {
      return <span className="buy-params-empty">—</span>
    }

    if (et === 'limit') {
      return (
        <span className="buy-params-readonly">
          {row.target_price != null ? formatMoney(row.target_price) : '—'}
        </span>
      )
    }

    if (et === 'stop') {
      return (
        <input
          type="number"
          className="trade-config-input buy-param-input"
          placeholder="Stop $"
          value={state.stop_price}
          onChange={(e) => updateRowState(row, { stop_price: e.target.value })}
        />
      )
    }

    if (et === 'stop_limit') {
      return (
        <div className="buy-param-stack">
          <input
            type="number"
            className="trade-config-input buy-param-input"
            placeholder="Stop $"
            value={state.stop_price}
            onChange={(e) => updateRowState(row, { stop_price: e.target.value })}
          />
          <input
            type="number"
            className="trade-config-input buy-param-input"
            placeholder="Limit $"
            value={state.limit_price}
            onChange={(e) => updateRowState(row, { limit_price: e.target.value })}
          />
        </div>
      )
    }

    if (et === 'market_if_touched') {
      return (
        <input
          type="number"
          className="trade-config-input buy-param-input"
          placeholder="Price $"
          value={state.trigger_price}
          onChange={(e) => updateRowState(row, { trigger_price: e.target.value })}
        />
      )
    }

    if (et === 'trailing_stop_amount') {
      return (
        <input
          type="number"
          className="trade-config-input buy-param-input"
          placeholder="Amount $"
          value={state.trail_amount}
          onChange={(e) => updateRowState(row, { trail_amount: e.target.value })}
        />
      )
    }

    if (et === 'trailing_stop_percentage') {
      return (
        <select
          className="trade-config-input buy-param-input"
          value={state.trailing_percent}
          onChange={(e) => updateRowState(row, { trailing_percent: parseInt(e.target.value) })}
        >
          {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}%
            </option>
          ))}
        </select>
      )
    }

    return null
  }

  function renderResultCell(row: SignalRow) {
    const state = getRowState(row)

    if (state.loading) {
      return <span className="buy-result-pending">⏳ Sending...</span>
    }

    if (!state.result) return null

    const r = state.result
    if (r.ok) {
      return (
        <div className="buy-result-success">
          <div className="buy-result-main">✓ {r.message}</div>
          {r.buy_shares != null && (
            <div className="buy-result-detail">
              Qty: {r.buy_shares} @ {formatMoney(r.buy_avg_price)}
            </div>
          )}
          {r.exit_order_status && (
            <div className="buy-result-detail">Exit: {r.exit_order_status}</div>
          )}
        </div>
      )
    }

    return (
      <div className="buy-result-error">
        <div className="buy-result-main">✗ {r.message}</div>
        {r.buy_status && <div className="buy-result-detail">Status: {r.buy_status}</div>}
      </div>
    )
  }

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
          onExit={() => stopAll()}
        />

        <section className="broker-main wallet-page-main">
          <div className="trade-config-section-card">
            <SimulatorTabs />

            {/* ── Header ── */}
            <div className="focus-topbar">
              <div>
                <div className="trade-config-section-title">Simulator Buy Signals</div>
                <div className="trade-config-field-note">
                  {language === 'tr'
                    ? 'Buy sinyallerini görüntüle ve simulator üzerinden emir gönder.'
                    : 'View buy signals and place orders via simulator.'}
                </div>
              </div>

              <div className="sim-buy-header-right">
                <div className="sim-mode-badge-row">
                  <span
                    className={`sim-mode-badge ${simMode === 'LIVE' ? 'live' : 'paper'}`}
                  >
                    SIM MODE: {simMode}
                  </span>
                  <span className="sim-mode-badge paper">
                    PAPER:{' '}
                    {walletFunds.PAPER != null ? formatMoney(walletFunds.PAPER) : '—'}
                  </span>
                  <span className="sim-mode-badge live">
                    LIVE:{' '}
                    {walletFunds.LIVE != null ? formatMoney(walletFunds.LIVE) : '—'}
                  </span>
                </div>

                <div className="sim-user-selector-row">
                  <span className="sim-user-selector-label">
                    {language === 'tr' ? 'Kullanıcı:' : 'User:'}
                  </span>
                  {canSelectAll ? (
                    <select
                      className="trade-config-input sim-user-selector-select"
                      value={selectedUsername}
                      onChange={(e) => setSelectedUsername(e.target.value)}
                    >
                      {availableUsers.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="sim-user-selector-static">{selectedUsername}</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Date Filter Tabs ── */}
            <div className="buy-filter-row">
              <div className="wallet-mode-tabs">
                <button
                  type="button"
                  className={`wallet-tab-btn ${dateTab === 'latest' ? 'active' : ''}`}
                  onClick={() => setDateTab('latest')}
                >
                  {latestDate
                    ? `Latest Date (${latestDate})`
                    : language === 'tr'
                      ? 'Son Tarih'
                      : 'Latest Date'}
                </button>
                <button
                  type="button"
                  className={`wallet-tab-btn ${dateTab === 'all' ? 'active' : ''}`}
                  onClick={() => setDateTab('all')}
                >
                  {language === 'tr' ? 'Tüm Tarihler' : 'All Dates'}
                </button>
              </div>
            </div>

            {/* ── Exchange Filter Chips ── */}
            {allExchanges.length > 0 && (
              <div className="buy-exchange-chips">
                {allExchanges.map((exch) => (
                  <button
                    key={exch}
                    type="button"
                    className={`focus-exchange-chip ${selectedExchanges.has(exch) ? 'selected' : ''}`}
                    onClick={() => toggleExchange(exch)}
                  >
                    {exch}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="broker-action-banner">
                {language === 'tr' ? 'Sinyaller yükleniyor...' : 'Loading signals...'}
              </div>
            )}

            {error && <div className="error-box-global">{error}</div>}

            {/* ── Buy Signals Table ── */}
            <div className="orders-table-card">
              <div className="orders-table-title">
                {language === 'tr' ? 'Buy Sinyalleri' : 'Buy Signals'}
                {filteredSignals.length > 0 && (
                  <span className="buy-count-badge">{filteredSignals.length}</span>
                )}
              </div>

              <div className="orders-table-wrap buy-signals-table-wrap">
                <table className="orders-table buy-signals-table">
                  <thead>
                    <tr>
                      <th>EXCHANGE</th>
                      <th>SYMBOL</th>
                      <th>DATE</th>
                      <th>SCORE</th>
                      <th>TARGET</th>
                      <th>SIGNAL</th>
                      <th>QTY</th>
                      <th>EXIT TYPE</th>
                      <th>PARAMS</th>
                      <th>BUY</th>
                      <th className="buy-result-col">RESULT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignals.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="orders-empty-cell">
                          {loading
                            ? '...'
                            : language === 'tr'
                              ? 'Veri yok.'
                              : 'No data.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSignals.map((row) => {
                        const state = getRowState(row)
                        const key = rowKey(row)
                        return (
                          <tr key={key} className={state.result?.ok ? 'buy-row-success' : state.result ? 'buy-row-error' : ''}>
                            <td>
                              <span className="buy-exchange-tag">{row.exchange}</span>
                            </td>
                            <td>
                              <strong className="buy-symbol">{row.symbol}</strong>
                            </td>
                            <td className="buy-date">{row.date ?? '—'}</td>
                            <td className="buy-score">
                              {row.score != null ? row.score.toFixed(2) : '—'}
                            </td>
                            <td className="buy-target">
                              {row.target_price != null
                                ? formatMoney(row.target_price)
                                : '—'}
                            </td>
                            <td>
                              {row.signal ? (
                                <span
                                  className={`buy-signal-badge ${
                                    row.signal.toUpperCase() === 'BUY' ? 'buy' : 'neutral'
                                  }`}
                                >
                                  {row.signal}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            {/* QTY */}
                            <td>
                              <input
                                type="number"
                                className="trade-config-input buy-qty-input"
                                min={1}
                                value={state.qty}
                                onChange={(e) =>
                                  updateRowState(row, {
                                    qty: Math.max(1, parseInt(e.target.value) || 1),
                                  })
                                }
                              />
                            </td>

                            {/* EXIT TYPE */}
                            <td>
                              <select
                                className="trade-config-input buy-exittype-select"
                                value={state.exit_type}
                                onChange={(e) =>
                                  updateRowState(row, {
                                    exit_type: e.target.value as ExitType,
                                  })
                                }
                              >
                                {EXIT_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* PARAMS */}
                            <td className="buy-params-cell">{renderParamsCell(row)}</td>

                            {/* BUY BUTTON */}
                            <td>
                              <button
                                type="button"
                                className="buy-action-btn"
                                disabled={state.loading}
                                onClick={() => handleBuy(row)}
                              >
                                {state.loading ? '...' : 'BUY'}
                              </button>
                            </td>

                            {/* RESULT */}
                            <td className="buy-result-col">{renderResultCell(row)}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
