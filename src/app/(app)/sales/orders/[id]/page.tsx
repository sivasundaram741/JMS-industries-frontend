'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, ClipboardList, FileText, Landmark, Route, Send, ShieldCheck, Truck, X } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, dateShort, inr, num } from '@/lib/format';
import { Button, ButtonLink, Card, DataTable, ErrorBox, KeyValue, ListItem, Loading, Modal, PageHeader, StatStrip, StatusBadge, Stepper, TextField, Two, useToast } from '@/components/ui';
import { Attachments } from '@/components/docs/Attachments';

const FLOW = ['Received', 'Credit check', 'Customer PO', 'Confirmed', 'Released', 'Dispatched', 'Invoiced', 'Closed'];
const stepOf = (s: string) => ({ Received: 0, 'Credit hold': 1, 'Credit OK': 2, Quoted: 3, Confirmed: 4, Released: 5, Dispatched: 6, Invoiced: 7, Closed: 8 } as Record<string, number>)[s] ?? 0;

export default function SalesOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: so, error, mutate } = useApi<any>(`/sales-orders/${id}`);
  const [busy, setBusy] = useState('');
  const [dlg, setDlg] = useState<'' | 'quote' | 'confirm' | 'cancel'>('');
  const [val, setVal] = useState('');

  async function act(action: string, body: any = {}, msg?: string) {
    setBusy(action);
    try {
      const r = await post(`/sales-orders/${id}/actions/${action}`, body);
      await mutate(r, { revalidate: false });
      toast.ok(msg || `${r.number} · ${r.status}`);
      setDlg('');
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  if (error) return <ErrorBox error={error} />;
  if (!so) return <Loading rows={6} />;
  const has = (a: string) => so.actions.includes(a) && can('sales', 'edit');
  const ordered = so.lines.reduce((a: number, l: any) => a + l.qty, 0);
  const dispatched = so.lines.reduce((a: number, l: any) => a + l.qtyDispatched, 0);
  const invoiced = so.lines.reduce((a: number, l: any) => a + l.qtyInvoiced, 0);

  return (
    <>
      <PageHeader
        back="/sales/orders"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Sales' }, { label: 'Customer Orders', href: '/sales/orders' }, { label: so.number }]}
        title={so.number}
        tags={<StatusBadge kind="so" status={so.status} />}
        sub={`${so.customerName} · ${so.customerPo ? 'PO ' + so.customerPo + ' · ' : ''}ordered ${date(so.orderDate)} · promised ${date(so.promisedDate)}`}
        actions={<>
          {can('track') ? <ButtonLink href={`/tracking/orders?id=${so.id}`} icon={Route}>Order tracking</ButtonLink> : null}
          {has('cancel') ? <Button variant="danger-outline" icon={X} onClick={() => { setVal(''); setDlg('cancel'); }}>Cancel order</Button> : null}
          {has('check-credit') ? <Button variant="primary" icon={ShieldCheck} loading={busy === 'check-credit'} onClick={() => act('check-credit')}>Check credit</Button> : null}
          {has('override-credit') && can('sales', 'approve') ? <Button icon={Check} loading={busy === 'override-credit'} onClick={() => act('override-credit', {}, 'Credit hold overridden')}>Override credit hold</Button> : null}
          {has('quote') ? <Button icon={FileText} onClick={() => { setVal(so.customerPo || ''); setDlg('quote'); }}>Record customer PO</Button> : null}
          {has('confirm') ? <Button variant="primary" icon={Check} onClick={() => { setVal(so.promisedDate || ''); setDlg('confirm'); }}>Confirm order</Button> : null}
          {has('release') ? <Button variant="primary" icon={Send} loading={busy === 'release'} onClick={() => act('release', {}, 'Released to production · work orders created')}>Release to production</Button> : null}
          {['Released', 'Dispatched', 'Invoiced'].includes(so.status) && dispatched < ordered && can('dispatch', 'create') ? <ButtonLink href={`/dispatch/new?so=${so.id}`} variant="primary" icon={Truck}>Create shipment</ButtonLink> : null}
        </>}
      />
      <StatStrip items={[
        { label: 'Order value', value: inr(so.total) },
        { label: 'Ordered', value: num(ordered) + ' pcs' },
        { label: 'Made', value: num(so.workOrders.reduce((a: number, w: any) => a + w.qtyCompleted, 0)) + ' pcs' },
        { label: 'Dispatched', value: num(dispatched) + ' pcs', tag: ordered ? Math.round((dispatched / ordered) * 100) + '%' : undefined, tone: 'teal' },
        { label: 'Invoiced', value: num(invoiced) + ' pcs' },
        { label: 'Credit', value: <span className="text-sm">{so.creditNote || 'Not checked'}</span> },
      ]} />
      <Card title="Order progress">
        <Stepper current={Math.min(stepOf(so.status), FLOW.length)} steps={FLOW.map((l) => ({ label: l }))} />
      </Card>
      <div className="grid main-side">
        <div className="stack">
          <DataTable
            toolbar={<div className="toolbar"><div className="tt">Items</div></div>}
            rows={so.lines}
            columns={[
              { key: 'item', header: 'Item', render: (l) => <Two a={l.itemName} b={l.itemCode} /> },
              { key: 'qty', header: 'Qty', align: 'right', render: (l) => `${num(l.qty)} ${l.uom}` },
              { key: 'rate', header: 'Rate', align: 'right', render: (l) => inr(l.rate, 2) },
              { key: 'tax', header: 'GST', align: 'right', render: (l) => l.taxPct + '%' },
              { key: 'amount', header: 'Amount', align: 'right', render: (l) => inr(l.amount, 2) },
              { key: 'disp', header: 'Dispatched', align: 'right', render: (l) => num(l.qtyDispatched) },
              { key: 'inv', header: 'Invoiced', align: 'right', render: (l) => num(l.qtyInvoiced) },
            ]}
            footer={<div className="tfoot"><span>Subtotal {inr(so.subtotal, 2)} · GST {inr(so.tax, 2)}</span><span className="strong" style={{ color: 'var(--text-primary)' }}>Total {inr(so.total, 2)}</span></div>}
          />
          <Card title="Customer">
            <KeyValue cols={3} items={[['Name', so.customerName], ['Code', so.customerCode], ['City', so.customerCity], ['GSTIN', so.customerGstin], ['Credit limit', inr(so.creditLimit)], ['Notes', so.notes]]} />
          </Card>
        </div>
        <div className="stack">
          <Card title="Work orders" sub="Created on release to production">
            <div className="list">
              {so.workOrders.length ? so.workOrders.map((w: any) => <ListItem key={w.id} icon={ClipboardList} tone="danger" title={`${w.number} · ${w.itemCode}`} sub={`${num(w.qtyCompleted)} / ${num(w.qtyPlanned)} · due ${dateShort(w.dueDate)}`} right={<StatusBadge kind="wo" status={w.status} />} href={`/production/work-orders/${w.id}`} />) : <div className="empty text-sm">None yet</div>}
            </div>
          </Card>
          <Card title="Shipments">
            <div className="list">
              {so.shipments.length ? so.shipments.map((s: any) => <ListItem key={s.id} icon={Truck} tone="info" title={s.number} sub={s.deliveredAt ? 'Delivered ' + dateShort(s.deliveredAt) : 'Planned ' + dateShort(s.plannedDate)} right={<StatusBadge kind="ship" status={s.status} />} href={`/dispatch/${s.id}`} />) : <div className="empty text-sm">None yet</div>}
            </div>
          </Card>
          <Card title="Invoices">
            <div className="list">
              {so.invoices.length ? so.invoices.map((v: any) => <ListItem key={v.id} icon={Landmark} tone="teal" title={`${v.number} · ${inr(v.total)}`} sub={`Paid ${inr(v.amountPaid)} · due ${dateShort(v.dueDate)}`} right={<StatusBadge kind="inv" status={v.status} />} href={`/finance/invoices/${v.id}`} />) : <div className="empty text-sm">Raised automatically on delivery</div>}
            </div>
          </Card>
          <Attachments entityType="SO" entityId={so.id} entityNo={so.number} />
        </div>
      </div>

      <Modal open={dlg === 'quote'} onClose={() => setDlg('')} title="Record customer PO" sub="The customer's purchase order number for this quote"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy === 'quote'} onClick={() => act('quote', { customerPo: val })}>Save</Button></>}>
        <TextField label="Customer PO number" value={val} onChange={setVal} />
      </Modal>
      <Modal open={dlg === 'confirm'} onClose={() => setDlg('')} title="Confirm order" sub="Production is notified with this delivery date"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy === 'confirm'} onClick={() => act('confirm', { promisedDate: val })}>Confirm</Button></>}>
        <TextField label="Promised delivery" type="date" value={val} onChange={setVal} />
      </Modal>
      <Modal open={dlg === 'cancel'} onClose={() => setDlg('')} title={`Cancel ${so.number}?`} sub="The order stays on record as cancelled"
        footer={<><Button onClick={() => setDlg('')}>Keep order</Button><Button variant="danger" loading={busy === 'cancel'} onClick={() => act('cancel', { reason: val })}>Cancel order</Button></>}>
        <TextField label="Reason" value={val} onChange={setVal} placeholder="e.g. Customer withdrew the schedule" />
      </Modal>
    </>
  );
}
