'use client';
// New work order: item, quantity, dates, machine and optional customer order, with a preview of the item's
// standard operations and materials scaled to the quantity.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useTenantHref } from '@/lib/hooks';
import { addDaysIso, num, todayIso } from '@/lib/format';
import { Alert, Button, Card, Chip, DataTable, PageHeader, SelectField, TextAreaField, TextField, Two, useToast } from '@/components/ui';

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const hours = (min: number) => (min >= 60 ? num(min / 60, 1) + ' h' : num(min) + ' min');

export default function NewWorkOrderPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const toast = useToast();
  const { data: items } = useApi<any>('/items?type=FG&pageSize=200');
  const { data: machines } = useApi<any[]>('/machines');
  const { data: orders } = useApi<any>('/sales-orders?status=Released&pageSize=200');
  const [f, setF] = useState({ itemId: '', qtyPlanned: '', startDate: todayIso(), dueDate: addDaysIso(todayIso(), 7), machineId: '', salesOrderId: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const { data: item } = useApi<any>(f.itemId ? `/items/${f.itemId}` : null);
  const qty = Number(f.qtyPlanned) || 0;
  const firstMachine = item?.operations?.find((o: any) => o.machineCode)?.machineCode;

  const validationMsg = tried && (!f.itemId ? 'Select an item to make.'
    : !(qty > 0) ? 'Enter a planned quantity to continue.'
    : null);

  async function save() {
    setTried(true);
    if (!f.itemId || !(qty > 0)) return;
    setBusy(true);
    try {
      const wo = await post('/work-orders', {
        itemId: Number(f.itemId), qtyPlanned: qty, startDate: f.startDate || undefined, dueDate: f.dueDate || undefined,
        machineId: f.machineId ? Number(f.machineId) : undefined, salesOrderId: f.salesOrderId ? Number(f.salesOrderId) : undefined, notes: f.notes || undefined,
      });
      toast.ok(`${wo.number} created · planned`);
      router.push(tenantHref(`/production/work-orders/${wo.id}`));
    } catch (e) { toast.err(e); setBusy(false); }
  }

  const setupMin = (item?.operations || []).reduce((a: number, o: any) => a + (o.setupMin || 0), 0);
  const runMin = (item?.operations || []).reduce((a: number, o: any) => a + (o.runMin || 0) * qty, 0);

  return (
    <>
      <PageHeader
        back="/production/work-orders"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Production' }, { label: 'Work Orders', href: '/production/work-orders' }, { label: 'New' }]}
        title="New work order"
        sub="The work order starts as Planned · release it to issue material and start production"
        actions={<><Button onClick={() => router.push(tenantHref('/production/work-orders'))}>Cancel</Button><Button variant="primary" icon={Save} loading={busy} onClick={save} disabled={!can('wo', 'create')}>Save work order</Button></>}
      />
      {validationMsg ? <Alert tone="warning">{validationMsg}</Alert> : null}
      <Card title="Work order details">
        <div className="form c3">
          <SelectField className="span2" label="Item to make" value={f.itemId} onChange={set('itemId')} placeholder="Choose a finished item…" options={(items?.rows || []).map((i: any) => ({ value: i.id, label: `${i.name} · ${i.code}` }))} required />
          <TextField label={`Quantity${item ? ' (' + item.uom + ')' : ''}`} type="number" min={1} value={f.qtyPlanned} onChange={set('qtyPlanned')} placeholder="e.g. 400" required />
          <TextField label="Start date" type="date" value={f.startDate} onChange={set('startDate')} />
          <TextField label="Due date" type="date" value={f.dueDate} onChange={set('dueDate')} />
          <SelectField label="Machine" value={f.machineId} onChange={set('machineId')} placeholder={firstMachine ? `From routing (${firstMachine})` : 'From routing'} options={(machines || []).map((m: any) => ({ value: m.id, label: `${m.code} · ${m.name}` }))} />
          <SelectField className="span2" label="Customer order (optional)" value={f.salesOrderId} onChange={set('salesOrderId')} placeholder="Make to stock" options={(orders?.rows || []).map((o: any) => ({ value: o.id, label: `${o.number} · ${o.customerName} · ${o.itemsText}` }))} hint="Released customer orders only" />
          <div />
          <TextAreaField className="full" label="Notes" value={f.notes} onChange={set('notes')} placeholder="Drawing revision, special instructions for the shop floor…" rows={2} />
        </div>
      </Card>

      {!f.itemId ? (
        <Alert tone="info" title="Choose an item to see its routing">The item's standard operations and materials are copied onto the work order, with material quantities scaled to the quantity you plan.</Alert>
      ) : (
        <div className="grid cols-2">
          <DataTable
            loading={!item}
            toolbar={<div className="toolbar"><div><div className="tt">Standard operations</div><div className="ts">{item ? `${item.operations.length} operations · setup ${hours(setupMin)} · run ${qty ? hours(runMin) : '—'}` : 'Loading…'}</div></div></div>}
            rows={item?.operations}
            empty="No routing on this item · one Production operation will be added"
            columns={[
              { key: 'seq', header: 'Op', render: (o) => <span className="strong num">{o.seq}</span> },
              { key: 'name', header: 'Operation', render: (o) => o.name },
              { key: 'machine', header: 'Machine', render: (o) => (o.machineCode ? <Chip>{o.machineCode}</Chip> : <span className="muted">Bench</span>) },
              { key: 'setup', header: 'Setup', align: 'right', render: (o) => `${num(o.setupMin)} min` },
              { key: 'run', header: 'Run', align: 'right', render: (o) => <Two a={`${num(o.runMin, 2)} min/pc`} b={qty ? hours(o.runMin * qty) : undefined} /> },
            ]}
          />
          <DataTable
            loading={!item}
            toolbar={<div className="toolbar"><div><div className="tt">Materials</div><div className="ts">{qty ? `Required for ${num(qty)} ${item?.uom || 'pcs'}` : 'Enter a quantity to scale the materials'}</div></div></div>}
            rows={item?.materials}
            empty="No materials on this item"
            columns={[
              { key: 'item', header: 'Material', render: (m) => <Two a={m.itemName} b={m.itemCode} /> },
              { key: 'per', header: 'Per piece', align: 'right', render: (m) => `${num(m.qtyPer, 3)} ${m.uom}` },
              { key: 'req', header: 'Required', align: 'right', render: (m) => <span className="strong">{qty ? `${num(round3(m.qtyPer * qty), 3)} ${m.uom}` : '—'}</span> },
            ]}
          />
        </div>
      )}
    </>
  );
}
