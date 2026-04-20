import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from './components/LanguageContext'
import { AuthProvider } from './components/AuthContext'
import { RuntimeProvider } from './components/RuntimeContext'
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import BrokerPage from './pages/BrokerPage'
import UserPanelPage from './pages/UserPanelPage'
import AdminPanelPage from './pages/AdminPanelPage'
import WalletOverviewPage from './pages/WalletOverviewPage'

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RuntimeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route
                path="/contact"
                element={
                  <div style={{ padding: 40, color: 'white' }}>
                    Contact form will come next.
                  </div>
                }
              />
              <Route path="/broker" element={<BrokerPage />} />
              <Route path="/user-panel" element={<UserPanelPage />} />
              <Route path="/admin-panel" element={<AdminPanelPage />} />
              <Route path="/wallet-overview" element={<WalletOverviewPage />} />
            </Routes>
          </BrowserRouter>
        </RuntimeProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App