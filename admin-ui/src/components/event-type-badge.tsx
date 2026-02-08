import { Badge } from '@/components/ui/badge'
import type { EventType } from '@/lib/types'

const eventColors: Record<EventType, string> = {
  COMPLETE: 'bg-blue-100 text-blue-800 border-blue-200',
  QC_PASS: 'bg-green-100 text-green-800 border-green-200',
  QC_FAIL: 'bg-red-100 text-red-800 border-red-200',
}

export function EventTypeBadge({ type }: { type: EventType }) {
  return (
    <Badge variant="outline" className={eventColors[type]}>
      {type.replace('_', ' ')}
    </Badge>
  )
}
