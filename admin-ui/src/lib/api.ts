import type {
  Factory, Line, Station, Bundle, Event,
  BulkCreateResponse, RegisteredRfid,
} from './types'

class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, details?: unknown) {
    super(`API Error: ${code} (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function api<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
      ...options?.headers,
    },
  })

  const body = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? 'unknown', body.details)
  }

  return body
}

// Factories
export async function fetchFactories(token: string): Promise<Factory[]> {
  const data = await api<{ ok: boolean; factories: Factory[] }>(
    '/api/v1/admin/factories',
    token,
  )
  return data.factories
}

export async function createFactory(
  token: string,
  body: { code: string; name?: string },
): Promise<Factory> {
  const data = await api<{ ok: boolean; factory: Factory }>(
    '/api/v1/admin/factories',
    token,
    { method: 'POST', body: JSON.stringify(body) },
  )
  return data.factory
}

// Lines
export async function fetchLines(
  token: string,
  factoryCode: string,
): Promise<Line[]> {
  const data = await api<{ ok: boolean; lines: Line[] }>(
    `/api/v1/admin/lines?factory_code=${encodeURIComponent(factoryCode)}`,
    token,
  )
  return data.lines
}

export async function createLine(
  token: string,
  body: { factory_code: string; name: string },
): Promise<Line> {
  const data = await api<{ ok: boolean; line: Line }>(
    '/api/v1/admin/lines',
    token,
    { method: 'POST', body: JSON.stringify(body) },
  )
  return data.line
}

// Stations
export async function fetchStations(
  token: string,
  factoryCode: string,
): Promise<Station[]> {
  const data = await api<{ ok: boolean; stations: Station[] }>(
    `/api/v1/admin/stations?factory_code=${encodeURIComponent(factoryCode)}`,
    token,
  )
  return data.stations
}

export async function mapStation(
  token: string,
  stationPk: string,
  body: { station_id: string; line_id: string; type: string },
): Promise<Station> {
  const data = await api<{ ok: boolean; station: Station }>(
    `/api/v1/admin/stations/${encodeURIComponent(stationPk)}/map`,
    token,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
  return data.station
}

export async function unmapStation(
  token: string,
  stationPk: string,
): Promise<Station> {
  const data = await api<{ ok: boolean; station: Station }>(
    `/api/v1/admin/stations/${encodeURIComponent(stationPk)}/unmap`,
    token,
    { method: 'PATCH' },
  )
  return data.station
}

// Bundles
export async function fetchBundles(
  token: string,
  factoryCode: string,
  params?: {
    status?: string
    order_id?: string
    rfid_uid?: string
    limit?: number
    offset?: number
  },
): Promise<Bundle[]> {
  const qs = new URLSearchParams({ factory_code: factoryCode })
  if (params?.status) qs.set('status', params.status)
  if (params?.order_id) qs.set('order_id', params.order_id)
  if (params?.rfid_uid) qs.set('rfid_uid', params.rfid_uid)
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))

  const data = await api<{ ok: boolean; bundles: Bundle[] }>(
    `/api/v1/admin/bundles?${qs}`,
    token,
  )
  return data.bundles
}

export async function fetchBundleEvents(
  token: string,
  bundleId: string,
): Promise<{ bundle_id: string; events: Event[] }> {
  const data = await api<{ ok: boolean; bundle_id: string; events: Event[] }>(
    `/api/v1/admin/bundles/${encodeURIComponent(bundleId)}/events`,
    token,
  )
  return { bundle_id: data.bundle_id, events: data.events }
}

export async function createBundle(
  token: string,
  body: {
    factory_code: string
    order_id: string
    style: string
    color: string
    size: string
    qty?: number
    rfid_uid: string
  },
): Promise<{ bundle_id: string; rfid_uid: string }> {
  const res = await fetch('/api/v1/bundles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown', data.details)
  return data
}

export async function createBundlesBulk(
  token: string,
  bundles: Array<{
    factory_code: string
    order_id: string
    style: string
    color: string
    size: string
    qty?: number
    rfid_uid: string
  }>,
): Promise<BulkCreateResponse> {
  const res = await fetch('/api/v1/bundles/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify({ bundles }),
  })
  const data = await res.json()
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown', data.details)
  return data
}

// Events
export async function fetchRecentEvents(
  token: string,
  factoryCode: string,
  limit = 100,
): Promise<Event[]> {
  const data = await api<{ ok: boolean; events: Event[] }>(
    `/api/v1/admin/events/recent?factory_code=${encodeURIComponent(factoryCode)}&limit=${limit}`,
    token,
  )
  return data.events
}

export async function fetchRegisteredRfids(
  token: string,
  factoryCode: string,
  opts: { unboundOnly?: boolean } = {},
): Promise<RegisteredRfid[]> {
  const params = new URLSearchParams({ factory_code: factoryCode })
  if (opts.unboundOnly) params.set('unbound', 'true')
  const data = await api<{ ok: boolean; rfids: RegisteredRfid[] }>(
    `/api/v1/admin/rfids?${params.toString()}`,
    token,
  )
  return data.rfids
}

export function eventStreamUrl(
  factoryCode: string,
  token: string,
): string {
  return `/api/v1/admin/events/stream?factory_code=${encodeURIComponent(factoryCode)}&admin_token=${encodeURIComponent(token)}`
}

export { ApiError }
