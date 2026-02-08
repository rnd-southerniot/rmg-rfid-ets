import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { useFactory } from '@/contexts/factory-context'
import { createBundle, createBundlesBulk } from '@/lib/api'
import type { BulkCreateResponse } from '@/lib/types'

export function BundleCreatePage() {
  const { token } = useAuth()
  const { selected } = useFactory()

  return (
    <div>
      <Link to="/bundles">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bundles
        </Button>
      </Link>

      <h2 className="text-2xl font-bold mb-6">Create Bundles</h2>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="bulk">Bulk</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4">
          <SingleCreateForm token={token!} factoryCode={selected?.code ?? ''} />
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <BulkCreateForm token={token!} factoryCode={selected?.code ?? ''} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SingleCreateForm({
  token, factoryCode,
}: { token: string; factoryCode: string }) {
  const [form, setForm] = useState({
    order_id: '',
    style: '',
    color: '',
    size: '',
    qty: '10',
    rfid_uid: '',
  })

  const mutation = useMutation({
    mutationFn: () =>
      createBundle(token, {
        factory_code: factoryCode,
        order_id: form.order_id,
        style: form.style,
        color: form.color,
        size: form.size,
        qty: parseInt(form.qty, 10),
        rfid_uid: form.rfid_uid,
      }),
    onSuccess: (data) => {
      toast.success(`Bundle created: ${data.rfid_uid}`)
      setForm({ order_id: '', style: '', color: '', size: '', qty: '10', rfid_uid: '' })
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`)
    },
  })

  const isValid = form.order_id && form.style && form.color && form.size && form.rfid_uid

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Order ID</Label>
            <Input
              value={form.order_id}
              onChange={(e) => setForm({ ...form, order_id: e.target.value })}
              placeholder="PO-12345"
            />
          </div>
          <div>
            <Label>RFID UID</Label>
            <Input
              value={form.rfid_uid}
              onChange={(e) => setForm({ ...form, rfid_uid: e.target.value })}
              placeholder="Tag UID"
            />
          </div>
          <div>
            <Label>Style</Label>
            <Input
              value={form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
              placeholder="T-SHIRT-BASIC"
            />
          </div>
          <div>
            <Label>Color</Label>
            <Input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="BLUE"
            />
          </div>
          <div>
            <Label>Size</Label>
            <Input
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
              placeholder="L"
            />
          </div>
          <div>
            <Label>Qty</Label>
            <Input
              type="number"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              min={1}
            />
          </div>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!isValid || mutation.isPending}
        >
          {mutation.isPending ? 'Creating...' : 'Create Bundle'}
        </Button>
      </CardContent>
    </Card>
  )
}

function BulkCreateForm({
  token, factoryCode,
}: { token: string; factoryCode: string }) {
  const [json, setJson] = useState('')
  const [parseError, setParseError] = useState('')
  const [result, setResult] = useState<BulkCreateResponse | null>(null)

  const parsed = (() => {
    if (!json.trim()) return null
    try {
      const arr = JSON.parse(json)
      if (!Array.isArray(arr)) return null
      setParseError('')
      return arr as Array<{
        order_id: string; style: string; color: string
        size: string; qty?: number; rfid_uid: string
      }>
    } catch {
      setParseError('Invalid JSON. Expected an array of bundle objects.')
      return null
    }
  })()

  const mutation = useMutation({
    mutationFn: () =>
      createBundlesBulk(
        token,
        parsed!.map((b) => ({ ...b, factory_code: factoryCode })),
      ),
    onSuccess: (data) => {
      setResult(data)
      toast.success(`${data.summary.succeeded}/${data.summary.total} bundles created`)
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bulk Create</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Paste JSON array of bundles</Label>
          <Textarea
            rows={8}
            className="font-mono text-sm"
            placeholder={`[
  { "order_id": "PO-001", "style": "TEE", "color": "RED", "size": "M", "qty": 10, "rfid_uid": "TAG001" },
  { "order_id": "PO-001", "style": "TEE", "color": "RED", "size": "L", "qty": 10, "rfid_uid": "TAG002" }
]`}
            value={json}
            onChange={(e) => { setJson(e.target.value); setResult(null) }}
          />
          {parseError && (
            <p className="text-sm text-destructive mt-1">{parseError}</p>
          )}
        </div>

        {parsed && !result && (
          <>
            <p className="text-sm text-muted-foreground">
              {parsed.length} bundle{parsed.length !== 1 ? 's' : ''} to create
            </p>
            <div className="border rounded-lg max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>RFID UID</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{b.rfid_uid}</TableCell>
                      <TableCell>{b.order_id}</TableCell>
                      <TableCell>{b.style}</TableCell>
                      <TableCell>{b.color}</TableCell>
                      <TableCell>{b.size}</TableCell>
                      <TableCell>{b.qty ?? 10}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Creating...' : `Create ${parsed.length} Bundles`}
            </Button>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <Badge variant="default">
                {result.summary.succeeded} succeeded
              </Badge>
              {result.summary.failed > 0 && (
                <Badge variant="destructive">
                  {result.summary.failed} failed
                </Badge>
              )}
            </div>
            <div className="border rounded-lg max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bundle ID / Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.results.map((r) => (
                    <TableRow key={r.index}>
                      <TableCell>{r.index + 1}</TableCell>
                      <TableCell>
                        <Badge variant={r.success ? 'default' : 'destructive'}>
                          {r.success ? 'OK' : 'Error'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {r.success ? r.bundle_id : r.error}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" onClick={() => { setJson(''); setResult(null) }}>
              Create More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
