import {
    createContext,
    useContext,
    useMemo,
    useState,
    type ReactNode,
  } from 'react'
  import { useAuth } from './AuthContext'
  
  type AppLockContextType = {
    isLocked: boolean
    lockApp: () => void
    unlockApp: (password: string) => Promise<boolean>
  }
  
  const AppLockContext = createContext<AppLockContextType | null>(null)
  
  export function AppLockProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [isLocked, setIsLocked] = useState(false)
  
    function lockApp() {
      setIsLocked(true)
    }
  
    async function unlockApp(password: string): Promise<boolean> {
      if (!user?.username) return false
  
      const response = await fetch('http://127.0.0.1:8000/api/runtime/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          password,
        }),
      })
  
      const result = await response.json()
  
      if (!response.ok) {
        return false
      }
  
      if (result.success) {
        setIsLocked(false)
        return true
      }
  
      return false
    }
  
    const value = useMemo(
      () => ({
        isLocked,
        lockApp,
        unlockApp,
      }),
      [isLocked],
    )
  
    return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
  }
  
  export function useAppLock() {
    const context = useContext(AppLockContext)
    if (!context) {
      throw new Error('useAppLock must be used within AppLockProvider')
    }
    return context
  }