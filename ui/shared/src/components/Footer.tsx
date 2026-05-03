import { APP_VERSION } from './AppVersion'

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-text">
        TradeOps - powered by IrfanA @2026 - All Rights Reserved | v{APP_VERSION}
      </div>
    </footer>
  )
}
