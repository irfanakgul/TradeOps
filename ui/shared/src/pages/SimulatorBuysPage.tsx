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
  aprx_entry_price: number | null
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

type ActualPriceState = {
  loading: boolean
  price: number | null
  price_date: string | null
  error: string | null
}

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

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function holdingDays(rowDate: string | null, snapshotMs: number | null): number | null {
  if (!rowDate || snapshotMs == null) return null
  const m = rowDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  // Parse signal date as local midnight to avoid TZ off-by-one
  const sig = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const snap = new Date(snapshotMs)
  const today = new Date(snap.getFullYear(), snap.getMonth(), snap.getDate())
  const diffMs = today.getTime() - sig.getTime()
  return Math.floor(diffMs / 86_400_000)
}

function buildParamsString(state: RowState): string {
  switch (state.exit_type) {
    case 'limit':
      return 'target_price'
    case 'stop':
      return state.stop_price ? `stop=${state.stop_price}` : ''
    case 'stop_limit':
      return [
        state.stop_price ? `stop=${state.stop_price}` : '',
        state.limit_price ? `limit=${state.limit_price}` : '',
      ].filter(Boolean).join(' / ')
    case 'market_if_touched':
      return state.trigger_price ? `trigger=${state.trigger_price}` : ''
    case 'trailing_stop_amount':
      return state.trail_amount ? `amount=${state.trail_amount}` : ''
    case 'trailing_stop_percentage':
      return `${state.trailing_percent}%`
    default:
      return ''
  }
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
  const [allDates, setAllDates] = useState<string[]>([])
  const [allExchanges, setAllExchanges] = useState<string[]>([])
  const [simMode, setSimMode] = useState('PAPER')
  const [walletFunds, setWalletFunds] = useState<WalletFunds>({ PAPER: null, LIVE: null })

  const [dateTab, setDateTab] = useState<'latest' | 'all' | 'specific'>('latest')
  const [specificDate, setSpecificDate] = useState<string>('')
  const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(
    new Set(DEFAULT_SELECTED_EXCHANGES),
  )

  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [controlsBusy, setControlsBusy] = useState(false)
  const [actualPrices, setActualPrices] = useState<Record<string, ActualPriceState>>({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null)

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
      setAllDates(data.all_dates || [])
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
    } else if (dateTab === 'specific' && specificDate) {
      rows = rows.filter((r) => r.date === specificDate)
    }
    return rows.filter((r) => selectedExchanges.has(r.exchange))
  }, [signals, dateTab, latestDate, specificDate, selectedExchanges])

  const profitStats = useMemo(() => {
    const pcts: number[] = []
    let winners = 0
    let losers = 0
    for (const row of filteredSignals) {
      const ap = actualPrices[rowKey(row)]
      if (
        row.aprx_entry_price != null &&
        row.aprx_entry_price > 0 &&
        ap?.price != null
      ) {
        const pct = ((ap.price - row.aprx_entry_price) / row.aprx_entry_price) * 100
        pcts.push(pct)
        if (pct >= 0) winners += 1
        else losers += 1
      }
    }
    if (pcts.length === 0) return null
    const sum = pcts.reduce((a, b) => a + b, 0)
    const avg = sum / pcts.length
    return { sum, avg, count: pcts.length, winners, losers }
  }, [filteredSignals, actualPrices])

  function toggleExchange(exch: string) {
    setSelectedExchanges((prev) => {
      const next = new Set(prev)
      if (next.has(exch)) next.delete(exch)
      else next.add(exch)
      return next
    })
  }

  async function fetchActualPrices() {
    if (pricesLoading || filteredSignals.length === 0) return
    setPricesLoading(true)
    setLastUpdateAt(Date.now())
    const rows = filteredSignals
    for (const row of rows) {
      const key = rowKey(row)
      setActualPrices((prev) => ({
        ...prev,
        [key]: { loading: true, price: null, price_date: null, error: null },
      }))
      try {
        const params = new URLSearchParams({ symbol: row.symbol, exchange: row.exchange })
        const res = await fetch(
          `http://127.0.0.1:8000/api/simulator/trade-logs/actual-price?${params}`,
        )
        const data = await res.json()
        if (data.ok) {
          setActualPrices((prev) => ({
            ...prev,
            [key]: { loading: false, price: data.price, price_date: data.price_date, error: null },
          }))
        } else {
          setActualPrices((prev) => ({
            ...prev,
            [key]: {
              loading: false,
              price: null,
              price_date: null,
              error: data.reason || 'Fiyat alınamadı',
            },
          }))
        }
      } catch {
        setActualPrices((prev) => ({
          ...prev,
          [key]: { loading: false, price: null, price_date: null, error: 'Bağlantı hatası' },
        }))
      }
    }
    setPricesLoading(false)
  }

  function handleExport() {
    if (filteredSignals.length === 0) return

    const balance = walletFunds[simMode as 'PAPER' | 'LIVE']
    const headers = [
      'EXCHANGE',
      'SYMBOL',
      'DATE',
      'SCORE',
      'TARGET',
      'SIGNAL',
      'MAX_QTY',
      'QTY',
      'EXIT_TYPE',
      'PARAMS',
      'ENTRY_PRICE_APRX',
      'ACTUAL_PRICE',
      'PRICE_DATE',
      'HOLDING_DAYS',
      'ACTUAL_PROFIT_PCT',
    ]

    const lines: string[] = [headers.join(';')]

    for (const row of filteredSignals) {
      const key = rowKey(row)
      const state = getRowState(row)
      const ap = actualPrices[key]
      const priceToUse = ap?.price ?? row.target_price
      const maxQty =
        balance != null && priceToUse != null && priceToUse > 0
          ? Math.floor(balance / priceToUse)
          : null
      const profitPct =
        row.aprx_entry_price != null && row.aprx_entry_price > 0 && ap?.price != null
          ? ((ap.price - row.aprx_entry_price) / row.aprx_entry_price) * 100
          : null
      // For export, use snapshot if available, otherwise fall back to "now"
      const days = holdingDays(row.date, lastUpdateAt ?? Date.now())

      const cells = [
        row.exchange,
        row.symbol,
        row.date ?? '',
        row.score != null ? row.score.toFixed(2) : '',
        row.target_price != null ? row.target_price.toFixed(2) : '',
        row.signal ?? '',
        maxQty ?? '',
        state.qty,
        state.exit_type,
        buildParamsString(state),
        row.aprx_entry_price != null ? row.aprx_entry_price.toFixed(2) : '',
        ap?.price != null ? ap.price.toFixed(4) : '',
        ap?.price_date ?? '',
        days ?? '',
        profitPct != null ? `${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%` : '',
      ]
      lines.push(cells.map(csvEscape).join(';'))
    }

    // UTF-8 BOM so Excel renders Turkish characters correctly
    const csv = '﻿' + lines.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    a.href = url
    a.download = `tradeops_buy_signals_${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
                <select
                  className={`wallet-tab-btn ${dateTab === 'specific' ? 'active' : ''}`}
                  value={dateTab === 'specific' ? specificDate : ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) {
                      setSpecificDate(v)
                      setDateTab('specific')
                    } else {
                      setDateTab('latest')
                    }
                  }}
                  style={{ width: 'auto', padding: '10px 14px' }}
                >
                  <option value="">
                    {language === 'tr' ? '— Tarih Seç —' : '— Select Date —'}
                  </option>
                  {allDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
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

            {/* ── Action buttons (Export + Update Prices) ── */}
            {filteredSignals.length > 0 && (
              <div
                className="tl-topbar"
                style={{
                  marginTop: 8,
                  justifyContent: 'flex-end',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                {profitStats && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(157, 184, 214, 0.10)',
                      fontSize: 11,
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span style={{ color: '#94a3b8', textTransform: 'uppercase' }}>
                      {language === 'tr' ? 'Kazanan' : 'Winners'}
                    </span>
                    <span style={{ fontWeight: 700, color: '#2196f3', fontSize: 12 }}>
                      {profitStats.winners}
                    </span>
                    <span style={{ color: 'rgba(157, 184, 214, 0.25)' }}>·</span>
                    <span style={{ color: '#94a3b8', textTransform: 'uppercase' }}>
                      {language === 'tr' ? 'Kaybeden' : 'Losers'}
                    </span>
                    <span style={{ fontWeight: 700, color: '#e53935', fontSize: 12 }}>
                      {profitStats.losers}
                    </span>
                  </div>
                )}
                {profitStats && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(157, 184, 214, 0.10)',
                      fontSize: 11,
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span style={{ color: '#94a3b8', textTransform: 'uppercase' }}>
                      {language === 'tr' ? 'Toplam' : 'Sum'}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: profitStats.sum >= 0 ? '#2196f3' : '#e53935',
                        fontSize: 12,
                      }}
                    >
                      {profitStats.sum >= 0 ? '+' : ''}
                      {profitStats.sum.toFixed(2)}%
                    </span>
                    <span style={{ color: 'rgba(157, 184, 214, 0.25)' }}>·</span>
                    <span style={{ color: '#94a3b8', textTransform: 'uppercase' }}>
                      {language === 'tr' ? 'Ortalama' : 'Avg'}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: profitStats.avg >= 0 ? '#2196f3' : '#e53935',
                        fontSize: 12,
                      }}
                    >
                      {profitStats.avg >= 0 ? '+' : ''}
                      {profitStats.avg.toFixed(2)}%
                    </span>
                    <span style={{ color: 'rgba(157, 184, 214, 0.40)', fontSize: 10 }}>
                      ({profitStats.count})
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className="buy-action-btn"
                  onClick={handleExport}
                >
                  {language === 'tr' ? '↓ Excel\'e Aktar' : '↓ Export to Excel'}
                </button>
                <button
                  type="button"
                  className="buy-action-btn tl-update-btn"
                  disabled={pricesLoading}
                  onClick={fetchActualPrices}
                >
                  {pricesLoading
                    ? (language === 'tr' ? 'Fiyatlar çekiliyor...' : 'Fetching prices...')
                    : (language === 'tr' ? '↻ Güncel Fiyatları Güncelle' : '↻ Update Actual Prices')}
                </button>
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
                      <th>MAX QTY</th>
                      <th>QTY</th>
                      <th>EXIT TYPE</th>
                      <th>PARAMS</th>
                      <th>ENTRY PRICE(APRX.)</th>
                      <th>ACTUAL PRICE</th>
                      <th>PRICE DATE</th>
                      <th>HOLDING DAYS</th>
                      <th>ACTUAL PROFIT</th>
                      <th>BUY</th>
                      <th className="buy-result-col">RESULT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignals.length === 0 ? (
                      <tr>
                        <td colSpan={17} className="orders-empty-cell">
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

                            {/* MAX QTY */}
                            {(() => {
                              const ap = actualPrices[key]
                              const balance = walletFunds[simMode as 'PAPER' | 'LIVE']
                              const priceToUse = ap?.price ?? row.target_price
                              const maxQty =
                                balance != null && priceToUse != null && priceToUse > 0
                                  ? Math.floor(balance / priceToUse)
                                  : null
                              return (
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {ap?.loading ? (
                                    <span style={{ color: '#888', fontSize: 12 }}>...</span>
                                  ) : maxQty != null ? (
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        color: maxQty > 0 ? '#0891b2' : '#e53935',
                                        fontSize: 13,
                                      }}
                                    >
                                      {maxQty.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                                  )}
                                  {state.result?.ok && (() => {
                                    const updatedBalance = walletFunds[simMode as 'PAPER' | 'LIVE']
                                    const newMax =
                                      updatedBalance != null && priceToUse != null && priceToUse > 0
                                        ? Math.floor(updatedBalance / priceToUse)
                                        : null
                                    return newMax != null ? (
                                      <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                                        {language === 'tr' ? 'Güncel:' : 'Now:'} {newMax.toLocaleString()}
                                      </div>
                                    ) : null
                                  })()}
                                </td>
                              )
                            })()}

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

                            {/* ENTRY_PRICE(APRX.) */}
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {row.aprx_entry_price != null ? (
                                <span style={{ fontWeight: 600, color: '#475569' }}>
                                  {formatMoney(row.aprx_entry_price)}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                              )}
                            </td>

                            {/* ACTUAL PRICE / PRICE DATE / ACTUAL PROFIT */}
                            {(() => {
                              const ap = actualPrices[key]
                              const entry = row.aprx_entry_price
                              const cur = ap?.price ?? null
                              const profitPct =
                                entry != null && entry > 0 && cur != null
                                  ? ((cur - entry) / entry) * 100
                                  : null
                              return (
                                <>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    {ap?.loading ? (
                                      <span style={{ color: '#888', fontSize: 12 }}>...</span>
                                    ) : ap?.price != null ? (
                                      <span style={{ fontWeight: 600 }}>
                                        {new Intl.NumberFormat('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 4,
                                        }).format(ap.price)}
                                      </span>
                                    ) : ap?.error ? (
                                      <span
                                        style={{ color: '#e53935', fontSize: 11 }}
                                        title={ap.error}
                                      >
                                        —
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                                    )}
                                  </td>
                                  <td className="buy-date" style={{ whiteSpace: 'nowrap' }}>
                                    {ap?.price_date
                                      ? new Date(ap.price_date).toLocaleString('tr-TR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                                  </td>
                                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {(() => {
                                      const days = holdingDays(row.date, lastUpdateAt)
                                      return days != null ? (
                                        <span style={{ fontWeight: 600, color: '#475569' }}>
                                          {days}
                                        </span>
                                      ) : (
                                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                                      )
                                    })()}
                                  </td>
                                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {profitPct != null ? (
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          padding: '3px 10px',
                                          borderRadius: 6,
                                          fontWeight: 700,
                                          fontSize: 13,
                                          backgroundColor:
                                            profitPct >= 0
                                              ? 'rgba(33, 150, 243, 0.12)'
                                              : 'rgba(229, 57, 53, 0.12)',
                                          color: profitPct >= 0 ? '#2196f3' : '#e53935',
                                        }}
                                      >
                                        {profitPct >= 0 ? '+' : ''}
                                        {profitPct.toFixed(2)}%
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                                    )}
                                  </td>
                                </>
                              )
                            })()}

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
