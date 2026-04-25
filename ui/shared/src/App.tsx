import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { LanguageProvider } from './components/LanguageContext'
import { AuthProvider } from './components/AuthContext'
import { RuntimeProvider } from './components/RuntimeContext'
import { SelectedUserProvider } from './components/SelectedUserContext'
import { AppLockProvider } from './components/AppLockContext'

import AppLockOverlay from './components/AppLockOverlay'
import NotificationPopupGate from './components/NotificationPopupGate'
import AppSplash from './components/AppSplash'

// Pages
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import BrokerPage from './pages/BrokerPage'
import UserPanelPage from './pages/UserPanelPage'
import WalletOverviewPage from './pages/WalletOverviewPage'
import OrdersPage from './pages/OrdersPage'
import TradeConfigurationsPage from './pages/TradeConfigurationsPage'
import ContactPage from './pages/ContactPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import SimulationsPage from './pages/SimulationsPage'
import AboutPage from './pages/AboutPage'
import FocusCompaniesPage from './pages/FocusCompaniesPage'
import AdminPanelPage from './pages/AdminPanelPage'
import UsersDetailsPage from './pages/admin/UsersDetailsPage'
import ContactFormsPage from './pages/admin/ContactFormsPage'
import AdminParamsPage from './pages/admin/AdminParamsPage'
import NotificationSenderPage from './pages/admin/NotificationSenderPage'
import StatsPage from './pages/admin/StatsPage'
import NotificationsPage from './pages/NotificationsPage'
import SimulatorWalletOverviewPage from './pages/SimulatorWalletOverviewPage'
import SimulatorParametersPage from './pages/SimulatorParametersPage'
import SimulatorBuysPage from './pages/SimulatorBuysPage'
import SimulatorTradeLogsPage from './pages/SimulatorTradeLogsPage'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    let isMounted = true

    // minimum splash süresi
    const minDelay = new Promise((resolve) => setTimeout(resolve, 4500))

    // backend hazır mı kontrol
    const backendReady = (async () => {
      const start = Date.now()

      while (Date.now() - start < 10000) {
        try {
          const res = await fetch('http://127.0.0.1:8000/api/runtime/status')
          if (res.ok) return
        } catch {
          // beklemeye devam
        }

        await new Promise((r) => setTimeout(r, 400))
      }
    })()

    Promise.allSettled([minDelay, backendReady]).then(() => {
      if (isMounted) {
        setShowSplash(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  // 🔥 Splash burada devreye giriyor
  if (showSplash) {
    return <AppSplash />
  }

  return (
    <LanguageProvider>
      <AuthProvider>
        <RuntimeProvider>
          <SelectedUserProvider>
            <AppLockProvider>
              <BrowserRouter>
                <AppLockOverlay />

                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/broker" element={<BrokerPage />} />
                  <Route path="/user-panel" element={<UserPanelPage />} />
                  <Route path="/wallet-overview" element={<WalletOverviewPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/trade-configurations" element={<TradeConfigurationsPage />} />
                  <Route path="/subscriptions" element={<SubscriptionsPage />} />
                  <Route path="/simulations" element={<SimulationsPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/focus-companies" element={<FocusCompaniesPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />

                  {/* Admin */}
                  <Route path="/admin-panel" element={<AdminPanelPage />} />
                  <Route path="/admin-panel/users-details" element={<UsersDetailsPage />} />
                  <Route path="/admin-panel/contact-forms" element={<ContactFormsPage />} />
                  <Route path="/admin-panel/admin-params" element={<AdminParamsPage />} />
                  <Route path="/admin-panel/notification-sender" element={<NotificationSenderPage />} />
                  <Route path="/admin-panel/stats" element={<StatsPage />} />
                  <Route
                    path="/simulator/wallet-overview"
                    element={<SimulatorWalletOverviewPage />}
                  />
                  <Route path="/simulator/parameters" element={<SimulatorParametersPage />} />
                  <Route path="/simulator/buys" element={<SimulatorBuysPage />} />
                  <Route path="/simulator/trade-logs" element={<SimulatorTradeLogsPage />} />

                </Routes>

                <NotificationPopupGate />
              </BrowserRouter>
            </AppLockProvider>
          </SelectedUserProvider>
        </RuntimeProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App