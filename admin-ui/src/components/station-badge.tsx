import { Badge } from '@/components/ui/badge'
import type { Station } from '@/lib/types'
import { STATION_TYPE_LABELS } from '@/lib/constants'

export function StationTypeBadge({ type }: { type: Station['type'] }) {
  if (!type) return <Badge variant="outline">Unmapped</Badge>

  const colors: Record<string, string> = {
    cutting: 'bg-orange-100 text-orange-800 border-orange-200',
    sewing: 'bg-blue-100 text-blue-800 border-blue-200',
    finishing: 'bg-purple-100 text-purple-800 border-purple-200',
    qc: 'bg-green-100 text-green-800 border-green-200',
  }

  return (
    <Badge variant="outline" className={colors[type]}>
      {STATION_TYPE_LABELS[type]}
    </Badge>
  )
}

export function StationStatusBadge({ lastSeenAt }: { lastSeenAt: string | null }) {
  if (!lastSeenAt) return <Badge variant="outline">Never seen</Badge>

  const diff = Date.now() - new Date(lastSeenAt).getTime()
  const isOnline = diff < 5 * 60 * 1000 // 5 minutes

  return (
    <Badge variant={isOnline ? 'default' : 'secondary'} className={isOnline ? 'bg-green-600' : ''}>
      {isOnline ? 'Online' : 'Offline'}
    </Badge>
  )
}
