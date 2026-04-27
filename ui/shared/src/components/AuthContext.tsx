import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AuthUser = {
  username: string
  email: string
  userType: 'CLIENT' | 'ADMIN'
  deviceId: string
}

type AuthContextType = {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null)

  // After an in-app update, the previous session is restored from a one-shot
  // file written before the helper script took over.
  useEffect(() => {
    let cancelled = false
    async function consumePending() {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/session/consume-pending-login')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data?.user && typeof data.user === 'object') {
          setUserState(data.user as AuthUser)
        }
      } catch {
        // backend not reachable yet — fine, splash screen waits
      }
    }
    consumePending()
    return () => {
      cancelled = true
    }
  }, [])

  function setUser(nextUser: AuthUser | null) {
    setUserState(nextUser)
  }

  const value = useMemo(
    () => ({
      user,
      setUser,
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
