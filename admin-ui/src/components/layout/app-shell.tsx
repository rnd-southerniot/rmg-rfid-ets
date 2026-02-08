import { Link, useLocation } from '@tanstack/react-router'
import {
  Radio, Package, Activity, Settings, LogOut, ChevronDown, Factory,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { useFactory } from '@/contexts/factory-context'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/' as const, label: 'Dashboard', icon: Factory },
  { to: '/stations' as const, label: 'Stations', icon: Radio },
  { to: '/bundles' as const, label: 'Bundles', icon: Package },
  { to: '/events' as const, label: 'Live Events', icon: Activity },
  { to: '/settings' as const, label: 'Settings', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth()
  const { factories, selected, select } = useFactory()
  const location = useLocation()

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg">RMG RFID ETS</h1>
          <p className="text-xs text-muted-foreground">Admin Dashboard</p>
        </div>

        {/* Factory selector */}
        <div className="p-4 border-b">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Factory
          </label>
          <Select
            value={selected?.code ?? ''}
            onValueChange={(code) => {
              const f = factories.find((fac) => fac.code === code)
              if (f) select(f)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select factory" />
              <ChevronDown className="h-4 w-4 opacity-50" />
            </SelectTrigger>
            <SelectContent>
              {factories.map((f) => (
                <SelectItem key={f.code} value={f.code}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to)
            return (
              <Link key={item.to} to={item.to}>
                <span
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
