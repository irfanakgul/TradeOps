import { useEffect, useState } from 'react'

type RuntimeStatus = {
  app_version?: string
}

export default function Footer() {
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    async function loadVersion() {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/runtime/status')
        const result: RuntimeStatus = await response.json()

        if (response.ok && result.app_version) {
          setAppVersion(result.app_version)
        }
      } catch {
        // sessiz geç
      }
    }

    loadVersion()
  }, [])

  return (
    <footer className="app-footer">
      <div className="app-footer-text">
        TradeOps - powered by IrfanA @2026 - All Rights Reserved
        {appVersion ? ` | v${appVersion}` : ''}
      </div>
    </footer>
  )
}