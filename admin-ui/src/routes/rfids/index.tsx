import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/contexts/auth-context'
import { useFactory } from '@/contexts/factory-context'
import { fetchRegisteredRfids } from '@/lib/api'
import type { RegisteredRfid } from '@/lib/types'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function bundleLabel(r: RegisteredRfid): string {
  if (!r.bundle_id) return ''
  const parts = [r.bundle_order_id, r.bundle_style, r.bundle_color, r.bundle_size]
    .filter(Boolean)
  return parts.join(' / ')
}

export function RfidsPage() {
  const { token } = useAuth()
  const { selected } = useFactory()
  const factoryCode = selected?.code

  const [unboundOnly, setUnboundOnly] = useState(false)

  const { data: rfids = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['rfids', factoryCode, unboundOnly],
    queryFn: () => fetchRegisteredRfids(token!, factoryCode!, { unboundOnly }),
    enabled: !!token && !!factoryCode,
    refetchInterval: 5000,
  })

  if (!factoryCode) {
    return <p className="text-muted-foreground">Select a factory first.</p>
  }

  const totalCount = rfids.length
  const unboundCount = rfids.filter((r) => !r.bundle_id).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Registered RFIDs</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {totalCount} total{!unboundOnly && `, ${unboundCount} unbound`}
          </span>
          <Button
            variant={unboundOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUnboundOnly((v) => !v)}
          >
            {unboundOnly ? 'Showing unbound only' : 'Show unbound only'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Every RFID tap that does not match an existing bundle is recorded here.
        Bind a registered UID to a new bundle from the Create Bundle page.
      </p>

      {isLoading ? (
        <p className="text-muted-foreground">Loading RFIDs...</p>
      ) : rfids.length === 0 ? (
        <p className="text-muted-foreground">
          No RFIDs registered yet. Tap an unbound tag at any station to register it.
        </p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RFID UID</TableHead>
                <TableHead className="text-right">Scans</TableHead>
                <TableHead>First Seen</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Last Station</TableHead>
                <TableHead>Bundle</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rfids.map((r) => (
                <TableRow key={r.rfid_uid}>
                  <TableCell className="font-mono">{r.rfid_uid}</TableCell>
                  <TableCell className="text-right">{r.scan_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(r.first_seen_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(r.last_seen_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.last_station_code ?? (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.bundle_id ? (
                      bundleLabel(r) || r.bundle_id
                    ) : (
                      <span className="text-muted-foreground">unbound</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.bundle_id ? (
                      <Badge variant="default">Bound</Badge>
                    ) : (
                      <Badge variant="outline">Unbound</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
