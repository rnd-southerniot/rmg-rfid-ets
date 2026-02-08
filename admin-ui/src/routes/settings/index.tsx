import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/contexts/auth-context'
import { useFactory } from '@/contexts/factory-context'
import { fetchFactories, createFactory, fetchLines, createLine } from '@/lib/api'

export function SettingsPage() {
  const { token } = useAuth()
  const { selected } = useFactory()

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Settings</h2>
      <FactoriesSection token={token!} />
      {selected && <LinesSection token={token!} factoryCode={selected.code} />}
    </div>
  )
}

function FactoriesSection({ token }: { token: string }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  const { data: factories = [] } = useQuery({
    queryKey: ['factories'],
    queryFn: () => fetchFactories(token),
  })

  const mutation = useMutation({
    mutationFn: () => createFactory(token, { code, name: name || undefined }),
    onSuccess: () => {
      toast.success('Factory created')
      qc.invalidateQueries({ queryKey: ['factories'] })
      setShowAdd(false)
      setCode('')
      setName('')
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Factories</CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Factory
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factories.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono">{f.code}</TableCell>
                  <TableCell>{f.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {f.id}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Factory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="FACTORY-01" />
            </div>
            <div>
              <Label>Name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Factory One" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={!code.trim() || mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function LinesSection({ token, factoryCode }: { token: string; factoryCode: string }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')

  const { data: lines = [] } = useQuery({
    queryKey: ['lines', factoryCode],
    queryFn: () => fetchLines(token, factoryCode),
  })

  const mutation = useMutation({
    mutationFn: () => createLine(token, { factory_code: factoryCode, name }),
    onSuccess: () => {
      toast.success('Line created')
      qc.invalidateQueries({ queryKey: ['lines', factoryCode] })
      setShowAdd(false)
      setName('')
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Lines ({factoryCode})
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Line
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">No lines yet.</p>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {l.id}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Line</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="L3" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
