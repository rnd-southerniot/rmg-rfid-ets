import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StationTypeBadge, StationStatusBadge } from '@/components/station-badge'
import { useAuth } from '@/contexts/auth-context'
import { useFactory } from '@/contexts/factory-context'
import { fetchStations, fetchLines, mapStation, unmapStation } from '@/lib/api'
import { STATION_TYPES } from '@/lib/constants'
import type { Station, Line } from '@/lib/types'

export function StationsPage() {
  const { token } = useAuth()
  const { selected } = useFactory()
  const factoryCode = selected?.code
  const qc = useQueryClient()

  const [mapTarget, setMapTarget] = useState<Station | null>(null)
  const [unmapTarget, setUnmapTarget] = useState<Station | null>(null)

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ['stations', factoryCode],
    queryFn: () => fetchStations(token!, factoryCode!),
    enabled: !!token && !!factoryCode,
  })

  const { data: lines = [] } = useQuery({
    queryKey: ['lines', factoryCode],
    queryFn: () => fetchLines(token!, factoryCode!),
    enabled: !!token && !!factoryCode,
  })

  if (!factoryCode) {
    return <p className="text-muted-foreground">Select a factory first.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Stations</h2>
        <span className="text-sm text-muted-foreground">
          {stations.length} station{stations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading stations...</p>
      ) : stations.length === 0 ? (
        <p className="text-muted-foreground">
          No stations found. Stations appear here after claiming via the ESP32 firmware.
        </p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MAC Address</TableHead>
                <TableHead>Station ID</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>FW</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.map((station) => (
                <TableRow key={station.id}>
                  <TableCell className="font-mono text-sm">{station.mac}</TableCell>
                  <TableCell>{station.station_id ?? '-'}</TableCell>
                  <TableCell>{station.line_name ?? '-'}</TableCell>
                  <TableCell>
                    <StationTypeBadge type={station.type} />
                  </TableCell>
                  <TableCell>
                    <StationStatusBadge lastSeenAt={station.last_seen_at} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {station.fw ?? '-'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMapTarget(station)}
                    >
                      {station.station_id ? 'Remap' : 'Map'}
                    </Button>
                    {station.station_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUnmapTarget(station)}
                      >
                        Unmap
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {mapTarget && (
        <MapDialog
          station={mapTarget}
          lines={lines}
          token={token!}
          onClose={() => setMapTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['stations', factoryCode] })
            setMapTarget(null)
          }}
        />
      )}

      {unmapTarget && (
        <UnmapDialog
          station={unmapTarget}
          token={token!}
          onClose={() => setUnmapTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['stations', factoryCode] })
            setUnmapTarget(null)
          }}
        />
      )}
    </div>
  )
}

function MapDialog({
  station, lines, token, onClose, onSuccess,
}: {
  station: Station
  lines: Line[]
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [stationId, setStationId] = useState(station.station_id ?? '')
  const [lineId, setLineId] = useState(station.line_id ?? '')
  const [type, setType] = useState(station.type ?? '')

  const mutation = useMutation({
    mutationFn: () =>
      mapStation(token, station.id, {
        station_id: stationId,
        line_id: lineId,
        type,
      }),
    onSuccess: () => {
      toast.success(`Station ${stationId} mapped`)
      onSuccess()
    },
    onError: (err) => {
      toast.error(`Failed to map station: ${err.message}`)
    },
  })

  const isValid = stationId.trim() && lineId && type

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Map Station</DialogTitle>
          <DialogDescription>
            Assign a station ID, line, and type to {station.mac}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="station-id">Station ID</Label>
            <Input
              id="station-id"
              placeholder="e.g. ST-01"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
            />
          </div>

          <div>
            <Label>Line</Label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select line" />
              </SelectTrigger>
              <SelectContent>
                {lines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {STATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending ? 'Mapping...' : 'Map Station'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UnmapDialog({
  station, token, onClose, onSuccess,
}: {
  station: Station
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const mutation = useMutation({
    mutationFn: () => unmapStation(token, station.id),
    onSuccess: () => {
      toast.success(`Station ${station.station_id} unmapped`)
      onSuccess()
    },
    onError: (err) => {
      toast.error(`Failed to unmap: ${err.message}`)
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unmap Station</DialogTitle>
          <DialogDescription>
            Remove mapping for {station.station_id} ({station.mac})?
            This will clear the station ID, line, and type.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Unmapping...' : 'Unmap'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
