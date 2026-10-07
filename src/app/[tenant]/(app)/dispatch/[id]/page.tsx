'use client';
// Shipment detail: one delivery challan moving Pick → Pack → Challan → Loaded → In transit → Delivered → Acknowledged.
// Each step is one button; the challan takes stock out of FG Store and delivery raises the sales invoice.
import { useState } from 'react';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useParams } from 'next/navigation';
import { ArrowRight, Landmark, Printer, Truck } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, dateShort, dateTime, inr, num } from '@/lib/format';
import { Alert, Button, Card, DataTable, EmptyState, ErrorBox, KeyValue, ListItem, Loading, Modal, PageHeader, StatusBadge, Stepper, TextField, Two, useToast } from '@/components/ui';
import { Attachments } from '@/components/docs/Attachments';

// What each step does, shown before the user moves the shipment on
const NEXT_NOTE: Record<string, string> = {
  Pack: 'Mark the goods packed and labelled for this challan.',
  Challan: 'The delivery challan is issued and the stock leaves FG Store, oldest lot first. Add the e-way bill number if you have it.',
  Loaded: 'Record the vehicle the goods are loaded on. The vehicle number is required.',
  'In transit': 'The vehicle has left the plant. The dispatch time is recorded now.',
  Delivered: 'The customer has received the goods. The sales invoice is raised automatically.',
  Acknowledged: 'Record the proof of delivery (POD) signed by the customer.',
};

const PRINT_CSS = `@media print {
  .sidebar, .topbar, .ribbon, .crumbs, .page-head, .no-print, .toasts { display: none !important; }
  body, .content { background: #fff !important; }
  .content { padding: 0 !important; max-width: none !important; }
  .card { box-shadow: none !important; break-inside: avoid; }
  .print-only { display: block !important; }
}
.print-only { display: none; }`;

export default function ShipmentPage() {
  const { id } = useParams<{ id: string }>();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: sh, error, mutate } = useApi<any>(`/shipments/${id}`);
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState('');
  const [f, setF] = useState({ ewayBill: '', vehicleNo: '', transporter: '', podRef: '' });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  async function advance(body: Record<string, string | undefined> = {}) {
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v && v.trim()));
      const r = await post(`/shipments/${id}/advance`, clean);
      await mutate(r, { revalidate: false });
      setDlg('');
      toast.ok(r.status === 'Delivered' && r.invoice ? `${r.number} delivered · invoice ${r.invoice.number} raised` : `${r.number} · ${r.status}`);
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  function next() {
    const step = sh.nextStep as string;
    if (step === 'Challan') { setF({ ...f, ewayBill: '' }); setDlg('Challan'); }
    else if (step === 'Loaded') { setF({ ...f, vehicleNo: sh.vehicleNo || '', transporter: sh.transporter || '' }); setDlg('Loaded'); }
    else if (step === 'Acknowledged') { setF({ ...f, podRef: '' }); setDlg('Acknowledged'); }
    else advance();
  }

  if (error) return <ErrorBox error={error} />;
  if (!sh) return <Loading rows={6} />;

  const done = sh.status === 'Acknowledged';
  const current = done ? sh.steps.length : sh.stepIndex;
  const subOf = (label: string, i: number): string | undefined => {
    if (i > sh.stepIndex) return undefined;
    if (label === 'Challan') return sh.ewayBill || undefined;
    if (label === 'Loaded') return sh.vehicleNo || undefined;
    if (label === 'In transit') return sh.dispatchedAt ? dateTime(sh.dispatchedAt) : undefined;
    if (label === 'Delivered') return sh.deliveredAt ? dateTime(sh.deliveredAt) : undefined;
    if (label === 'Acknowledged') return sh.podRef || undefined;
    return undefined;
  };
  const totalQty = sh.lines.reduce((a: number, l: any) => a + l.qty, 0);
  const totalValue = sh.lines.reduce((a: number, l: any) => a + l.qty * (l.rate || 0), 0);
  const canMove = !!sh.nextStep && can('dispatch', 'edit');

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader
        back="/dispatch"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Dispatch' }, { label: 'Dispatch & Delivery', href: '/dispatch' }, { label: sh.number }]}
        title={sh.number}
        tags={<StatusBadge kind="ship" status={sh.status} />}
        sub={`${sh.customerName} · ${sh.salesOrderNo} · planned ${date(sh.plannedDate)}`}
        actions={<>
          <Button icon={Printer} onClick={() => window.print()}>Print delivery challan</Button>
          {canMove ? <Button variant="primary" icon={ArrowRight} loading={busy && !dlg} onClick={next}>Mark {sh.nextStep}</Button> : null}
        </>}
      />
      <div className="print-only">
        <div className="h2">Delivery challan {sh.number}</div>
        <div className="secondary">{user?.company.name} · {user?.company.city} → {sh.customerName}{sh.customerCity ? ', ' + sh.customerCity : ''}</div>
      </div>

      <Card title="Delivery progress" sub={done ? 'Delivered and acknowledged by the customer' : `Step ${sh.stepIndex + 1} of ${sh.steps.length} · next: ${sh.nextStep}`}>
        <Stepper current={current} steps={sh.steps.map((s: string, i: number) => ({ label: s, sub: subOf(s, i) }))} />
      </Card>

      <div className="grid main-side">
        <div className="stack">
          <DataTable
            toolbar={<div className="toolbar"><div className="tt">Items</div></div>}
            rows={sh.lines}
            columns={[
              { key: 'item', header: 'Item', render: (l) => <Two a={l.itemName} b={l.itemCode} /> },
              { key: 'qty', header: 'Qty', align: 'right', render: (l) => `${num(l.qty)} ${l.uom}` },
              { key: 'lot', header: 'Lot', render: (l) => (l.lotNo ? <span className="chip">{l.lotNo}</span> : <span className="muted text-xs">Taken at challan</span>) },
              { key: 'rate', header: 'Rate', align: 'right', render: (l) => inr(l.rate, 2) },
              { key: 'value', header: 'Value', align: 'right', render: (l) => inr(l.qty * (l.rate || 0)) },
            ]}
            footer={<div className="tfoot"><span>{sh.lines.length} line{sh.lines.length === 1 ? '' : 's'} · {num(totalQty)} pcs</span><span className="strong" style={{ color: 'var(--text-primary)' }}>Value {inr(totalValue)} + GST</span></div>}
          />
          <Card title="Shipment details">
            <KeyValue cols={3} items={[
              ['Customer', <span key="c">{sh.customerName}{sh.customerCity ? <span className="text-xs muted" style={{ display: 'block', fontWeight: 400 }}>{sh.customerCity}</span> : null}</span>],
              ['GSTIN', <span key="g" className="num">{sh.customerGstin || '—'}</span>],
              ['Customer order', <Link key="o" href={`/sales/orders/${sh.salesOrderId}`}>{sh.salesOrderNo}</Link>],
              ['Customer PO', sh.customerPo],
              ['Transporter', sh.transporter],
              ['Vehicle', sh.vehicleNo],
              ['E-way bill', sh.ewayBill],
              ['Dispatched', sh.dispatchedAt ? dateTime(sh.dispatchedAt) : null],
              ['Delivered', sh.deliveredAt ? dateTime(sh.deliveredAt) : null],
              ['Proof of delivery', sh.podRef],
              ['Planned', date(sh.plannedDate)],
              ['Created', dateShort(sh.createdAt)],
            ]} />
          </Card>
        </div>
        <div className="stack no-print">
          <Card title="Invoice" sub="Raised when the shipment is delivered">
            {sh.invoice ? (
              <div className="list">
                <ListItem icon={Landmark} tone="teal" title={`${sh.invoice.number} · ${inr(sh.invoice.total)}`} sub="Sales invoice for this challan" right={<StatusBadge kind="inv" status={sh.invoice.displayStatus || sh.invoice.status} />} href={`/finance/invoices/${sh.invoice.id}`} />
              </div>
            ) : <EmptyState icon={Landmark} title="No invoice yet">Raised automatically on delivery</EmptyState>}
          </Card>
          <Card title={done ? 'Shipment complete' : `Next · ${sh.nextStep}`}>
            {done ? <Alert tone="success" title="Delivered and acknowledged">POD {sh.podRef || '—'} recorded{sh.deliveredAt ? ' · delivered ' + dateTime(sh.deliveredAt) : ''}</Alert> : (
              <div className="stack tight">
                <div className="text-sm secondary">{NEXT_NOTE[sh.nextStep]}</div>
                {canMove ? <div><Button variant="primary" size="sm" icon={Truck} loading={busy && !dlg} onClick={next}>Mark {sh.nextStep}</Button></div> : <div className="text-xs muted">Your role can view this shipment but not move it on.</div>}
              </div>
            )}
          </Card>
          <Attachments entityType="DC" entityId={sh.id} entityNo={sh.number} />
        </div>
      </div>

      <Modal open={dlg === 'Challan'} onClose={() => setDlg('')} title="Issue delivery challan" sub="Stock leaves FG Store now, oldest lot first"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => advance({ ewayBill: f.ewayBill })}>Issue challan</Button></>}>
        <TextField label="E-way bill number" value={f.ewayBill} onChange={set('ewayBill')} placeholder="Optional · e.g. 3312 8876 0021" hint="Leave blank to generate a reference" />
      </Modal>
      <Modal open={dlg === 'Loaded'} onClose={() => setDlg('')} title="Mark loaded" sub="Record the vehicle carrying this challan"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy} disabled={!f.vehicleNo.trim()} onClick={() => advance({ vehicleNo: f.vehicleNo, transporter: f.transporter })}>Mark loaded</Button></>}>
        <div className="form c2">
          <TextField label="Vehicle number" value={f.vehicleNo} onChange={(v) => set('vehicleNo')(v.toUpperCase())} placeholder="e.g. TN 70 AK 3200" required />
          <TextField label="Transporter" value={f.transporter} onChange={set('transporter')} placeholder="e.g. VRL Logistics" />
        </div>
      </Modal>
      <Modal open={dlg === 'Acknowledged'} onClose={() => setDlg('')} title="Record proof of delivery" sub="The customer's signed acknowledgement for this challan"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => advance({ podRef: f.podRef })}>Mark acknowledged</Button></>}>
        <TextField label="POD reference" value={f.podRef} onChange={set('podRef')} placeholder={`e.g. POD-${sh.number}`} hint="Leave blank to use the challan number" />
      </Modal>
    </>
  );
}
