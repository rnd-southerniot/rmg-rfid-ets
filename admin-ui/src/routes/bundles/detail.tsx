import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventTypeBadge } from '@/components/event-type-badge'
import { BundleStatusBadge } from '@/components/bundle-status-badge'
import { useAuth } from '@/contexts/auth-context'
import { useFactory } from '@/contexts/factory-context'
import { fetchBundleEvents, fetchBundles } from '@/lib/api'
import type { BundleStatus, EventType } from '@/lib/types'

export function BundleDetailPage() {
  const { bundleId } = useParams({ strict: false }) as { bundleId: string }
  const { token } = useAuth()
  const { selected } = useFactory()
  const factoryCode = selected?.code

  const { data: bundles } = useQuery({
    queryKey: ['bundles', factoryCode, {}],
    queryFn: () => fetchBundles(token!, factoryCode!),
    enabled: !!token && !!factoryCode,
  })

  const bundle = bundles?.find((b) => b.id === bundleId)

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['bundleEvents', bundleId],
    queryFn: () => fetchBundleEvents(token!, bundleId),
    enabled: !!token && !!bundleId,
  })

  return (
    <div>
      <Link to="/bundles">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bundles
        </Button>
      </Link>

      {bundle && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="font-mono">{bundle.rfid_uid}</span>
              <BundleStatusBadge status={bundle.status as BundleStatus} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Order</span>
                <span className="font-medium">{bundle.order_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Style</span>
                <span className="font-medium">{bundle.style}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Color / Size</span>
                <span className="font-medium">{bundle.color} / {bundle.size}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Qty</span>
                <span className="font-medium">{bundle.qty}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Current Station</span>
                <span className="font-medium">
                  {bundle.current_station_name ?? '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Current Line</span>
                <span className="font-medium">
                  {bundle.current_line_name ?? '-'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <h3 className="text-lg font-semibold mb-4">Event Timeline</h3>

      {isLoading ? (
        <p className="text-muted-foreground">Loading events...</p>
      ) : !eventsData || eventsData.events.length === 0 ? (
        <p className="text-muted-foreground">No events recorded for this bundle.</p>
      ) : (
        <div className="relative pl-6 border-l-2 border-border space-y-6">
          {eventsData.events.map((evt) => (
            <div key={evt.id} className="relative">
              <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-primary border-2 border-background" />
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <EventTypeBadge type={evt.event_type as EventType} />
                    <span className="text-sm font-medium">
                      {evt.station_name ?? evt.station_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({evt.station_type})
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {evt.line_name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(evt.ts).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
