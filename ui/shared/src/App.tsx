import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './components/LanguageContext'
import { AuthProvider } from './components/AuthContext'
import { RuntimeProvider } from './components/RuntimeContext'
import { SelectedUserProvider } from './components/SelectedUserContext'
import { AppLockProvider } from './components/AppLockContext'
import AppLockOverlay from './components/AppLockOverlay'
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import BrokerPage from './pages/BrokerPage'
import UserPanelPage from './pages/UserPanelPage'
import AdminPanelPage from './pages/AdminPanelPage'
import WalletOverviewPage from './pages/WalletOverviewPage'
import OrdersPage from './pages/OrdersPage'
import TradeConfigurationsPage from './pages/TradeConfigurationsPage'
import ContactPage from './pages/ContactPage'

import SubscriptionsPage from './pages/SubscriptionsPage'
import SimulationsPage from './pages/SimulationsPage'
import AboutPage from './pages/AboutPage'
import FocusCompaniesPage from './pages/FocusCompaniesPage'


function App() {
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
                  <Route path="/admin-panel" element={<AdminPanelPage />} />
                  <Route path="/wallet-overview" element={<WalletOverviewPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/trade-configurations" element={<TradeConfigurationsPage />} />
                  <Route path="/subscriptions" element={<SubscriptionsPage />} />
                  <Route path="/simulations" element={<SimulationsPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/focus-companies" element={<FocusCompaniesPage />} />
                </Routes>
              </BrowserRouter>
            </AppLockProvider>
          </SelectedUserProvider>
        </RuntimeProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App