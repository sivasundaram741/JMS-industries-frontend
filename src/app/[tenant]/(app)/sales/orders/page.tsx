'use client';
import { Plus } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, inr, inrShort, num } from '@/lib/format';
import { ButtonLink, DataTable, ErrorBox, ListToolbar, PageHeader, Pagination, ProgressBar, StatStrip, StatusBadge, Two } from '@/components/ui';
import { StageTracker } from '@/components/StageTracker';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'Received,Credit hold,Credit OK,Quoted', label: 'New' },
  { key: 'Credit hold', label: 'Credit hold' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'Released', label: 'In production' },
  { key: 'Dispatched,Invoiced', label: 'Dispatched' },
  { key: 'Closed', label: 'Closed' },
];

export default function SalesOrdersPage() {
  const { user, can } = useAuth();
  const L = useListState();
  const { data, error, isLoading } = useApi<Page<any>>('/sales-orders' + qs(L.params));
  const { data: open } = useApi<Page<any>>('/sales-orders?open=1&pageSize=200');

  const rows = open?.rows || [];
  const late = rows.filter((r: any) => r.late).length;
  const inProd = rows.filter((r: any) => r.status === 'Released').length;
  const toConfirm = rows.filter((r: any) => ['Received', 'Credit OK', 'Credit hold', 'Quoted'].includes(r.status)).length;
  const openValue = rows.reduce((a: number, r: any) => a + (r.total || 0), 0);

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Sales' }, { label: 'Customer Orders' }]}
        title="Customer Orders"
        sub="Receive, check credit, confirm and release orders to production"
        actions={can('sales', 'create') ? <ButtonLink href="/sales/orders/new" variant="primary" icon={Plus}>New customer order</ButtonLink> : null}
      />
      <StageTracker stage="sales" />
      <StatStrip items={[
        { label: 'Open orders', value: open ? num(open.total) : '—' },
        { label: 'To confirm', value: num(toConfirm), tag: toConfirm ? 'Action' : undefined, tone: 'warning' },
        { label: 'In production', value: num(inProd) },
        { label: 'Late deliveries', value: num(late), color: late ? 'danger' : undefined },
        { label: 'Open value', value: inrShort(openValue) },
      ]} />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search order, customer, PO…" chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }} />}
        rows={data?.rows}
        rowHref={(r) => `/sales/orders/${r.id}`}
        empty="No customer orders match"
        columns={[
          { key: 'number', header: 'Order', render: (r) => <Two a={r.number} b={r.customerPo ? 'PO ' + r.customerPo : undefined} /> },
          { key: 'customer', header: 'Customer', render: (r) => <Two a={r.customerName} b={r.customerCity} /> },
          { key: 'items', header: 'Items', render: (r) => <span className="secondary">{r.itemsText}</span> },
          { key: 'orderDate', header: 'Ordered', render: (r) => date(r.orderDate) },
          { key: 'promisedDate', header: 'Promised', render: (r) => <span className={r.late ? 'f-danger strong' : ''}>{date(r.promisedDate)}</span> },
          { key: 'total', header: 'Value', align: 'right', render: (r) => inr(r.total) },
          { key: 'dispatched', header: 'Dispatched', render: (r) => <ProgressBar pct={r.qtyOrdered ? (r.qtyDispatched / r.qtyOrdered) * 100 : 0} tone="teal" label={`${num(r.qtyDispatched)} / ${num(r.qtyOrdered)}`} /> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="so" status={r.status} /> },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="orders" /> : null}
      />
    </>
  );
}
