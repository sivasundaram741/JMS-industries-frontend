'use client';
// Invoicing & Payments: invoices raised on delivery, what is due and overdue, and payments received.
import { FileText, HandCoins, Landmark, TriangleAlert, Wallet } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, inr, inrShort } from '@/lib/format';
import { Card, DataTable, ErrorBox, Kpi, ListItem, ListToolbar, Loading, PageHeader, Pagination, StatusBadge, Two } from '@/components/ui';
import { StageTracker } from '@/components/StageTracker';

const FILTERS = [
  { key: '', label: 'All' }, { key: 'Open', label: 'Open' }, { key: 'Overdue', label: 'Overdue' }, { key: 'Part paid', label: 'Part paid' }, { key: 'Paid', label: 'Paid' },
];

interface Summary { invoicedMtd: number; receivedMtd: number; outstanding: number; overdue: number; overdueCount: number }

export default function FinancePage() {
  const { user, can } = useAuth();
  const L = useListState();
  const { data, error, isLoading } = useApi<Page<any>>('/finance/invoices' + qs(L.params));
  const { data: sum } = useApi<Summary>('/finance/invoices/summary');
  const { data: pays } = useApi<Page<any>>(can('finance') ? '/finance/payments?pageSize=6' : null);

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Finance' }, { label: 'Invoicing & Payments' }]}
        title="Invoicing & Payments"
        sub="Invoices raised on delivery, payments received and what is still due"
      />
      <StageTracker stage="finance" />
      <ErrorBox error={error} />
      {sum ? (
        <div className="kpis">
          <Kpi label="Invoiced (MTD)" value={inrShort(sum.invoicedMtd)} icon={FileText} tone="teal" note="raised on delivery this month" />
          <Kpi label="Received (MTD)" value={inrShort(sum.receivedMtd)} icon={HandCoins} tone="info" note="payments recorded this month" />
          <Kpi label="Outstanding" value={inrShort(sum.outstanding)} icon={Landmark} tone="warning" note="balance on open invoices" />
          <Kpi label="Overdue" value={inrShort(sum.overdue)} icon={TriangleAlert} tone="danger" delta={`${sum.overdueCount} invoice${sum.overdueCount === 1 ? '' : 's'}`} trend={sum.overdueCount ? 'up' : 'flat'} good={false} note="past due date" />
        </div>
      ) : <Card><Loading rows={2} /></Card>}

      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar title="Invoices" search={L.search} onSearch={L.setSearch} placeholder="Search invoice, customer, order…" chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }} />}
        rows={data?.rows}
        rowHref={(r) => `/finance/invoices/${r.id}`}
        empty="No invoices match"
        columns={[
          { key: 'number', header: 'Invoice', render: (r) => <Two a={r.number} b={r.shipmentNo || undefined} /> },
          { key: 'customer', header: 'Customer', render: (r) => <span className="strong">{r.customerName}</span> },
          { key: 'order', header: 'Order', render: (r) => <span className="secondary">{r.salesOrderNo}</span> },
          { key: 'date', header: 'Date', render: (r) => date(r.invoiceDate) },
          { key: 'due', header: 'Due', render: (r) => <div>{date(r.dueDate)}{r.overdueDays > 0 ? <div className="text-xs f-danger strong">{r.overdueDays} d overdue</div> : null}</div> },
          { key: 'total', header: 'Total', align: 'right', render: (r) => inr(r.total) },
          { key: 'paid', header: 'Paid', align: 'right', render: (r) => <span className="secondary">{inr(r.amountPaid)}</span> },
          { key: 'balance', header: 'Balance', align: 'right', render: (r) => <span className={r.balance > 0 ? (r.overdueDays > 0 ? 'f-danger strong' : 'strong') : 'muted'}>{inr(r.balance)}</span> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="inv" status={r.displayStatus} /> },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="invoices" /> : null}
      />

      {can('finance') ? <Card title="Recent payments" sub="Receipts recorded against invoices">
        {!pays ? <Loading rows={3} /> : pays.rows.length ? (
          <div className="grid cols-2" style={{ gap: '0 32px' }}>
            {[pays.rows.slice(0, Math.ceil(pays.rows.length / 2)), pays.rows.slice(Math.ceil(pays.rows.length / 2))].map((col, i) => (
              <div key={i} className="list">
                {col.map((p: any) => (
                  <ListItem key={p.id} icon={Wallet} tone="success" title={`${inr(p.amount)} · ${p.customerName}`} sub={`${p.number} · ${p.invoiceNo} · ${p.mode}${p.reference ? ' ' + p.reference : ''} · ${date(p.paymentDate)}`} href={`/finance/invoices/${p.invoiceId}`} />
                ))}
              </div>
            ))}
          </div>
        ) : <div className="empty text-sm">No payments recorded yet</div>}
      </Card> : null}
    </>
  );
}
