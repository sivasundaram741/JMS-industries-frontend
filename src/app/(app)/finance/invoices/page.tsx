'use client';
// Finance · Sales Invoices: the GST sales register — tax invoices with CGST / SGST / IGST, e-way bills and credit
// invoices against them — plus shipments that left without an invoice, to raise one.
import { useState } from 'react';
import { Download, FilePlus2, FileText, FileX2, Percent, Truck } from 'lucide-react';
import { api, post, qs, saveBlob, toCsv, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, dateShort, inr, inrShort, num } from '@/lib/format';
import { Alert, Button, Card, DataTable, ErrorBox, Kpi, ListItem, ListToolbar, Loading, Modal, PageHeader, Pagination, StatusBadge, Two, useToast } from '@/components/ui';

const FILTERS = [{ key: '', label: 'All' }, { key: 'Open', label: 'Open' }, { key: 'Overdue', label: 'Overdue' }, { key: 'Part paid', label: 'Part paid' }, { key: 'Paid', label: 'Paid' }];
interface Summary { invoicesMtd: number; taxableMtd: number; gstMtd: number; cgst: number; sgst: number; igst: number; totalMtd: number; creditsMtd: number; toInvoice: number }

export default function SalesInvoicesPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const L = useListState();
  const [range, setRange] = useState({ from: '', to: '' });
  const { data, error, isLoading, mutate } = useApi<Page<any>>('/finance/register' + qs({ ...L.params, from: range.from || undefined, to: range.to || undefined }));
  const { data: sum, mutate: mutateSum } = useApi<Summary>('/finance/register/summary');
  const { data: pending, mutate: mutatePending } = useApi<any[]>('/finance/uninvoiced-shipments');
  const [raise, setRaise] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  async function raiseInvoice(s: any) {
    setBusy(s.id);
    try {
      const inv = await post('/finance/invoices', { shipmentId: s.id });
      toast.ok(`${inv.number} raised for ${s.number}`);
      mutate(); mutateSum(); mutatePending();
    } catch (e) { toast.err(e); } finally { setBusy(null); }
  }
  async function exportCsv() {
    try {
      const all = await api<Page<any>>('/finance/register' + qs({ search: L.params.search, status: L.params.status, from: range.from || undefined, to: range.to || undefined, pageSize: 200 }));
      saveBlob(new Blob([toCsv([
        { key: 'number', label: 'Invoice no' }, { key: 'invoiceDate', label: 'Date' }, { key: 'customerName', label: 'Customer' }, { key: 'customerGstin', label: 'GSTIN' },
        { key: 'salesOrderNo', label: 'Order' }, { key: 'shipmentNo', label: 'Challan' }, { key: 'ewayBill', label: 'e-Way bill' }, { key: 'subtotal', label: 'Taxable' },
        { key: 'cgst', label: 'CGST' }, { key: 'sgst', label: 'SGST' }, { key: 'igst', label: 'IGST' }, { key: 'total', label: 'Total' }, { key: 'credited', label: 'Credit invoices' },
        { key: 'amountPaid', label: 'Received' }, { key: 'balance', label: 'Balance' }, { key: 'displayStatus', label: 'Status' },
      ], all.rows)], { type: 'text/csv;charset=utf-8' }), 'sales-register.csv');
    } catch (e) { toast.err(e); }
  }

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Finance' }, { label: 'Sales Invoices' }]} title="Sales Invoices"
        sub="GST tax invoices raised on dispatch · CGST + SGST inside Tamil Nadu, IGST outside · e-way bill and credit invoices"
        actions={<>
          <Button icon={Download} onClick={exportCsv}>Export register</Button>
          {can('billing', 'create') ? <Button variant="primary" icon={FilePlus2} onClick={() => setRaise(true)}>Raise invoice{pending?.length ? ` (${pending.length})` : ''}</Button> : null}
        </>} />
      {sum ? (
        <div className="kpis">
          <Kpi label="Invoices (MTD)" value={num(sum.invoicesMtd)} icon={FileText} tone="teal" note={`${inrShort(sum.totalMtd)} incl. GST`} />
          <Kpi label="Taxable value (MTD)" value={inrShort(sum.taxableMtd)} icon={FilePlus2} tone="info" note="before GST" />
          <Kpi label="Output GST (MTD)" value={inrShort(sum.gstMtd)} icon={Percent} tone="warning" note={`CGST ${inrShort(sum.cgst)} · SGST ${inrShort(sum.sgst)} · IGST ${inrShort(sum.igst)}`} />
          <Kpi label="Credit invoices (MTD)" value={inrShort(sum.creditsMtd)} icon={FileX2} tone="purple" note={sum.toInvoice ? `${sum.toInvoice} shipment${sum.toInvoice === 1 ? '' : 's'} to invoice` : 'every shipment invoiced'} />
        </div>
      ) : <Card><Loading rows={2} /></Card>}
      {pending?.length ? <Alert tone="warning" title={`${pending.length} shipment${pending.length === 1 ? '' : 's'} dispatched without an invoice`} action={can('billing', 'create') ? <Button size="sm" onClick={() => setRaise(true)}>Raise now</Button> : undefined}>Invoices are normally raised on delivery; raise them here if a delivery was not confirmed.</Alert> : null}
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar title="GST sales register" search={L.search} onSearch={L.setSearch} placeholder="Search invoice, customer, order, PO…" chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }}
          right={<div className="row" style={{ gap: 6 }}>
            <input className="input" style={{ width: 150, height: 36 }} type="date" value={range.from} onChange={(e) => { setRange({ ...range, from: e.target.value }); L.setPage(1); }} aria-label="From date" />
            <span className="muted">–</span>
            <input className="input" style={{ width: 150, height: 36 }} type="date" value={range.to} onChange={(e) => { setRange({ ...range, to: e.target.value }); L.setPage(1); }} aria-label="To date" />
          </div>} />}
        rows={data?.rows}
        rowHref={(r) => `/finance/invoices/${r.id}`}
        empty="No invoices match"
        columns={[
          { key: 'number', header: 'Invoice', render: (r) => <Two a={<span className="nowrap">{r.number}</span>} b={<span className="nowrap">{date(r.invoiceDate)}</span>} /> },
          { key: 'customer', header: 'Customer', render: (r) => <Two a={r.customerName} b={<span className="num">{r.customerGstin || 'Unregistered'}</span>} /> },
          { key: 'ref', header: 'Order · challan', render: (r) => <Two a={<span className="nowrap">{r.salesOrderNo}</span>} b={<span className="nowrap" title={r.ewayBill ? 'e-Way bill ' + r.ewayBill : undefined}>{r.shipmentNo || '—'}</span>} /> },
          { key: 'taxable', header: 'Taxable', align: 'right', render: (r) => <span className="nowrap">{inr(r.subtotal)}</span> },
          { key: 'gst', header: 'GST', align: 'right', render: (r) => <Two a={<span className="nowrap">{inr(r.tax)}</span>} b={r.igst ? 'IGST' : 'CGST + SGST'} /> },
          { key: 'total', header: 'Total', align: 'right', render: (r) => <Two a={<span className="strong nowrap">{inr(r.total)}</span>} b={r.credited ? <span className="f-danger nowrap">−{inr(r.credited)} credit</span> : undefined} /> },
          { key: 'balance', header: 'Balance', align: 'right', render: (r) => <Two a={<span className={'nowrap ' + (r.balance > 0 ? (r.overdueDays > 0 ? 'f-danger strong' : 'strong') : 'muted')}>{inr(r.balance)}</span>} b={r.balance > 0 ? <span className="nowrap">due {dateShort(r.dueDate)}</span> : undefined} /> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="inv" status={r.displayStatus} /> },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="invoices" /> : null}
      />

      <Modal open={raise} onClose={() => setRaise(false)} title="Raise invoice from delivery" sub="Shipments past the delivery challan with no invoice yet · the invoice copies the order's rates and GST">
        {!pending ? <Loading rows={3} /> : pending.length ? (
          <div className="list">
            {pending.map((s: any) => (
              <ListItem key={s.id} icon={Truck} tone="info" title={`${s.number} · ${s.customerName}`} sub={`${s.salesOrderNo} · ${s.status}${s.dispatchedAt ? ' · dispatched ' + dateShort(s.dispatchedAt) : ''}`}
                right={<Button size="sm" variant="primary" loading={busy === s.id} disabled={busy !== null && busy !== s.id} onClick={() => raiseInvoice(s)}>Raise invoice</Button>} />
            ))}
          </div>
        ) : <Alert tone="success" title="Nothing to invoice">Every dispatched shipment has its tax invoice.</Alert>}
      </Modal>
    </>
  );
}
