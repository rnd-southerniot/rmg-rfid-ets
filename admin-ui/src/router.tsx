import {
  createRouter,
  createRoute,
  createRootRoute,
  redirect,
  Outlet,
} from '@tanstack/react-router'
import { AppShell } from '@/components/layout/app-shell'
import { LoginPage } from '@/routes/login'
import { DashboardPage } from '@/routes/index'
import { StationsPage } from '@/routes/stations/index'
import { BundlesPage } from '@/routes/bundles/index'
import { BundleDetailPage } from '@/routes/bundles/detail'
import { BundleCreatePage } from '@/routes/bundles/create'
import { EventsPage } from '@/routes/events/index'
import { SettingsPage } from '@/routes/settings/index'

// Root route
const rootRoute = createRootRoute({
  component: Outlet,
})

// Login route (no shell)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

// Authenticated layout
const authLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  beforeLoad: () => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      throw redirect({ to: '/login' })
    }
  },
})

const indexRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/',
  component: DashboardPage,
})

const stationsRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/stations',
  component: StationsPage,
})

const bundlesRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/bundles',
  component: BundlesPage,
})

const bundleDetailRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/bundles/$bundleId',
  component: BundleDetailPage,
})

const bundleCreateRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/bundles/create',
  component: BundleCreatePage,
})

const eventsRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/events',
  component: EventsPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/settings',
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authLayout.addChildren([
    indexRoute,
    stationsRoute,
    bundlesRoute,
    bundleCreateRoute,
    bundleDetailRoute,
    eventsRoute,
    settingsRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
