'use client';
// Purchase · Purchase Bills: vendor invoices booked against POs and GRNs, 3-way matched before payment.
import { useState } from 'react';
import { CalendarClock, FileText, Percent, Plus, ShieldAlert } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, dateShort, inr, inrShort, num } from '@/lib/format';
import { Badge, ButtonLink, Card, DataTable, ErrorBox, Kpi, ListToolbar, Loading, PageHeader, Pagination, StatusBadge, Tabs, Two } from '@/components/ui';
import { billStatus, toneOf } from '@/lib/status';

const FILTERS = [
  { key: '', label: 'All' }, { key: 'On hold', label: 'On hold' }, { key: 'Open', label: 'To pay' }, { key: 'Due7', label: 'Due in 7 days' },
  { key: 'Overdue', label: 'Overdue' }, { key: 'Draft', label: 'Draft' }, { key: 'Paid', label: 'Paid' },
];
interface Summary { billsMtd: number; billedMtd: number; inputGstMtd: number; onHold: number; dueIn7: number; dueIn7Count: number; payable: number; paidMtd: number }

export default function PurchaseBillsPage() {
  const { user, can } = useAuth();
  const [tab, setTab] = useState<'bills' | 'payments'>('bills');
  const L = useListState();
  const [vendor, setVendor] = useState('');
  const { data, error, isLoading } = useApi<Page<any>>(tab === 'bills' ? '/purchase-bills' + qs({ ...L.params, vendorId: vendor || undefined }) : null);
  const { data: pays, isLoading: paysLoading } = useApi<Page<any>>(tab === 'payments' ? '/purchase-bills/payments' + qs({ search: L.params.search, page: L.page }) : null);
  const { data: sum } = useApi<Summary>('/purchase-bills/summary');
  const { data: vendors } = useApi<Page<any>>('/vendors?pageSize=200');

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Purchase' }, { label: 'Purchase Bills' }]} title="Purchase Bills"
        sub="Vendor invoices booked against POs and GRNs · 3-way matched before payment"
        actions={can('pbills', 'create') ? <ButtonLink variant="primary" icon={Plus} href="/purchase/bills/new">New purchase bill</ButtonLink> : null} />
      {sum ? (
        <div className="kpis">
          <Kpi label="Bills this month" value={num(sum.billsMtd)} icon={FileText} tone="teal" note={`${inrShort(sum.billedMtd)} booked`} />
          <Kpi label="On hold · 3-way match" value={num(sum.onHold)} icon={ShieldAlert} tone="warning" note="rate or quantity variance, waiting for approval" />
          <Kpi label="Due in 7 days" value={inrShort(sum.dueIn7)} icon={CalendarClock} tone="danger" delta={`${sum.dueIn7Count} bill${sum.dueIn7Count === 1 ? '' : 's'}`} trend="flat" note={`${inrShort(sum.payable)} payable in all`} />
          <Kpi label="Input GST (MTD)" value={inrShort(sum.inputGstMtd)} icon={Percent} tone="info" note={`${inrShort(sum.paidMtd)} paid to vendors this month`} />
        </div>
      ) : <Card><Loading rows={2} /></Card>}

      <Tabs active={tab} items={[{ key: 'bills', label: 'Bills', onClick: () => setTab('bills') }, { key: 'payments', label: 'Vendor payments', onClick: () => setTab('payments') }]} />
      <ErrorBox error={error} />
      {tab === 'bills' ? (
        <DataTable
          loading={isLoading}
          toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search bill, vendor, code or invoice no…" chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }}
            right={<select className="select" style={{ width: 200, height: 36 }} value={vendor} onChange={(e) => { setVendor(e.target.value); L.setPage(1); }} aria-label="Vendor">
              <option value="">Vendor: All</option>
              {(vendors?.rows || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>} />}
          rows={data?.rows}
          rowHref={(r) => `/purchase/bills/${r.id}`}
          empty="No bills match"
          columns={[
            { key: 'number', header: 'Bill no', render: (r) => <Two a={r.number} b={date(r.billDate)} /> },
            { key: 'vendor', header: 'Vendor', render: (r) => <Two a={r.vendorName} b={r.vendorCode} /> },
            { key: 'inv', header: 'Vendor invoice', render: (r) => <Two a={<span className="num" style={{ fontWeight: 500 }}>{r.vendorInvoiceNo}</span>} b={r.vendorInvoiceDate ? dateShort(r.vendorInvoiceDate) : undefined} /> },
            { key: 'against', header: 'Against', render: (r) => <Two a={r.poNumber || <span className="muted">No PO</span>} b={r.grnNumber || undefined} /> },
            { key: 'total', header: 'Amount', align: 'right', render: (r) => <Two a={inr(r.total)} b={r.amountPaid > 0 ? `paid ${inr(r.amountPaid)}` : undefined} /> },
            { key: 'due', header: 'Due', render: (r) => <div>{dateShort(r.dueDate)}{r.overdueDays > 0 && ['Approved', 'Part paid'].includes(r.status) ? <div className="text-xs f-danger strong">{r.overdueDays} d overdue</div> : null}</div> },
            { key: 'match', header: 'Match', render: (r) => (r.matchStatus ? <Badge tone={toneOf('match', r.matchStatus)}>{r.matchStatus}</Badge> : <span className="muted">Not posted</span>) },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="pb" status={billStatus(r)} /> },
          ]}
          footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="bills" /> : null}
        />
      ) : (
        <DataTable
          loading={paysLoading}
          toolbar={<ListToolbar title="Vendor payments" sub="Bank payments and debit invoices adjusted against bills" search={L.search} onSearch={L.setSearch} placeholder="Search payment, bill, vendor or reference…" />}
          rows={pays?.rows}
          rowHref={(r) => `/purchase/bills/${r.purchaseBillId}`}
          empty="No vendor payments yet"
          columns={[
            { key: 'number', header: 'Payment', render: (r) => <Two a={r.number} b={date(r.paymentDate)} /> },
            { key: 'vendor', header: 'Vendor', render: (r) => <span className="strong">{r.vendorName}</span> },
            { key: 'bill', header: 'Bill', render: (r) => r.billNumber },
            { key: 'mode', header: 'Mode', render: (r) => <Two a={r.mode} b={r.reference || undefined} /> },
            { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="strong">{inr(r.amount, 2)}</span> },
          ]}
          footer={pays ? <Pagination page={pays.page} pageSize={pays.pageSize} total={pays.total} onPage={L.setPage} noun="payments" /> : null}
        />
      )}
    </>
  );
}
