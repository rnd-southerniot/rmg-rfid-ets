import { useRef, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EventTypeBadge } from '@/components/event-type-badge'
import { useAuth } from '@/contexts/auth-context'
import { useFactory } from '@/contexts/factory-context'
import { useEventStream } from '@/hooks/use-event-stream'
import { fetchRecentEvents } from '@/lib/api'
import type { Event, EventType } from '@/lib/types'

export function EventsPage() {
  const { token } = useAuth()
  const { selected } = useFactory()
  const factoryCode = selected?.code

  if (!factoryCode) {
    return <p className="text-muted-foreground">Select a factory first.</p>
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Events</h2>
      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">Live Feed</TabsTrigger>
          <TabsTrigger value="recent">Recent Events</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <LiveFeed factoryCode={factoryCode} token={token!} />
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <RecentEventsTable factoryCode={factoryCode} token={token!} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LiveFeed({ factoryCode, token }: { factoryCode: string; token: string }) {
  const { events, status, clear } = useEventStream(factoryCode, token)
  const feedRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0
    }
  }, [events, autoScroll])

  const statusColor = {
    connecting: 'bg-yellow-500',
    connected: 'bg-green-500',
    disconnected: 'bg-red-500',
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Live Feed
            <span className={`inline-block w-2 h-2 rounded-full ${statusColor[status]}`} />
            <span className="text-sm font-normal text-muted-foreground capitalize">
              {status}
            </span>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
            >
              Auto-scroll: {autoScroll ? 'On' : 'Off'}
            </Button>
            <Button variant="outline" size="sm" onClick={clear}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            Waiting for events...
          </p>
        ) : (
          <div ref={feedRef} className="max-h-[600px] overflow-auto space-y-2">
            {events.map((evt) => (
              <EventRow key={evt.id} event={evt} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RecentEventsTable({ factoryCode, token }: { factoryCode: string; token: string }) {
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['recentEvents', factoryCode],
    queryFn: () => fetchRecentEvents(token, factoryCode, 200),
    enabled: !!token && !!factoryCode,
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Events</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground">No events found.</p>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>RFID UID</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Line</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell className="font-mono text-xs">
                      {new Date(evt.ts).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <EventTypeBadge type={evt.event_type as EventType} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{evt.rfid_uid}</TableCell>
                    <TableCell>{evt.order_id}</TableCell>
                    <TableCell>{evt.station_id ?? evt.mac}</TableCell>
                    <TableCell>{evt.line_name ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EventRow({ event }: { event: Event }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded border bg-card text-sm">
      <span className="font-mono text-xs text-muted-foreground min-w-[80px]">
        {new Date(event.ts).toLocaleTimeString()}
      </span>
      <EventTypeBadge type={event.event_type as EventType} />
      <span className="font-mono text-xs">{event.rfid_uid}</span>
      <span className="text-muted-foreground">at</span>
      <span className="font-medium">{event.station_id ?? event.mac}</span>
      {event.line_name && (
        <Badge variant="outline" className="ml-auto">
          {event.line_name}
        </Badge>
      )}
    </div>
  )
}
