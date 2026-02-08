import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Radio, Package, Activity, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { useFactory } from '@/contexts/factory-context'
import { fetchStations, fetchBundles, fetchRecentEvents } from '@/lib/api'

export function DashboardPage() {
  const { token } = useAuth()
  const { selected } = useFactory()
  const factoryCode = selected?.code

  const { data: stations } = useQuery({
    queryKey: ['stations', factoryCode],
    queryFn: () => fetchStations(token!, factoryCode!),
    enabled: !!token && !!factoryCode,
  })

  const { data: bundles } = useQuery({
    queryKey: ['bundles', factoryCode, {}],
    queryFn: () => fetchBundles(token!, factoryCode!),
    enabled: !!token && !!factoryCode,
  })

  const { data: events } = useQuery({
    queryKey: ['recentEvents', factoryCode],
    queryFn: () => fetchRecentEvents(token!, factoryCode!, 10),
    enabled: !!token && !!factoryCode,
  })

  if (!factoryCode) {
    return <p className="text-muted-foreground">Select a factory to get started.</p>
  }

  const mapped = stations?.filter((s) => s.station_id) ?? []
  const unmapped = stations?.filter((s) => !s.station_id) ?? []
  const online = stations?.filter((s) => {
    if (!s.last_seen_at) return false
    return Date.now() - new Date(s.last_seen_at).getTime() < 5 * 60 * 1000
  }) ?? []

  const stats = [
    {
      label: 'Stations',
      value: stations?.length ?? 0,
      sub: `${mapped.length} mapped, ${online.length} online`,
      icon: Radio,
      to: '/stations' as const,
    },
    {
      label: 'Bundles',
      value: bundles?.length ?? 0,
      sub: `${bundles?.filter((b) => b.status === 'in_progress').length ?? 0} in progress`,
      icon: Package,
      to: '/bundles' as const,
    },
    {
      label: 'Recent Events',
      value: events?.length ?? 0,
      sub: 'Last 10 events',
      icon: Activity,
      to: '/events' as const,
    },
    {
      label: 'Lines',
      value: '-',
      sub: `Factory: ${selected?.name}`,
      icon: Settings,
      to: '/settings' as const,
    },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {events && events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(evt.ts).toLocaleTimeString()}
                    </span>
                    <span className="font-medium">{evt.event_type}</span>
                    <span className="text-muted-foreground">
                      {evt.rfid_uid} at {evt.station_id ?? evt.mac}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {evt.line_name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {unmapped.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">
              Unmapped Stations ({unmapped.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              These stations have claimed but need to be mapped to a line and type.
            </p>
            <div className="space-y-1">
              {unmapped.map((s) => (
                <div key={s.id} className="text-sm font-mono">
                  {s.mac}
                </div>
              ))}
            </div>
            <Link to="/stations" className="text-sm text-primary underline mt-2 block">
              Go to Stations to map them
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
