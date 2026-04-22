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
                  <Route path="/admin-panel" element={<AdminPanelPage />} />

                  <Route path="/admin-panel" element={<AdminPanelPage />} />
                  <Route path="/admin-panel/users-details" element={<UsersDetailsPage />} />
                  <Route path="/admin-panel/contact-forms" element={<ContactFormsPage />} />
                  <Route path="/admin-panel/admin-params" element={<AdminParamsPage />} />
                  <Route path="/admin-panel/notification-sender" element={<NotificationSenderPage />} />
                  <Route path="/admin-panel/stats" element={<StatsPage />} />

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