import type { BundleStatus, EventType, StationType } from './types'

export const STATION_TYPES: StationType[] = ['cutting', 'sewing', 'finishing', 'qc']

export const BUNDLE_STATUSES: BundleStatus[] = [
  'created', 'in_progress', 'qc_pass', 'qc_fail', 'rework', 'packed',
]

export const EVENT_TYPES: EventType[] = ['COMPLETE', 'QC_PASS', 'QC_FAIL']

export const BUNDLE_STATUS_LABELS: Record<BundleStatus, string> = {
  created: 'Created',
  in_progress: 'In Progress',
  qc_pass: 'QC Pass',
  qc_fail: 'QC Fail',
  rework: 'Rework',
  packed: 'Packed',
}

export const STATION_TYPE_LABELS: Record<StationType, string> = {
  cutting: 'Cutting',
  sewing: 'Sewing',
  finishing: 'Finishing',
  qc: 'QC',
}
