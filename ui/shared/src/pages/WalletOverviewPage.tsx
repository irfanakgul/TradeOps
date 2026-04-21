import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import { useRuntime } from '../components/RuntimeContext'
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
  } from 'recharts'

import { useSelectedUser } from '../components/SelectedUserContext'

type WalletActual = {
  username: string
  ibkr_mode: string
  fetched_at: string | null
  available_funds: number
  net_liquidation: number
  total_cash_value: number
  gross_position_value: number
} | null

type ChartRow = {
  username: string
  ibkr_mode: string
  fetched_at: string | null
  available_funds: number
  net_liquidation: number
  total_cash_value: number
  gross_position_value: number
}

type PerformanceBlock = {
  label: string
  start_value: number | null
  end_value: number | null
  diff_value: number | null
  diff_pct: number | null
}

type WalletOverviewResponse = {
  actual: WalletActual
  chart_rows: ChartRow[]
  performance: Record<string, PerformanceBlock>
}

function formatCurrency(value: number | null, language: 'tr' | 'en') {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(value: string | null, language: 'tr' | 'en') {
  if (!value) return '-'
  return new Date(value).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function performanceLabel(key: string, language: 'tr' | 'en') {
  const map: Record<string, { tr: string; en: string }> = {
    all_time: { tr: 'Tüm Zamanlar', en: 'All Time' },
    six_months: { tr: '6 Ay', en: '6 Months' },
    three_months: { tr: '3 Ay', en: '3 Months' },
    one_month: { tr: '1 Ay', en: '1 Month' },
    two_weeks: { tr: '2 Hafta', en: '2 Weeks' },
    one_week: { tr: '1 Hafta', en: '1 Week' },
  }
  return map[key]?.[language] ?? key
}

export default function WalletOverviewPage() {
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

  const [activeTab, setActiveTab] = useState<'LIVE' | 'PAPER'>('LIVE')
  const [chartDays, setChartDays] = useState<7 | 14 | 30>(30)
  const [data, setData] = useState<WalletOverviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [controlsBusy, setControlsBusy] = useState(false)
  const { availableUsers, selectedUsername, setSelectedUsername, canSelectAll } =
  useSelectedUser()
  
  async function runAction(action: () => Promise<any>) {
    if (controlsBusy) return

    try {
      setControlsBusy(true)
      await action()
    } finally {
      window.setTimeout(() => {
        setControlsBusy(false)
      }, 2000)
    }
  }

  async function fetchData() {
    if (!user?.username) return

    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        requesting_username: user.username,
        requesting_user_type: user.userType,
        selected_username: selectedUsername,
        ibkr_mode: activeTab,
        chart_days: String(chartDays),
      })

      const response = await fetch(
        `http://127.0.0.1:8000/api/wallet-overview?${params.toString()}`,
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Wallet overview failed.')
      }

      setData(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'tr'
            ? 'Veri alınamadı.'
            : 'Failed to load data.',
      )
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    }, [user?.username, user?.userType, selectedUsername, activeTab, chartDays])

  async function handleExit() {
    try {
      await stopAll()
    } catch {
      // sessiz geç
    }
  }

  const chartRows = useMemo(() => {
    return (data?.chart_rows ?? []).map((row) => ({
      chart_label: formatDateTime(row.fetched_at, language as 'tr' | 'en'),
      available_funds: Number(row.available_funds ?? 0),
      net_liquidation: Number(row.net_liquidation ?? 0),
      total_cash_value: Number(row.total_cash_value ?? 0),
      gross_position_value: Number(row.gross_position_value ?? 0),
    }))
  }, [data, language])

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="broker-layout">
        <BrokerSidebar
          activeItem="wallet"
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
                className={`wallet-tab-btn ${activeTab === 'LIVE' ? 'active' : ''}`}
                onClick={() => setActiveTab('LIVE')}
              >
                LIVE
              </button>

              <button
                type="button"
                className={`wallet-tab-btn ${activeTab === 'PAPER' ? 'active' : ''}`}
                onClick={() => setActiveTab('PAPER')}
              >
                PAPER
              </button>
              <div className="wallet-user-filter">
                <label className="wallet-user-filter-label">
                    {language === 'tr' ? 'Kullanıcı' : 'User'}
                </label>

                {canSelectAll ? (
                    <select
                    className="wallet-user-select"
                    value={selectedUsername}
                    onChange={(e) => setSelectedUsername(e.target.value)}
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

            <div className="wallet-range-tabs">
              <button
                type="button"
                className={`wallet-range-btn ${chartDays === 30 ? 'active' : ''}`}
                onClick={() => setChartDays(30)}
              >
                {language === 'tr' ? 'Son 30 Gün' : 'Last 30 Days'}
              </button>

              <button
                type="button"
                className={`wallet-range-btn ${chartDays === 14 ? 'active' : ''}`}
                onClick={() => setChartDays(14)}
              >
                {language === 'tr' ? 'Son 2 Hafta' : 'Last 2 Weeks'}
              </button>

              <button
                type="button"
                className={`wallet-range-btn ${chartDays === 7 ? 'active' : ''}`}
                onClick={() => setChartDays(7)}
              >
                {language === 'tr' ? 'Son 1 Hafta' : 'Last 1 Week'}
              </button>
            </div>
          </div>

          {loading && (
            <div className="broker-action-banner">
              {language === 'tr' ? 'Veriler yükleniyor...' : 'Loading data...'}
            </div>
          )}

          {error && <div className="error-box-global">{error}</div>}

          <div className="wallet-actual-grid">
            <div className="wallet-actual-card">
              <div className="wallet-actual-label">Available Funds</div>
              <div className="wallet-actual-value">
                {formatCurrency(data?.actual?.available_funds ?? null, language as 'tr' | 'en')}
              </div>
              <div className="wallet-actual-note">
                {language === 'tr'
                  ? 'Kullanılabilir nakit / fon miktarı.'
                  : 'Current available funds for use.'}
              </div>
            </div>

            <div className="wallet-actual-card">
              <div className="wallet-actual-label">Net Liquidation</div>
              <div className="wallet-actual-value">
                {formatCurrency(data?.actual?.net_liquidation ?? null, language as 'tr' | 'en')}
              </div>
              <div className="wallet-actual-note">
                {language === 'tr'
                  ? 'Toplam net portföy değeri.'
                  : 'Total net portfolio value.'}
              </div>
            </div>

            <div className="wallet-actual-card">
              <div className="wallet-actual-label">Total Cash Value</div>
              <div className="wallet-actual-value">
                {formatCurrency(data?.actual?.total_cash_value ?? null, language as 'tr' | 'en')}
              </div>
              <div className="wallet-actual-note">
                {language === 'tr'
                  ? 'Toplam nakit varlık değeri.'
                  : 'Total cash balance value.'}
              </div>
            </div>

            <div className="wallet-actual-card">
              <div className="wallet-actual-label">Gross Position Value</div>
              <div className="wallet-actual-value">
                {formatCurrency(
                  data?.actual?.gross_position_value ?? null,
                  language as 'tr' | 'en',
                )}
              </div>
              <div className="wallet-actual-note">
                {language === 'tr'
                  ? 'Toplam açık pozisyon büyüklüğü.'
                  : 'Total gross open position value.'}
              </div>
            </div>
          </div>

          <div className="wallet-updated-line">
            {language === 'tr' ? 'Son Güncelleme' : 'Last Updated'}:{' '}
            {formatDateTime(data?.actual?.fetched_at ?? null, language as 'tr' | 'en')}
          </div>

          <div className="wallet-performance-grid">
            {data &&
              Object.entries(data.performance).map(([key, value]) => {
                const positive = (value.diff_pct ?? 0) >= 0

                return (
                  <div key={key} className="wallet-performance-card">
                    <div className="wallet-performance-title">
                      {performanceLabel(key, language as 'tr' | 'en')}
                    </div>

                    <div
                      className={`wallet-performance-value ${
                        positive ? 'positive' : 'negative'
                      }`}
                    >
                      {value.diff_pct === null
                        ? '-'
                        : `${positive ? '+' : ''}${value.diff_pct.toFixed(2)}%`}
                    </div>

                    <div className="wallet-performance-sub">
                      {value.diff_value === null
                        ? '-'
                        : `${positive ? '+' : ''}${formatCurrency(
                            value.diff_value,
                            language as 'tr' | 'en',
                          )}`}
                    </div>
                  </div>
                )
              })}
          </div>

          <div className="wallet-chart-card">
  <div className="wallet-chart-title">
    {language === 'tr'
      ? 'Seçili Dönem Varlık Grafiği'
      : 'Selected Period Account Chart'}
  </div>

  <div className="wallet-chart-wrap">
    {chartRows.length === 0 ? (
      <div className="broker-log-empty">
        {language === 'tr' ? 'Veri yok.' : 'No data.'}
      </div>
    ) : (
        <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartRows}
          margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="chart_label" minTickGap={28} stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip />
          <Legend />
      
          <Line
            type="monotone"
            dataKey="available_funds"
            name="Available Funds"
            stroke="#22c55e"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
      
          <Line
            type="monotone"
            dataKey="net_liquidation"
            name="Net Liquidation"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
      
          <Line
            type="monotone"
            dataKey="total_cash_value"
            name="Total Cash Value"
            stroke="#f59e0b"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
      
          <Line
            type="monotone"
            dataKey="gross_position_value"
            name="Gross Position Value"
            stroke="#ef4444"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    )}
  </div>
</div>
        </section>
      </main>

      <Footer />
    </div>
  )
}