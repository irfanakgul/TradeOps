import type { ReactNode } from 'react'
import AppHeader from './AppHeader'
import Footer from './Footer'
import BrokerSidebar from './BrokerSidebar'
import AdminSubnav from './AdminSubnav'
import { useRuntime } from './RuntimeContext'
import { useLanguage } from './LanguageContext'

export default function AdminPanelLayout({
  children,
}: {
  children: ReactNode
}) {
  const { language } = useLanguage()
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

  async function handleExit() {
    try {
      await stopAll()
    } catch {
      //
    }
  }

  async function runAction(action: () => Promise<any>) {
    await action()
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="broker-layout">
        <BrokerSidebar
          activeItem="broker"
          controlsBusy={false}
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

        <section className="broker-main admin-main-area">
          <AdminSubnav />

          <div className="admin-content-shell">
            {children}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}