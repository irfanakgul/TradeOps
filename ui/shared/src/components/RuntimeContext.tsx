import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type RuntimeStatus = {
  server_status: 'running' | 'starting' | 'stopped'
  server_pid: number | null
  server_requested: boolean
  server_restart_count: number
  tws_status: 'running' | 'stopped'
  ibkr_mode: string
  app_timezone: string
  ibkr_port: string
  tws_path_exists: boolean
  main_path_exists: boolean
}

type RuntimeContextType = {
  status: RuntimeStatus
  logs: string[]
  refreshStatus: () => Promise<void>
  refreshLogs: () => Promise<void>
  startTws: () => Promise<RuntimeStatus>
  stopTws: () => Promise<RuntimeStatus>
  startServer: () => Promise<RuntimeStatus>
  stopServer: () => Promise<RuntimeStatus>
  stopAll: () => Promise<RuntimeStatus>
  runRuntimeTest: () => Promise<any>
  verifyLockPassword: (password: string) => Promise<boolean>
}

const defaultStatus: RuntimeStatus = {
  server_status: 'stopped',
  server_pid: null,
  server_requested: false,
  server_restart_count: 0,
  tws_status: 'stopped',
  ibkr_mode: 'UNKNOWN',
  app_timezone: '-',
  ibkr_port: '-',
  tws_path_exists: false,
  main_path_exists: false,
}

const RuntimeContext = createContext<RuntimeContextType | null>(null)

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options)
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(result?.detail?.message || result?.message || 'Request failed.')
  }

  return result
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RuntimeStatus>(defaultStatus)
  const [logs, setLogs] = useState<string[]>([])

  async function refreshStatus() {
    try {
      const result = await requestJson('http://127.0.0.1:8000/api/runtime/status')
      setStatus(result)
    } catch {
      // sessiz
    }
  }

  async function refreshLogs() {
    try {
      const result = await requestJson('http://127.0.0.1:8000/api/runtime/logs?limit=500')
      setLogs(result.logs || [])
    } catch {
      // sessiz
    }
  }

  async function startTws() {
    const result = await requestJson('http://127.0.0.1:8000/api/runtime/tws/start', {
      method: 'POST',
    })
    setStatus(result)
    await refreshLogs()
    return result
  }

  async function stopTws() {
    const result = await requestJson('http://127.0.0.1:8000/api/runtime/tws/stop', {
      method: 'POST',
    })
    setStatus(result)
    await refreshLogs()
    return result
  }

  async function startServer() {
    const result = await requestJson('http://127.0.0.1:8000/api/runtime/server/start', {
      method: 'POST',
    })
    setStatus(result)
    await refreshLogs()
    return result
  }

  async function stopServer() {
    const result = await requestJson('http://127.0.0.1:8000/api/runtime/server/stop', {
      method: 'POST',
    })
    setStatus(result)
    await refreshLogs()
    return result
  }

  async function stopAll() {
    const result = await requestJson('http://127.0.0.1:8000/api/runtime/stop-all', {
      method: 'POST',
    })
    setStatus(result)
    await refreshLogs()
    return result
  }

  async function runRuntimeTest() {
    const result = await requestJson('http://127.0.0.1:8000/api/runtime/test', {
      method: 'POST',
    })
    await refreshStatus()
    await refreshLogs()
    return result
  }

  async function verifyLockPassword(password: string) {
    const result = await requestJson('http://127.0.0.1:8000/api/runtime/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    return Boolean(result.success)
  }

  useEffect(() => {
    refreshStatus()
    refreshLogs()

    const interval = window.setInterval(() => {
      refreshStatus()
      refreshLogs()
    }, 2000)

    return () => window.clearInterval(interval)
  }, [])

  const value = useMemo(
    () => ({
      status,
      logs,
      refreshStatus,
      refreshLogs,
      startTws,
      stopTws,
      startServer,
      stopServer,
      stopAll,
      runRuntimeTest,
      verifyLockPassword,
    }),
    [status, logs],
  )

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}

export function useRuntime() {
  const context = useContext(RuntimeContext)
  if (!context) {
    throw new Error('useRuntime must be used within RuntimeProvider')
  }
  return context
}