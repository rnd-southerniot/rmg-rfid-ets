import {
  createContext, useCallback, useContext, useState, useEffect,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchFactories } from '@/lib/api'
import { useAuth } from './auth-context'
import type { Factory } from '@/lib/types'

interface FactoryContextValue {
  factories: Factory[]
  isLoading: boolean
  selected: Factory | null
  select: (factory: Factory) => void
}

const FactoryContext = createContext<FactoryContextValue | null>(null)

const STORAGE_KEY = 'selected_factory_code'

export function FactoryProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()

  const { data: factories = [], isLoading } = useQuery({
    queryKey: ['factories'],
    queryFn: () => fetchFactories(token!),
    enabled: !!token,
  })

  const [selected, setSelected] = useState<Factory | null>(null)

  // Restore selection from localStorage or auto-select first factory
  useEffect(() => {
    if (factories.length === 0) return
    const savedCode = localStorage.getItem(STORAGE_KEY)
    const match = factories.find((f) => f.code === savedCode)
    if (match) {
      setSelected(match)
    } else {
      setSelected(factories[0])
      localStorage.setItem(STORAGE_KEY, factories[0].code)
    }
  }, [factories])

  const select = useCallback((factory: Factory) => {
    setSelected(factory)
    localStorage.setItem(STORAGE_KEY, factory.code)
  }, [])

  return (
    <FactoryContext.Provider value={{ factories, isLoading, selected, select }}>
      {children}
    </FactoryContext.Provider>
  )
}

export function useFactory() {
  const ctx = useContext(FactoryContext)
  if (!ctx) throw new Error('useFactory must be used within FactoryProvider')
  return ctx
}
