import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
  } from 'react'
  import { useAuth } from './AuthContext'
  
  type SelectedUserContextType = {
    availableUsers: string[]
    selectedUsername: string
    setSelectedUsername: (username: string) => void
    canSelectAll: boolean
    refreshUsers: () => Promise<void>
  }
  
  const SelectedUserContext = createContext<SelectedUserContextType | null>(null)
  
  export function SelectedUserProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [availableUsers, setAvailableUsers] = useState<string[]>([])
    const [selectedUsername, setSelectedUsernameState] = useState('')
    const [canSelectAll, setCanSelectAll] = useState(false)
  
    async function refreshUsers() {
      if (!user?.username || !user?.userType) return
  
      const params = new URLSearchParams({
        requesting_username: user.username,
        requesting_user_type: user.userType,
      })
  
      const response = await fetch(`http://127.0.0.1:8000/api/ui/users?${params.toString()}`)
      const result = await response.json()
  
      if (!response.ok) {
        throw new Error(result?.detail?.message || 'User list failed.')
      }
  
      setAvailableUsers(result.users || [])
      setCanSelectAll(Boolean(result.can_select_all))
  
      setSelectedUsernameState((prev) => {
        if (prev && (result.users || []).includes(prev)) return prev
        return result.selected_username || user.username
      })
    }
  
    useEffect(() => {
      if (!user?.username) return
  
      refreshUsers().catch(() => {
        setAvailableUsers([user.username])
        setSelectedUsernameState(user.username)
        setCanSelectAll(false)
      })
    }, [user?.username, user?.userType])
  
    function setSelectedUsername(username: string) {
      setSelectedUsernameState(username)
    }
  
    const value = useMemo(
      () => ({
        availableUsers,
        selectedUsername,
        setSelectedUsername,
        canSelectAll,
        refreshUsers,
      }),
      [availableUsers, selectedUsername, canSelectAll],
    )
  
    return (
      <SelectedUserContext.Provider value={value}>
        {children}
      </SelectedUserContext.Provider>
    )
  }
  
  export function useSelectedUser() {
    const context = useContext(SelectedUserContext)
    if (!context) {
      throw new Error('useSelectedUser must be used within SelectedUserProvider')
    }
    return context
  }