'use client';
// Purchase order list, shared by Purchase Orders (type PO) and Subcontracting (type JOB_WORK)
import { Plus } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, inr, inrShort, num } from '@/lib/format';
import { ButtonLink, DataTable, ErrorBox, ListToolbar, PageHeader, Pagination, ProgressBar, StatStrip, StatusBadge, Two } from '@/components/ui';
import type { Column } from '@/components/ui';
import { StageTracker } from '@/components/StageTracker';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'Draft,Pending approval', label: 'To approve' },
  { key: 'Approved,Sent,Acknowledged', label: 'Open' },
  { key: 'Partially received', label: 'Partially received' },
  { key: 'Received', label: 'Received' },
  { key: 'Billed', label: 'Billed' },
];

const AWAITING = ['Sent', 'Acknowledged', 'Partially received'];

export function PoList({ type }: { type: 'PO' | 'JOB_WORK' }) {
  const { user, can } = useAuth();
  const L = useListState();
  const jw = type === 'JOB_WORK';
  const { data, error, isLoading } = useApi<Page<any>>('/purchase-orders' + qs({ ...L.params, type }));
  const { data: open } = useApi<Page<any>>(`/purchase-orders?type=${type}&open=1&pageSize=200`);

  const rows = open?.rows || [];
  const toApprove = rows.filter((r) => ['Draft', 'Pending approval'].includes(r.status)).length;
  const awaiting = rows.filter((r) => AWAITING.includes(r.status));
  const late = rows.filter((r) => r.late).length;
  const openValue = rows.reduce((a, r) => a + (r.total || 0), 0);
  const atVendor = awaiting.reduce((a, r) => a + Math.max(0, r.qtyOrdered - r.qtyReceived), 0);

  const canCreate = jw ? can('subcon', 'create') || can('purchase', 'create') : can('purchase', 'create');
  const page = jw ? 'Subcontracting' : 'Purchase Orders';

  const columns: Column<any>[] = [
    { key: 'number', header: jw ? 'Job work' : 'PO', render: (r) => <Two a={r.number} b={jw ? undefined : r.workOrderNo ? 'For ' + r.workOrderNo : undefined} /> },
    { key: 'vendor', header: 'Vendor', render: (r) => <span className="strong">{r.vendorName}</span> },
    ...(jw ? [{ key: 'wo', header: 'Work order', render: (r: any) => (r.workOrderNo ? <span className="chip">{r.workOrderNo}</span> : '—') }] : []),
    { key: 'items', header: jw ? 'Process' : 'Items', render: (r) => <span className="secondary">{r.itemsText || '—'}</span> },
    { key: 'orderDate', header: 'Ordered', render: (r) => <span className="nowrap">{date(r.orderDate)}</span> },
    { key: 'needBy', header: jw ? 'Due back' : 'Need by', render: (r) => <span className={'nowrap' + (r.late ? ' f-danger strong' : '')}>{date(r.needBy)}</span> },
    { key: 'total', header: 'Value', align: 'right', render: (r) => inr(r.total) },
    { key: 'received', header: jw ? 'Returned' : 'Received', render: (r) => <ProgressBar pct={r.qtyOrdered ? (r.qtyReceived / r.qtyOrdered) * 100 : 0} tone={r.qtyReceived >= r.qtyOrdered && r.qtyOrdered ? 'success' : 'teal'} label={`${num(r.qtyReceived)} / ${num(r.qtyOrdered)}`} /> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="po" status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Purchase' }, { label: page }]}
        title={page}
        sub={jw ? 'Job-work orders · material at vendors and returns' : 'Requisition → approval → PO → GRN → vendor bill'}
        actions={canCreate ? <ButtonLink href={jw ? '/purchase/orders/new?type=JOB_WORK' : '/purchase/orders/new'} variant="primary" icon={Plus}>{jw ? 'New job work' : 'New purchase order'}</ButtonLink> : null}
      />
      <StageTracker stage="purchase" />
      <StatStrip items={jw ? [
        { label: 'Open job work', value: open ? num(open.total) : '—' },
        { label: 'To approve', value: num(toApprove), tag: toApprove ? 'Action' : undefined, tone: 'warning' },
        { label: 'Orders at vendors', value: num(awaiting.length) },
        { label: 'Pieces to come back', value: num(atVendor) },
        { label: 'Late returns', value: num(late), color: late ? 'danger' : undefined },
      ] : [
        { label: 'Open orders', value: open ? num(open.total) : '—' },
        { label: 'To approve', value: num(toApprove), tag: toApprove ? 'Action' : undefined, tone: 'warning' },
        { label: 'Awaiting goods', value: num(awaiting.length) },
        { label: 'Late deliveries', value: num(late), color: late ? 'danger' : undefined },
        { label: 'Open value', value: inrShort(openValue) },
      ]} />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder={jw ? 'Search job work or vendor…' : 'Search PO number or vendor…'} chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }} />}
        rows={data?.rows}
        rowHref={(r) => `/purchase/orders/${r.id}`}
        empty={jw ? 'No job-work orders match' : 'No purchase orders match'}
        columns={columns}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun={jw ? 'job-work orders' : 'purchase orders'} /> : null}
      />
    </>
  );
}
