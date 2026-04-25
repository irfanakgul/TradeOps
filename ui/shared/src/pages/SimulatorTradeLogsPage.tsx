import { useEffect, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import SimulatorTabs from '../components/SimulatorTabs'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import { useRuntime } from '../components/RuntimeContext'
import { useSelectedUser } from '../components/SelectedUserContext'

const API = 'http://127.0.0.1:8000'

type PositionRow = {
  exchange: string
  symbol: string
  currency: string | null
  buy_quantity: number | null
  buy_price: number | null
  buy_time: string | null
  buy_exec_id: string | null
  buy_order_id: number | null
  exit_type: string | null
  exit_quantity: number | null
  exit_price: number | null
  exit_time: string | null
  profit_amount: number | null
  profit_pct: number | null
  fetched_at: string | null
}

type ActualPriceState = {
  loading: boolean
  price: number | null
  price_date: string | null
  error: string | null
}

type SellState = {
  loading: boolean
  result: {
    ok: boolean
    sell_price?: number | null
    sell_time?: string | null
    pct_change?: number | null
    status?: string | null
    reason?: string | null
    log?: { time: string; status: string; message: string; errorCode: number }[]
  } | null
}

function rowKey(r: PositionRow) {
  return `${r.symbol}_${r.exchange}_${r.buy_exec_id ?? r.buy_time ?? ''}`
}

function fmt(v: number | null | undefined, decimals = 2) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ProfitCell({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span>—</span>
  const color = pct >= 0 ? '#2196f3' : '#e53935'
  const sign = pct >= 0 ? '+' : ''
  return <span style={{ color, fontWeight: 600 }}>{sign}{fmt(pct, 2)}%</span>
}

export default function SimulatorTradeLogsPage() {
  const { language } = useLanguage()
  const { user } = useAuth()
  const {
    status,
    startTws, stopTws, restartTws,
    startServer, stopServer, restartServer,
    runRuntimeTest, stopAll,
  } = useRuntime()
  const { availableUsers, selectedUsername, setSelectedUsername, canSelectAll } = useSelectedUser()

  const [simMode, setSimMode] = useState<'PAPER' | 'LIVE'>('PAPER')
  const [activeTab, setActiveTab] = useState<'PAPER' | 'LIVE'>('PAPER')

  const [paperRows, setPaperRows] = useState<PositionRow[]>([])
  const [liveRows, setLiveRows] = useState<PositionRow[]>([])

  const [loadingPositions, setLoadingPositions] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [posError, setPosError] = useState('')
  const [controlsBusy, setControlsBusy] = useState(false)

  const [actualPrices, setActualPrices] = useState<Record<string, ActualPriceState>>({})
  const [sellStates, setSellStates] = useState<Record<string, SellState>>({})

  const effectiveUsername = selectedUsername || user?.username || ''

  async function runAction(action: () => Promise<unknown>) {
    if (controlsBusy) return
    try {
      setControlsBusy(true)
      await action()
    } finally {
      window.setTimeout(() => setControlsBusy(false), 2000)
    }
  }

  async function loadSimMode() {
    try {
      const res = await fetch(`${API}/api/simulator/trade-logs/sim-mode`)
      const data = await res.json()
      if (res.ok && data.sim_mode) {
        const m = data.sim_mode as 'PAPER' | 'LIVE'
        setSimMode(m)
        setActiveTab(m)
      }
    } catch {
      // sessiz geç
    }
  }

  async function loadPositions(mode: 'PAPER' | 'LIVE') {
    if (!effectiveUsername) return
    try {
      const params = new URLSearchParams({ username: effectiveUsername, ibkr_mode: mode })
      const res = await fetch(`${API}/api/simulator/trade-logs/open-positions?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail?.message || 'Pozisyonlar yüklenemedi.')
      if (mode === 'PAPER') setPaperRows(data.rows || [])
      else setLiveRows(data.rows || [])
    } catch (err) {
      setPosError(err instanceof Error ? err.message : 'Yükleme hatası.')
    }
  }

  async function loadAllPositions() {
    if (!effectiveUsername) return
    setLoadingPositions(true)
    setPosError('')
    await Promise.all([loadPositions('PAPER'), loadPositions('LIVE')])
    setLoadingPositions(false)
  }

  async function handleUpdate() {
    if (!effectiveUsername || updating) return
    setUpdating(true)
    setPosError('')
    setActualPrices({})
    setSellStates({})
    try {
      const res = await fetch(`${API}/api/simulator/trade-logs/update-positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesting_username: user?.username ?? '',
          requesting_user_type: user?.userType ?? '',
          selected_username: selectedUsername || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail?.message || 'Güncelleme başarısız.')
      setPaperRows(data.paper_rows || [])
      setLiveRows(data.live_rows || [])

      // Aktif tabdaki satırlar için güncel fiyatları çek
      const activeRows = activeTab === 'PAPER' ? (data.paper_rows || []) : (data.live_rows || [])
      await fetchActualPricesForRows(activeRows)
    } catch (err) {
      setPosError(err instanceof Error ? err.message : 'Güncelleme hatası.')
    } finally {
      setUpdating(false)
    }
  }

  async function fetchActualPricesForRows(rows: PositionRow[]) {
    for (const row of rows) {
      const key = rowKey(row)
      setActualPrices(prev => ({ ...prev, [key]: { loading: true, price: null, price_date: null, error: null } }))
      try {
        const params = new URLSearchParams({ symbol: row.symbol, exchange: row.exchange })
        const res = await fetch(`${API}/api/simulator/trade-logs/actual-price?${params}`)
        const data = await res.json()
        if (data.ok) {
          setActualPrices(prev => ({
            ...prev,
            [key]: { loading: false, price: data.price, price_date: data.price_date, error: null },
          }))
        } else {
          setActualPrices(prev => ({
            ...prev,
            [key]: { loading: false, price: null, price_date: null, error: data.reason || 'Fiyat alınamadı' },
          }))
        }
      } catch {
        setActualPrices(prev => ({
          ...prev,
          [key]: { loading: false, price: null, price_date: null, error: 'Bağlantı hatası' },
        }))
      }
    }
  }

  async function handleSell(row: PositionRow) {
    const key = rowKey(row)
    const sellState = sellStates[key]
    if (sellState?.loading) return

    setSellStates(prev => ({ ...prev, [key]: { loading: true, result: null } }))

    try {
      const res = await fetch(`${API}/api/simulator/trade-logs/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: row.symbol,
          exchange: row.exchange,
          currency: row.currency || 'USD',
          username: effectiveUsername,
          ibkr_mode: activeTab,
          buy_exec_id: row.buy_exec_id || null,
          buy_price: row.buy_price || null,
        }),
      })
      const data = await res.json()

      setSellStates(prev => ({ ...prev, [key]: { loading: false, result: data } }))

      if (data.ok) {
        // Satılan satırı güncelle
        const updater = (rows: PositionRow[]) =>
          rows.map(r =>
            rowKey(r) === key
              ? {
                  ...r,
                  exit_type: 'MARKET_SELL',
                  exit_price: data.sell_price ?? r.exit_price,
                  exit_time: data.sell_time ?? r.exit_time,
                  exit_quantity: data.qty ?? r.exit_quantity,
                  profit_pct: data.pct_change ?? r.profit_pct,
                }
              : r,
          )
        if (activeTab === 'PAPER') setPaperRows(updater)
        else setLiveRows(updater)
      }
    } catch (err) {
      setSellStates(prev => ({
        ...prev,
        [key]: {
          loading: false,
          result: { ok: false, reason: err instanceof Error ? err.message : 'Ağ hatası' },
        },
      }))
    }
  }

  useEffect(() => {
    loadSimMode()
  }, [])

  useEffect(() => {
    loadAllPositions()
  }, [effectiveUsername])

  const displayRows = activeTab === 'PAPER' ? paperRows : liveRows

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
                <div className="trade-config-section-title">
                  {language === 'tr' ? 'Trade Log' : 'Trade Log'}
                </div>
                <div className="trade-config-field-note">
                  {language === 'tr'
                    ? 'Açık pozisyonları görüntüle, fiyatları güncelle veya satış yap.'
                    : 'View open positions, update prices or execute a sell.'}
                </div>
              </div>

              <div className="sim-buy-header-right">
                <div className="sim-mode-badge-row">
                  <span className={`sim-mode-badge ${simMode === 'LIVE' ? 'live' : 'paper'}`}>
                    SIM MODE: {simMode}
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
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="sim-user-selector-static">{selectedUsername}</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── PAPER / LIVE tabs + Update button ── */}
            <div className="tl-topbar">
              <div className="wallet-mode-tabs">
                <button
                  type="button"
                  className={`wallet-tab-btn ${activeTab === 'PAPER' ? 'active' : ''}`}
                  onClick={() => setActiveTab('PAPER')}
                >
                  PAPER
                  {paperRows.length > 0 && (
                    <span className="buy-count-badge">{paperRows.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`wallet-tab-btn ${activeTab === 'LIVE' ? 'active' : ''}`}
                  onClick={() => setActiveTab('LIVE')}
                >
                  LIVE
                  {liveRows.length > 0 && (
                    <span className="buy-count-badge">{liveRows.length}</span>
                  )}
                </button>
              </div>

              <button
                type="button"
                className="buy-action-btn tl-update-btn"
                disabled={updating || loadingPositions}
                onClick={handleUpdate}
              >
                {updating
                  ? (language === 'tr' ? 'Güncelleniyor...' : 'Updating...')
                  : (language === 'tr' ? '↻ Pozisyonları Güncelle' : '↻ Update Open Positions')}
              </button>
            </div>

            {(loadingPositions || updating) && (
              <div className="broker-action-banner">
                {language === 'tr' ? 'Yükleniyor...' : 'Loading...'}
              </div>
            )}

            {posError && <div className="error-box-global">{posError}</div>}

            {/* ── Positions Table ── */}
            <div className="orders-table-card">
              <div className="orders-table-title">
                {activeTab} {language === 'tr' ? 'Açık Pozisyonlar' : 'Open Positions'}
                {displayRows.length > 0 && (
                  <span className="buy-count-badge">{displayRows.length}</span>
                )}
              </div>

              <div className="orders-table-wrap" style={{ overflowX: 'auto' }}>
                <table className="orders-table" style={{ minWidth: 1400 }}>
                  <thead>
                    <tr>
                      <th>EXCHANGE</th>
                      <th>SYMBOL</th>
                      <th>BUY DATE</th>
                      <th>BUY PRICE</th>
                      <th>QTY</th>
                      <th>SELL DATE</th>
                      <th>SELL PRICE</th>
                      <th>SELL STATUS</th>
                      <th>PROFIT</th>
                      <th>UPDATE DATE</th>
                      <th>ACTUAL PRICE</th>
                      <th>ACTUAL PROFIT</th>
                      <th>ACTUAL PRICE DATE</th>
                      <th>SELL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="orders-empty-cell">
                          {loadingPositions
                            ? '...'
                            : language === 'tr'
                              ? 'Açık pozisyon yok.'
                              : 'No open positions.'}
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((row) => {
                        const key = rowKey(row)
                        const actualState = actualPrices[key]
                        const sellState = sellStates[key]
                        const isSold = !!row.exit_price

                        const actualProfit =
                          actualState?.price != null && row.buy_price != null
                            ? ((actualState.price - row.buy_price) / row.buy_price) * 100
                            : null

                        return (
                          <tr
                            key={key}
                            className={isSold ? 'buy-row-success' : ''}
                          >
                            <td>
                              <span className="buy-exchange-tag">{row.exchange}</span>
                            </td>
                            <td>
                              <strong className="buy-symbol">{row.symbol}</strong>
                            </td>
                            <td className="buy-date">{fmtDate(row.buy_time)}</td>
                            <td>{fmt(row.buy_price, 4)}</td>
                            <td>{fmt(row.buy_quantity, 0)}</td>
                            <td className="buy-date">{fmtDate(row.exit_time)}</td>
                            <td>{fmt(row.exit_price, 4)}</td>
                            <td>
                              {row.exit_type ? (
                                <span
                                  className={`buy-signal-badge ${isSold ? 'buy' : 'neutral'}`}
                                  style={{ fontSize: 11 }}
                                >
                                  {row.exit_type}
                                </span>
                              ) : (
                                <span className="buy-signal-badge neutral" style={{ fontSize: 11 }}>
                                  OPEN
                                </span>
                              )}
                              {sellState?.result && !sellState.result.ok && (
                                <div style={{ color: '#e53935', fontSize: 11, marginTop: 2 }}>
                                  {sellState.result.reason}
                                  {sellState.result.status && (
                                    <span> ({sellState.result.status})</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td>
                              <ProfitCell pct={row.profit_pct} />
                            </td>
                            <td className="buy-date">{fmtDate(row.fetched_at)}</td>

                            {/* Actual Price */}
                            <td>
                              {actualState?.loading ? (
                                <span style={{ color: '#888', fontSize: 12 }}>...</span>
                              ) : actualState?.price != null ? (
                                <span style={{ fontWeight: 600 }}>{fmt(actualState.price, 4)}</span>
                              ) : actualState?.error ? (
                                <span style={{ color: '#e53935', fontSize: 11 }} title={actualState.error}>
                                  —
                                </span>
                              ) : (
                                <span>—</span>
                              )}
                            </td>

                            {/* Actual Profit */}
                            <td>
                              {actualState?.loading ? (
                                <span style={{ color: '#888', fontSize: 12 }}>...</span>
                              ) : (
                                <ProfitCell pct={actualProfit} />
                              )}
                            </td>

                            {/* Actual Price Date */}
                            <td className="buy-date">
                              {actualState?.price_date ? fmtDate(actualState.price_date) : '—'}
                            </td>

                            {/* Sell Button */}
                            <td>
                              {isSold ? (
                                <span style={{ color: '#888', fontSize: 12 }}>
                                  {language === 'tr' ? 'Satıldı' : 'Sold'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="buy-action-btn"
                                  style={{ background: '#e53935', minWidth: 64 }}
                                  disabled={sellState?.loading || false}
                                  onClick={() => handleSell(row)}
                                >
                                  {sellState?.loading ? '...' : 'SELL'}
                                </button>
                              )}
                            </td>
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
