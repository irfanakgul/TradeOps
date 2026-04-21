import { useEffect, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Footer from '../components/Footer'
import BrokerSidebar from '../components/BrokerSidebar'
import { useLanguage } from '../components/LanguageContext'
import { useAuth } from '../components/AuthContext'
import { useRuntime } from '../components/RuntimeContext'
import { useSelectedUser } from '../components/SelectedUserContext'

type BuyLimitRow = {
  exchange: string
  updated_at: string | null
  total_max_open_positions: number | null
  max_daily_trade_count: number | null
  exchange_max_open_positions: number | null
  current_open_position_count: number | null
  remaining_open_position_slots: number | null
  today_buy_count_used: number | null
  today_buy_count_remaining: number | null
  allocated_budget_pct: number | null
  allocated_budget_amount: number | null
  available_funds: number | null
  planned_buy_count: number | null
}

type PositionRow = {
  exchange: string
  symbol: string
  ibkr_mode: string
  is_open: boolean | null
  entry_date: string | null
  last_price: number | null
  holding_days_used: number | null
  remaining_holding_days: number | null
  currency: string | null
  position_qty: number | null
  avg_cost: number | null
  market_price: number | null
  updated_at: string | null
}

type OrdersOverviewResponse = {
  username: string
  ibkr_mode: string
  updated_at: string | null
  buy_limits: BuyLimitRow[]
  positions: PositionRow[]
}

function formatNumber(value: number | null, language: 'tr' | 'en') {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
    minimumFractionDigits: 0,
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

function formatDate(value: string | null, language: 'tr' | 'en') {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const limitDescriptions: Record<string, { tr: string; en: string }> = {
  total_max_open_positions: {
    tr: 'Global maksimum açık pozisyon limiti',
    en: 'Global max open position limit',
  },
  max_daily_trade_count: {
    tr: 'Günlük maksimum trade limiti',
    en: 'Maximum daily trade limit',
  },
  exchange_max_open_positions: {
    tr: 'Borsa bazlı maksimum açık pozisyon',
    en: 'Exchange max open positions',
  },
  current_open_position_count: {
    tr: 'Mevcut açık pozisyon sayısı',
    en: 'Current open position count',
  },
  remaining_open_position_slots: {
    tr: 'Kalan açık pozisyon slotu',
    en: 'Remaining open position slots',
  },
  today_buy_count_used: {
    tr: 'Bugün kullanılan buy hakkı',
    en: 'Today buy count used',
  },
  today_buy_count_remaining: {
    tr: 'Bugün kalan buy hakkı',
    en: 'Today buy count remaining',
  },
  allocated_budget_pct: {
    tr: 'Ayrılan bütçe yüzdesi',
    en: 'Allocated budget percent',
  },
  allocated_budget_amount: {
    tr: 'Ayrılan bütçe tutarı',
    en: 'Allocated budget amount',
  },
  available_funds: {
    tr: 'Kullanılabilir fon',
    en: 'Available funds',
  },
  planned_buy_count: {
    tr: 'Planlanan buy sayısı',
    en: 'Planned buy count',
  },
}

export default function OrdersPage() {
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

  const [activeTab, setActiveTab] = useState<'LIVE' | 'PAPER'>('LIVE')
  const [data, setData] = useState<OrdersOverviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [controlsBusy, setControlsBusy] = useState(false)

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
    if (!user?.username || !user?.userType) return

    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        requesting_username: user.username,
        requesting_user_type: user.userType,
        selected_username: selectedUsername,
        ibkr_mode: activeTab,
      })

      const response = await fetch(
        `http://127.0.0.1:8000/api/orders-overview?${params.toString()}`,
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail?.message || 'Orders overview failed.')
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
  }, [user?.username, user?.userType, selectedUsername, activeTab])

  async function handleExit() {
    try {
      await stopAll()
    } catch {
      // sessiz geç
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="broker-layout">
        <BrokerSidebar
          activeItem="orders"
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

          {loading && (
            <div className="broker-action-banner">
              {language === 'tr' ? 'Veriler yükleniyor...' : 'Loading data...'}
            </div>
          )}

          {error && <div className="error-box-global">{error}</div>}

          <div className="wallet-updated-line">
            {language === 'tr' ? 'Son Güncelleme' : 'Last Updated'}:{' '}
            {formatDateTime(data?.updated_at ?? null, language as 'tr' | 'en')}
          </div>

          <div className="orders-table-card">
            <div className="orders-table-title">
                {language === 'tr'
                ? 'Borsa Bazlı Limit Parametreleri'
                : 'Exchange Limit Parameters'}
            </div>

            <div className="orders-table-wrap orders-table-wrap-limits">
                <table className="orders-table">
                <thead>
                    <tr>
                    <th>{language === 'tr' ? 'Borsa' : 'Exchange'}</th>
                    <th>{language === 'tr' ? 'Toplam Max Poz.' : 'Total Max Open'}</th>
                    <th>{language === 'tr' ? 'Günlük Max Trade' : 'Max Daily Trade'}</th>
                    <th>{language === 'tr' ? 'Borsa Max Poz.' : 'Exchange Max Open'}</th>
                    <th>{language === 'tr' ? 'Açık Poz.' : 'Current Open'}</th>
                    <th>{language === 'tr' ? 'Kalan Slot' : 'Remaining Slots'}</th>
                    <th>{language === 'tr' ? 'Bugün Kullanılan' : 'Buy Used Today'}</th>
                    <th>{language === 'tr' ? 'Bugün Kalan' : 'Buy Remaining'}</th>
                    <th>{language === 'tr' ? 'Bütçe %' : 'Budget %'}</th>
                    <th>{language === 'tr' ? 'Bütçe Tutarı' : 'Budget Amount'}</th>
                    <th>{language === 'tr' ? 'Available Funds' : 'Available Funds'}</th>
                    <th>{language === 'tr' ? 'Planned Buy' : 'Planned Buy'}</th>
                    <th>{language === 'tr' ? 'Güncelleme' : 'Updated'}</th>
                    </tr>
                </thead>

                <tbody>
                    {(data?.buy_limits ?? []).map((row) => (
                    <tr key={row.exchange}>
                        <td>{row.exchange || '-'}</td>
                        <td>{formatNumber(row.total_max_open_positions, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.max_daily_trade_count, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.exchange_max_open_positions, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.current_open_position_count, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.remaining_open_position_slots, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.today_buy_count_used, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.today_buy_count_remaining, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.allocated_budget_pct, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.allocated_budget_amount, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.available_funds, language as 'tr' | 'en')}</td>
                        <td>{formatNumber(row.planned_buy_count, language as 'tr' | 'en')}</td>
                        <td>{formatDateTime(row.updated_at, language as 'tr' | 'en')}</td>
                    </tr>
                    ))}

                    {(data?.buy_limits ?? []).length === 0 && (
                    <tr>
                        <td colSpan={13} className="orders-empty-cell">
                        {language === 'tr' ? 'Veri yok.' : 'No data.'}
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
            </div>

          <div className="orders-table-card">
            <div className="orders-table-title">
              {language === 'tr'
                ? 'Açık Pozisyonlar ve Limit Durumu'
                : 'Open Positions and Limit Status'}
            </div>

            <div className="orders-table-wrap orders-table-wrap-positions">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>{language === 'tr' ? 'Borsa' : 'Exchange'}</th>
                    <th>{language === 'tr' ? 'Sembol' : 'Symbol'}</th>
                    <th>{language === 'tr' ? 'Para Birimi' : 'Currency'}</th>
                    <th>{language === 'tr' ? 'Açık mı' : 'Is Open'}</th>
                    <th>{language === 'tr' ? 'Giriş Tarihi' : 'Entry Date'}</th>
                    <th>{language === 'tr' ? 'Son Fiyat' : 'Last Price'}</th>
                    <th>{language === 'tr' ? 'Geçen Gün' : 'Holding Days Used'}</th>
                    <th>{language === 'tr' ? 'Kalan Gün' : 'Remaining Days'}</th>
                    <th>{language === 'tr' ? 'Adet' : 'Qty'}</th>
                    <th>{language === 'tr' ? 'Alış Ort.' : 'Avg Cost'}</th>
                    <th>{language === 'tr' ? 'Market Fiyatı' : 'Market Price'}</th>
                  </tr>
                </thead>

                <tbody>
                  {(data?.positions ?? []).map((row) => (
                    <tr key={`${row.exchange}-${row.symbol}-${row.ibkr_mode}`}>
                      <td>{row.exchange || '-'}</td>
                      <td>{row.symbol || '-'}</td>
                      <td>{row.currency || '-'}</td>
                      <td>{row.is_open === null ? '-' : row.is_open ? 'YES' : 'NO'}</td>
                      <td>{formatDate(row.entry_date, language as 'tr' | 'en')}</td>
                      <td>{formatNumber(row.last_price, language as 'tr' | 'en')}</td>
                      <td>{formatNumber(row.holding_days_used, language as 'tr' | 'en')}</td>
                      <td>{formatNumber(row.remaining_holding_days, language as 'tr' | 'en')}</td>
                      <td>{formatNumber(row.position_qty, language as 'tr' | 'en')}</td>
                      <td>{formatNumber(row.avg_cost, language as 'tr' | 'en')}</td>
                      <td>{formatNumber(row.market_price, language as 'tr' | 'en')}</td>
                    </tr>
                  ))}

                  {(data?.positions ?? []).length === 0 && (
                    <tr>
                      <td colSpan={11} className="orders-empty-cell">
                        {language === 'tr' ? 'Veri yok.' : 'No data.'}
                      </td>
                    </tr>
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