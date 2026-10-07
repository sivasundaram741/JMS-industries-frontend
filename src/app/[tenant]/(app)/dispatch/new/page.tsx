'use client';
// New shipment: pick a released customer order, choose how much of each line to ship from FG Store, add the
// transporter and vehicle, and create the pick list.
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useTenantHref } from '@/lib/hooks';
import { date, num, todayIso } from '@/lib/format';
import { Alert, Badge, Button, Card, DataTable, EmptyState, Loading, PageHeader, SelectField, TextField, Two, useToast } from '@/components/ui';

interface ReadyLine { id: number; itemCode: string; itemName: string; uom: string; qty: number; qtyDispatched: number; qtyPending: number; qtyOpen: number; fgStock: number }
interface ReadyOrder { id: number; number: string; promisedDate: string | null; customerName: string; lines: ReadyLine[] }

const defaultQty = (l: ReadyLine) => String(Math.max(0, Math.min(l.qtyOpen, l.fgStock)));

export default function NewShipmentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const toast = useToast();
  const sp = useSearchParams();
  const wanted = sp.get('so') || '';
  const { data: ready, error } = useApi<ReadyOrder[]>('/shipments/ready');
  const [soId, setSoId] = useState('');
  const [qty, setQty] = useState<Record<number, string>>({});
  const [f, setF] = useState({ transporter: '', vehicleNo: '', plannedDate: todayIso() });
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  // Preselect ?so= once the ready list arrives
  useEffect(() => {
    if (ready && !soId && wanted && ready.some((o) => String(o.id) === wanted)) setSoId(wanted);
  }, [ready, wanted, soId]);

  const order = useMemo(() => ready?.find((o) => String(o.id) === soId) || null, [ready, soId]);
  useEffect(() => {
    setQty(order ? Object.fromEntries(order.lines.map((l) => [l.id, defaultQty(l)])) : {});
  }, [order]);

  const problems = (l: ReadyLine) => {
    const q = Number(qty[l.id] || 0);
    if (q < 0) return 'Cannot be negative';
    if (q > l.qtyOpen) return `Only ${num(l.qtyOpen)} left to ship`;
    if (q > l.fgStock) return `Only ${num(l.fgStock)} in FG Store`;
    return null;
  };
  const chosen = order ? order.lines.filter((l) => Number(qty[l.id] || 0) > 0) : [];
  const hasQtyErrors = !!order && order.lines.some((l) => problems(l));
  const totalQty = chosen.reduce((a, l) => a + Number(qty[l.id] || 0), 0);

  const validationMsg = tried && (!order ? 'Select a customer order to continue.'
    : !chosen.length ? 'Set a quantity for at least one line to continue.'
    : hasQtyErrors ? 'Fix the quantity errors on the lines above.'
    : null);

  async function save() {
    setTried(true);
    if (!order || !chosen.length || hasQtyErrors) return;
    setBusy(true);
    try {
      const sh = await post('/shipments', {
        salesOrderId: order.id, transporter: f.transporter || undefined, vehicleNo: f.vehicleNo || undefined, plannedDate: f.plannedDate || undefined,
        lines: chosen.map((l) => ({ soLineId: l.id, qty: Number(qty[l.id]) })),
      });
      toast.ok(`${sh.number} created · pick list ready`);
      router.push(tenantHref(`/dispatch/${sh.id}`));
    } catch (e) { toast.err(e); setBusy(false); }
  }

  const missing = ready && wanted && !ready.some((o) => String(o.id) === wanted);

  return (
    <>
      <PageHeader
        back="/dispatch"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Dispatch' }, { label: 'Dispatch & Delivery', href: '/dispatch' }, { label: 'New shipment' }]}
        title="New shipment"
        sub="Ship finished stock against a customer order · stock leaves FG Store at the delivery challan"
        actions={<><Button onClick={() => router.push(tenantHref('/dispatch'))}>Cancel</Button><Button variant="primary" icon={Save} loading={busy} onClick={save}>Create shipment</Button></>}
      />
      {error ? <Alert tone="danger" title="Could not load orders ready to ship">{error.message}</Alert> : null}
      {missing ? <Alert tone="warning" title="That order has nothing left to ship">It may be fully shipped already, or not released to production yet. Pick another order below.</Alert> : null}
      {validationMsg ? <Alert tone="warning">{validationMsg}</Alert> : null}

      <Card title="Shipment details">
        {!ready ? <Loading rows={3} /> : (
          <div className="form c3">
            <SelectField label="Customer order" value={soId} onChange={setSoId} placeholder={ready.length ? 'Choose an order…' : 'No orders ready to ship'} required
              options={ready.map((o) => ({ value: o.id, label: `${o.number} · ${o.customerName} · promised ${date(o.promisedDate)}` }))} />
            <TextField label="Planned dispatch" type="date" value={f.plannedDate} onChange={set('plannedDate')} />
            <div />
            <TextField label="Transporter" value={f.transporter} onChange={set('transporter')} placeholder="e.g. VRL Logistics" />
            <TextField label="Vehicle number" value={f.vehicleNo} onChange={(v) => set('vehicleNo')(v.toUpperCase())} placeholder="e.g. TN 70 AK 3200" hint="Needed before loading · can be added later" />
          </div>
        )}
      </Card>

      {order ? (
        <DataTable
          toolbar={<div className="toolbar"><div><div className="tt">Lines to ship</div><div className="ts">{order.number} · {order.customerName} · quantity defaults to what is open and in stock</div></div></div>}
          rows={order.lines}
          columns={[
            { key: 'item', header: 'Item', render: (l) => <Two a={l.itemName} b={l.itemCode} /> },
            { key: 'ordered', header: 'Ordered', align: 'right', render: (l) => `${num(l.qty)} ${l.uom}` },
            { key: 'shipped', header: 'Shipped', align: 'right', render: (l) => num(l.qtyDispatched + (l.qtyPending || 0)) },
            { key: 'open', header: 'Open', align: 'right', render: (l) => <span className="strong">{num(l.qtyOpen)}</span> },
            { key: 'fg', header: 'In FG Store', align: 'right', render: (l) => <Badge tone={l.fgStock <= 0 ? 'neutral' : l.fgStock >= l.qtyOpen ? 'success' : 'warning'}>{num(l.fgStock)}</Badge> },
            {
              key: 'ship', header: 'Ship now', align: 'right', width: 180, render: (l) => {
                const err = problems(l);
                return (
                  <div className="stack tight" style={{ gap: 2, alignItems: 'flex-end' }}>
                    <input className="cell num" type="number" min={0} max={Math.min(l.qtyOpen, l.fgStock)} value={qty[l.id] ?? ''} aria-label={`Quantity of ${l.itemCode} to ship`}
                      onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} style={err ? { borderColor: 'var(--danger-solid)' } : undefined} />
                    {err ? <span className="text-xs f-danger">{err}</span> : l.fgStock <= 0 ? <span className="text-xs muted">Nothing in FG yet</span> : null}
                  </div>
                );
              },
            },
          ]}
          footer={<div className="tfoot"><span>{chosen.length} of {order.lines.length} lines</span><span className="strong" style={{ color: 'var(--text-primary)' }}>{num(totalQty)} pcs to ship</span></div>}
        />
      ) : ready ? (
        <Card><EmptyState title={ready.length ? 'Choose a customer order' : 'Nothing is ready to ship'}>{ready.length ? 'Its open lines and finished stock show here' : 'Orders appear here once they are released and have quantity left to ship'}</EmptyState></Card>
      ) : null}
    </>
  );
}
