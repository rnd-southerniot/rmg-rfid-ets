import { useEffect, useRef, useState, useCallback } from 'react'
import { eventStreamUrl } from '@/lib/api'
import type { Event } from '@/lib/types'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export function useEventStream(
  factoryCode: string | undefined,
  token: string | null,
  opts?: { maxEvents?: number },
) {
  const maxEvents = opts?.maxEvents ?? 200
  const [events, setEvents] = useState<Event[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const esRef = useRef<EventSource | null>(null)

  const clear = useCallback(() => setEvents([]), [])

  useEffect(() => {
    if (!factoryCode || !token) return

    const url = eventStreamUrl(factoryCode, token)
    const es = new EventSource(url)
    esRef.current = es

    setStatus('connecting')

    es.addEventListener('hello', () => {
      setStatus('connected')
    })

    es.addEventListener('event', (e) => {
      const parsed = JSON.parse(e.data) as Event
      setEvents((prev) => {
        const next = [parsed, ...prev]
        return next.length > maxEvents ? next.slice(0, maxEvents) : next
      })
    })

    es.addEventListener('ping', () => {
      // keep-alive, no action needed
    })

    es.onerror = () => {
      setStatus('disconnected')
    }

    return () => {
      es.close()
      esRef.current = null
      setStatus('disconnected')
    }
  }, [factoryCode, token, maxEvents])

  return { events, status, clear }
}
