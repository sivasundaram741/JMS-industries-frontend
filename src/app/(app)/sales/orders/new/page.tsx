'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { addDaysIso, todayIso } from '@/lib/format';
import { Button, Card, PageHeader, SelectField, TextAreaField, TextField, useToast } from '@/components/ui';
import { LinesEditor, emptyLine, type Line } from '@/components/LinesEditor';

export default function NewSalesOrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { data: customers } = useApi<any>('/customers?pageSize=200');
  const { data: items } = useApi<any>('/items?type=FG&pageSize=200');
  const [f, setF] = useState({ customerId: '', customerPo: '', orderDate: todayIso(), promisedDate: addDaysIso(todayIso(), 10), notes: '' });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  async function save() {
    setBusy(true);
    try {
      const so = await post('/sales-orders', { ...f, customerId: Number(f.customerId), lines: lines.filter((l) => l.itemId).map((l) => ({ itemId: Number(l.itemId), qty: Number(l.qty), rate: Number(l.rate), taxPct: Number(l.taxPct) })) });
      toast.ok(`${so.number} created`);
      router.push(`/sales/orders/${so.id}`);
    } catch (e) { toast.err(e); setBusy(false); }
  }

  return (
    <>
      <PageHeader back="/sales/orders" crumbs={[{ label: user?.company.shortName || '' }, { label: 'Sales' }, { label: 'Customer Orders', href: '/sales/orders' }, { label: 'New' }]} title="New customer order" sub="The order is received now · credit check and confirmation follow"
        actions={<><Button onClick={() => router.push('/sales/orders')}>Cancel</Button><Button variant="primary" icon={Save} loading={busy} onClick={save} disabled={!f.customerId || !lines.some((l) => l.itemId && Number(l.qty) > 0)}>Save order</Button></>} />
      <Card title="Order details">
        <div className="form c3">
          <SelectField label="Customer" value={f.customerId} onChange={set('customerId')} placeholder="Choose a customer…" options={(customers?.rows || []).map((c: any) => ({ value: c.id, label: `${c.name} · ${c.city || ''}` }))} required />
          <TextField label="Customer PO number" value={f.customerPo} onChange={set('customerPo')} placeholder="e.g. 4500871" />
          <div />
          <TextField label="Order date" type="date" value={f.orderDate} onChange={set('orderDate')} />
          <TextField label="Promised delivery" type="date" value={f.promisedDate} onChange={set('promisedDate')} />
          <div />
          <TextAreaField className="full" label="Notes" value={f.notes} onChange={set('notes')} placeholder="Delivery instructions, drawing revision, packing…" rows={2} />
        </div>
      </Card>
      <LinesEditor lines={lines} onChange={setLines} items={items?.rows || []} />
    </>
  );
}
