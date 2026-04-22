import './AppSplash.css'
import introLogo from '../assets/intro_logo.svg'

export default function AppSplash() {
  return (
    <div className="app-splash">
      <div className="app-splash-card">
        <img src={introLogo} alt="TradeOPS" className="app-splash-logo" />

        <h1 className="app-splash-title">Welcome to TradeOPS</h1>
        <p className="app-splash-subtitle">
          Preparing your workspace...
        </p>

        <div className="app-splash-loader-wrap">
          <div className="app-splash-hourglass" />
          <div className="app-splash-loader-text">Loading secure desktop environment</div>
        </div>
      </div>
    </div>
  )
}