export interface Factory {
  id: string
  code: string
  name: string
}

export interface Line {
  id: string
  factory_id: string
  name: string
}

export type StationType = 'cutting' | 'sewing' | 'finishing' | 'qc'

export interface Station {
  id: string
  mac: string
  station_id: string | null
  line_id: string | null
  line_name: string | null
  type: StationType | null
  fw: string | null
  capabilities: Record<string, unknown> | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export type BundleStatus = 'created' | 'in_progress' | 'qc_pass' | 'qc_fail' | 'rework' | 'packed'

export interface Bundle {
  id: string
  factory_id?: string
  order_id: string
  style: string
  color: string
  size: string
  qty: number
  line_route: string[] | null
  rfid_uid: string
  status: BundleStatus
  current_station_id: string | null
  current_line_id: string | null
  current_station_name?: string | null
  current_line_name?: string | null
  updated_at: string
}

export type EventType = 'COMPLETE' | 'QC_PASS' | 'QC_FAIL'

export interface Event {
  id: string
  event_id: string
  event_type: EventType
  ts: string
  created_at?: string
  bundle_id: string
  rfid_uid?: string
  order_id?: string
  station_pk?: string
  station_id: string
  station_name?: string
  station_type?: string
  mac?: string
  line_id?: string
  line_name: string | null
  meta?: Record<string, unknown> | null
}

export interface BulkCreateResult {
  index: number
  success: boolean
  bundle_id?: string
  error?: string
}

export interface RegisteredRfid {
  rfid_uid: string
  scan_count: number
  first_seen_at: string
  last_seen_at: string
  bundle_id: string | null
  bundle_order_id: string | null
  bundle_style: string | null
  bundle_color: string | null
  bundle_size: string | null
  bundle_status: BundleStatus | null
  last_station_code: string | null
  last_station_mac: string | null
}

export interface BulkCreateResponse {
  ok: boolean
  results: BulkCreateResult[]
  summary: {
    total: number
    succeeded: number
    failed: number
  }
}
