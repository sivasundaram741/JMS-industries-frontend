'use client';
// Dispatch & Delivery: orders with finished stock waiting to ship, and every shipment moving through
// Pick → Pack → Challan → Loaded → In transit → Delivered → Acknowledged.
import { Plus, Truck } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, num, todayIso } from '@/lib/format';
import { Badge, ButtonLink, DataTable, ErrorBox, ListToolbar, PageHeader, Pagination, StatusBadge, Trail, Two } from '@/components/ui';
import { StageTracker } from '@/components/StageTracker';

const FILTERS = [
  { key: '', label: 'All' }, { key: 'Pick,Pack', label: 'Picking' }, { key: 'Challan,Loaded', label: 'Loading' },
  { key: 'In transit', label: 'In transit' }, { key: 'Delivered,Acknowledged', label: 'Delivered' },
];

interface ReadyLine { id: number; itemCode: string; itemName: string; uom: string; qty: number; qtyDispatched: number; qtyOpen: number; fgStock: number }
interface ReadyOrder { id: number; number: string; promisedDate: string | null; customerName: string; lines: ReadyLine[] }

export default function DispatchPage() {
  const { user, can } = useAuth();
  const L = useListState();
  const { data, error, isLoading } = useApi<Page<any>>('/shipments' + qs(L.params));
  const { data: ready, isLoading: readyLoading } = useApi<ReadyOrder[]>('/shipments/ready');
  const today = todayIso();

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Dispatch' }, { label: 'Dispatch & Delivery' }]}
        title="Dispatch & Delivery"
        sub="Pick and pack against the customer order, delivery challan, transport and customer acknowledgement"
        actions={can('dispatch', 'create') ? <ButtonLink href="/dispatch/new" variant="primary" icon={Plus}>New shipment</ButtonLink> : null}
      />
      <StageTracker stage="dispatch" />
      <ErrorBox error={error} />

      <DataTable
        loading={readyLoading}
        toolbar={<div className="toolbar"><div><div className="tt">Ready to ship</div><div className="ts">Released orders with quantity still to ship · finished stock in FG Store now</div></div></div>}
        rows={ready}
        empty="Nothing waiting to ship"
        columns={[
          { key: 'number', header: 'Customer order', width: 220, render: (o) => <Two a={o.number} b={o.customerName} /> },
          { key: 'promised', header: 'Promised', width: 120, render: (o) => <span className={o.promisedDate && o.promisedDate < today ? 'f-danger strong' : ''}>{date(o.promisedDate)}</span> },
          {
            key: 'lines', header: 'Lines · open · in FG Store', render: (o) => (
              <div className="stack tight" style={{ gap: 4 }}>
                {o.lines.map((l) => (
                  <div key={l.id} className="row" style={{ gap: 8 }}>
                    <span className="strong">{l.itemCode}</span>
                    <span className="muted truncate" style={{ maxWidth: 200 }}>{l.itemName}</span>
                    <span className="secondary num">{num(l.qtyOpen)} {l.uom} open</span>
                    <Badge tone={l.fgStock <= 0 ? 'neutral' : l.fgStock >= l.qtyOpen ? 'success' : 'warning'}>{num(l.fgStock)} in FG</Badge>
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'can', header: 'Can ship now', align: 'right', render: (o) => {
              const n = o.lines.reduce((a, l) => a + Math.max(0, Math.min(l.qtyOpen, l.fgStock)), 0);
              return n > 0 ? <span className="strong">{num(n)}</span> : <span className="muted">Waiting for FG</span>;
            },
          },
          {
            key: 'act', header: '', align: 'right', width: 170, render: (o) => {
              const shippable = o.lines.some((l) => l.fgStock > 0);
              return can('dispatch', 'create') ? <ButtonLink href={`/dispatch/new?so=${o.id}`} size="sm" variant={shippable ? 'primary' : 'secondary'} icon={Truck}>Create shipment</ButtonLink> : null;
            },
          },
        ]}
      />

      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar title="Shipments" search={L.search} onSearch={L.setSearch} placeholder="Search challan, customer, order, vehicle…" chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }} />}
        rows={data?.rows}
        rowHref={(r) => `/dispatch/${r.id}`}
        empty="No shipments match"
        columns={[
          { key: 'number', header: 'DC number', render: (r) => <Two a={r.number} b={r.transporter || undefined} /> },
          { key: 'customer', header: 'Customer', render: (r) => <Two a={r.customerName} b={r.customerCity} /> },
          { key: 'order', header: 'Order', render: (r) => <span className="secondary">{r.salesOrderNo}</span> },
          { key: 'items', header: 'Items', render: (r) => <span className="secondary">{r.itemsText || '—'}</span> },
          { key: 'planned', header: 'Planned', render: (r) => <span className={r.late ? 'f-danger strong' : ''}>{date(r.plannedDate)}</span> },
          { key: 'vehicle', header: 'Vehicle', render: (r) => (r.vehicleNo ? <span className="chip">{r.vehicleNo}</span> : <span className="muted">—</span>) },
          { key: 'trail', header: 'Progress', render: (r) => <Trail n={7} current={r.stepIndex} tone="info" done={r.status === 'Acknowledged'} width={130} /> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="ship" status={r.status} /> },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="shipments" /> : null}
      />
    </>
  );
}
