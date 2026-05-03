import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import SimulatorTabs from '../components/SimulatorTabs'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import { useRuntime } from '../components/RuntimeContext'
import { useSelectedUser } from '../components/SelectedUserContext'

type WalletRow = {
  username: string
  ibkr_mode: 'PAPER' | 'LIVE'
  fetched_at: string
  available_funds: number | null
  net_liquidation: number | null
  total_cash_value: number | null
  gross_position_value: number | null
}

type SimulatorResponse = {
  username: string
  latest: {
    PAPER: WalletRow | null
    LIVE: WalletRow | null
  }
  history: WalletRow[]
}

type RangeKey = 'ALL' | '6M' | '3M' | '1M' | '2W' | '1W'

type SimParams = {
  SIM_IBKR_MODE: string
  SIM_IBKR_HOST: string
  SIM_IBKR_PORT: string
  SIM_IBKR_CLIENT_ID: string
}

const ranges: { key: RangeKey; label: string }[] = [
  { key: 'ALL', label: 'All Time' },
  { key: '6M', label: '6M' },
  { key: '3M', label: '3M' },
  { key: '1M', label: '1M' },
  { key: '2W', label: '2W' },
  { key: '1W', label: '1W' },
]

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function filterByRange(rows: WalletRow[], range: RangeKey) {
  if (range === 'ALL') return rows

  const now = new Date()
  const start = new Date(now)

  if (range === '6M') start.setMonth(start.getMonth() - 6)
  if (range === '3M') start.setMonth(start.getMonth() - 3)
  if (range === '1M') start.setMonth(start.getMonth() - 1)
  if (range === '2W') start.setDate(start.getDate() - 14)
  if (range === '1W') start.setDate(start.getDate() - 7)

  return rows.filter((row) => new Date(row.fetched_at) >= start)
}

export default function SimulatorWalletOverviewPage() {
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

  const [data, setData] = useState<SimulatorResponse | null>(null)
  const [range, setRange] = useState<RangeKey>('1M')
  const [loading, setLoading] = useState(false)
  const [controlsBusy, setControlsBusy] = useState(false)
  const [banner, setBanner] = useState('')
  const [error, setError] = useState('')

  const [simParams, setSimParams] = useState<SimParams>({
    SIM_IBKR_MODE: 'PAPER',
    SIM_IBKR_HOST: '127.0.0.1',
    SIM_IBKR_PORT: '7497',
    SIM_IBKR_CLIENT_ID: '1',
  })

  async function loadSimParams() {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/simulator/parameters')
      const result = await response.json()
  
      if (response.ok && result.params) {
        setSimParams(result.params)
      }
    } catch {
      // sessiz geç
    }
  }

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

      const response = await fetch('http://127.0.0.1:8000/api/simulator/wallet-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesting_username: user.username,
          requesting_user_type: user.userType,
          selected_username: selectedUsername,
          language,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Simulator wallet failed.')
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulator wallet failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateWallet() {
    if (!user?.username || !user?.userType) return

    try {
      setLoading(true)
      setError('')
      setBanner('')

      const response = await fetch('http://127.0.0.1:8000/api/simulator/wallet-overview/update', {
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
        throw new Error(result?.detail?.message || 'Wallet update failed.')
      }

      setData(result)
      setBanner(
        language === 'tr'
          ? 'Simulator wallet güncellendi.'
          : 'Simulator wallet updated.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet update failed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
  loadData()
  loadSimParams()
}, [user?.username, user?.userType, selectedUsername])

  const chartData = useMemo(() => {
    const rows = filterByRange(data?.history || [], range)

    return rows.map((row) => ({
      fetched_at: new Date(row.fetched_at).toLocaleDateString(),
      mode: row.ibkr_mode,
      available_funds: Number(row.available_funds || 0),
      net_liquidation: Number(row.net_liquidation || 0),
      total_cash_value: Number(row.total_cash_value || 0),
      gross_position_value: Number(row.gross_position_value || 0),
    }))
  }, [data, range])

  function renderWalletCard(mode: 'PAPER' | 'LIVE') {
    const row = data?.latest?.[mode] || null

    return (
      <div className={`sim-wallet-card ${mode === 'LIVE' ? 'live' : 'paper'}`}>
        <div className="sim-wallet-card-head">
          <span>{mode}</span>
          <small>{row?.fetched_at ? new Date(row.fetched_at).toLocaleString() : '-'}</small>
        </div>

        <div className="sim-wallet-grid">
          <div>
            <span>Available Funds</span>
            <strong>{formatMoney(row?.available_funds)}</strong>
          </div>
          <div>
            <span>Net Liquidation</span>
            <strong>{formatMoney(row?.net_liquidation)}</strong>
          </div>
          <div>
            <span>Total Cash Value</span>
            <strong>{formatMoney(row?.total_cash_value)}</strong>
          </div>
          <div>
            <span>Gross Position Value</span>
            <strong>{formatMoney(row?.gross_position_value)}</strong>
          </div>
        </div>
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
          onExit={handleExit}
        />

        <section className="broker-main wallet-page-main">
          <div className="trade-config-section-card">
            <SimulatorTabs />

            <div className="focus-topbar">
              <div>
                <div className="trade-config-section-title">
                  Simulator Wallet Overview
                </div>

                <div className="sim-mode-badge-row">
                  <span
                    className={`sim-mode-badge ${
                      simParams.SIM_IBKR_MODE === 'LIVE' ? 'live' : 'paper'
                    }`}
                    >
                      SIM MODE: {simParams.SIM_IBKR_MODE || 'PAPER'}
                  </span>
                </div>

                <div className="trade-config-field-note">
                  {language === 'tr'
                    ? 'PAPER ve LIVE simulator wallet değerleri.'
                    : 'PAPER and LIVE simulator wallet values.'}
                </div>
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

                <button
                  type="button"
                  className="sim-update-btn"
                  onClick={handleUpdateWallet}
                  disabled={loading}
                >
                  {loading
                    ? language === 'tr'
                      ? 'Güncelleniyor...'
                      : 'Updating...'
                    : 'Update Wallet'}
                </button>
              </div>
            </div>

            {loading && (
              <div className="broker-action-banner">
                ⏳ {language === 'tr' ? 'İşlem devam ediyor...' : 'Processing...'}
              </div>
            )}

            {banner && <div className="success-box">{banner}</div>}
            {error && <div className="error-box-global">{error}</div>}

            <div className="sim-wallet-cards">
              {renderWalletCard('PAPER')}
              {renderWalletCard('LIVE')}
            </div>

            <div className="sim-range-row">
              {ranges.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`focus-exchange-chip ${range === item.key ? 'selected' : ''}`}
                  onClick={() => setRange(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="sim-chart-card">
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fetched_at" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="available_funds" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="net_liquidation" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="total_cash_value" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="gross_position_value" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}