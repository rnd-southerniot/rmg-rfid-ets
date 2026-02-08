import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { BundleStatusBadge } from '@/components/bundle-status-badge'
import { useAuth } from '@/contexts/auth-context'
import { useFactory } from '@/contexts/factory-context'
import { fetchBundles } from '@/lib/api'
import { BUNDLE_STATUSES, BUNDLE_STATUS_LABELS } from '@/lib/constants'

const PAGE_SIZE = 50

export function BundlesPage() {
  const { token } = useAuth()
  const { selected } = useFactory()
  const factoryCode = selected?.code

  const [status, setStatus] = useState<string>('all')
  const [orderId, setOrderId] = useState('')
  const [rfidUid, setRfidUid] = useState('')
  const [offset, setOffset] = useState(0)

  const filters = {
    status: status === 'all' ? undefined : status,
    order_id: orderId || undefined,
    rfid_uid: rfidUid || undefined,
    limit: PAGE_SIZE,
    offset,
  }

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ['bundles', factoryCode, filters],
    queryFn: () => fetchBundles(token!, factoryCode!, filters),
    enabled: !!token && !!factoryCode,
  })

  if (!factoryCode) {
    return <p className="text-muted-foreground">Select a factory first.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Bundles</h2>
        <Link to="/bundles/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Bundle
          </Button>
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Select value={status} onValueChange={(v) => { setStatus(v); setOffset(0) }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {BUNDLE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {BUNDLE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Order ID"
          value={orderId}
          onChange={(e) => { setOrderId(e.target.value); setOffset(0) }}
          className="w-40"
        />
        <Input
          placeholder="RFID UID"
          value={rfidUid}
          onChange={(e) => { setRfidUid(e.target.value); setOffset(0) }}
          className="w-40"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading bundles...</p>
      ) : bundles.length === 0 ? (
        <p className="text-muted-foreground">No bundles found.</p>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFID UID</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Station</TableHead>
                  <TableHead>Line</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundles.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link
                        to="/bundles/$bundleId"
                        params={{ bundleId: b.id }}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {b.rfid_uid}
                      </Link>
                    </TableCell>
                    <TableCell>{b.order_id}</TableCell>
                    <TableCell>{b.style}</TableCell>
                    <TableCell>{b.color}</TableCell>
                    <TableCell>{b.size}</TableCell>
                    <TableCell>{b.qty}</TableCell>
                    <TableCell>
                      <BundleStatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.current_station_name ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.current_line_name ?? '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              Showing {offset + 1}–{offset + bundles.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bundles.length < PAGE_SIZE}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
