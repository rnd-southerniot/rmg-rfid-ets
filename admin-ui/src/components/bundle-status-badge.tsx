import { Badge } from '@/components/ui/badge'
import type { BundleStatus } from '@/lib/types'
import { BUNDLE_STATUS_LABELS } from '@/lib/constants'

const statusColors: Record<BundleStatus, string> = {
  created: 'bg-gray-100 text-gray-800 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  qc_pass: 'bg-green-100 text-green-800 border-green-200',
  qc_fail: 'bg-red-100 text-red-800 border-red-200',
  rework: 'bg-amber-100 text-amber-800 border-amber-200',
  packed: 'bg-purple-100 text-purple-800 border-purple-200',
}

export function BundleStatusBadge({ status }: { status: BundleStatus }) {
  return (
    <Badge variant="outline" className={statusColors[status]}>
      {BUNDLE_STATUS_LABELS[status]}
    </Badge>
  )
}
