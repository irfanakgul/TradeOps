import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

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