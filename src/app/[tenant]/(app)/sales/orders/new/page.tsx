'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useTenantHref } from '@/lib/hooks';
import { addDaysIso, inr, todayIso } from '@/lib/format';
import { Alert, Button, Card, PageHeader, TextAreaField, TextField, useToast } from '@/components/ui';
import { ComboField } from '@/components/ui/ComboField';
import { LinesEditor, emptyLine, totals, type Line } from '@/components/LinesEditor';
import { QuickCustomer } from '@/components/QuickCreate';

export default function NewSalesOrderPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const toast = useToast();

  const [f, setF] = useState({ customerId: '', customerPo: '', orderDate: todayIso(), promisedDate: addDaysIso(todayIso(), 10), notes: '' });
  const [customerLabel, setCustomerLabel] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  // Fetch customer credit details as soon as one is selected
  const { data: customer } = useApi<any>(f.customerId ? `/customers/${f.customerId}` : null);

  const t = totals(lines);
  const hasLines = lines.some(l => l.itemId && Number(l.qty) > 0);

  // Credit warning: shown when creditLimit > 0 and order would push customer over limit
  const creditWarn = (() => {
    if (!customer || !customer.creditLimit) return null;
    const used = (customer.outstanding || 0) + (customer.openOrdersValue || 0);
    const available = customer.creditLimit - used;
    if (t.total <= 0 || t.total <= available) return null;
    const over = t.total - available;
    return available > 0
      ? `Credit available for this customer is ${inr(available)}. This order total of ${inr(t.total)} exceeds it by ${inr(over)}. The order will be placed on credit hold.`
      : `This customer has no credit available (limit ${inr(customer.creditLimit)}, already used ${inr(used)}). The order will be placed on credit hold.`;
  })();

  const validationMsg = tried && (!f.customerId ? 'Select a customer to continue.'
    : !hasLines ? 'Add at least one item line with a quantity to continue.'
    : null);

  async function save() {
    setTried(true);
    if (!f.customerId || !hasLines) return;
    setBusy(true);
    try {
      const so = await post('/sales-orders', {
        ...f,
        customerId: Number(f.customerId),
        lines: lines.filter(l => l.itemId).map(l => ({ itemId: Number(l.itemId), qty: Number(l.qty), rate: Number(l.rate), taxPct: Number(l.taxPct) })),
      });
      toast.ok(`${so.number} created`);
      router.push(tenantHref(`/sales/orders/${so.id}`));
    } catch (e) { toast.err(e); setBusy(false); }
  }

  return (
    <>
      <PageHeader back="/sales/orders"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Sales' }, { label: 'Customer Orders', href: '/sales/orders' }, { label: 'New' }]}
        title="New customer order"
        sub="Saved as a new order — confirm it once credit is checked"
        actions={
          <>
            <Button onClick={() => router.push(tenantHref('/sales/orders'))}>Cancel</Button>
            <Button variant="primary" icon={Save} loading={busy} onClick={save}>
              Save order
            </Button>
          </>
        }
      />
      {validationMsg ? <Alert tone="warning">{validationMsg}</Alert> : null}
      {creditWarn ? <Alert tone="warning" title="Credit limit warning">{creditWarn}</Alert> : null}
      <Card title="Order details">
        <div className="form c3">
          <ComboField
            label="Customer"
            value={f.customerId}
            onChange={id => setF(x => ({ ...x, customerId: id }))}
            apiPath="/customers"
            toOption={c => ({ id: c.id, label: c.name, sub: c.city || '' })}
            selectedLabel={customerLabel}
            canCreate={can('customers', 'create')}
            createLabel="Add customer"
            onCreateClick={() => setShowAddCustomer(true)}
            placeholder="Search customers…"
            required
          />
          <TextField label="Customer PO number" value={f.customerPo} onChange={set('customerPo')} placeholder="e.g. 4500871" />
          <div />
          <TextField label="Order date" type="date" value={f.orderDate} onChange={set('orderDate')} />
          <TextField label="Promised delivery" type="date" value={f.promisedDate} onChange={set('promisedDate')} />
          <div />
          <TextAreaField className="full" label="Notes" value={f.notes} onChange={set('notes')}
            placeholder="Delivery instructions, drawing revision, packing…" rows={2} />
        </div>
      </Card>
      <LinesEditor
        lines={lines}
        onChange={setLines}
        itemApiPath="/items"
        itemFilter="type=FG"
        canAddItem={can('masters', 'create')}
      />
      <QuickCustomer
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onCreated={opt => {
          setCustomerLabel(opt.label);
          setF(x => ({ ...x, customerId: String(opt.id) }));
        }}
      />
    </>
  );
}
