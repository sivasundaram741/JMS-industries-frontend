'use client';
// Warehouse · Stock Returns: stock moved back between locations (shop floor → RM store, FG → QC…) through In transit,
// with the condition of every line. Damaged goods go to QC Hold on receipt.
import { useState } from 'react';
import { ArrowRight, Boxes, PackageX, Plus, Truck, Undo2 } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, num } from '@/lib/format';
import { ButtonLink, Card, Chip, DataTable, ErrorBox, Kpi, ListToolbar, Loading, PageHeader, Pagination, StatusBadge, Two } from '@/components/ui';

const FILTERS = [{ key: '', label: 'All' }, { key: 'Draft', label: 'Draft' }, { key: 'In transit', label: 'In transit' }, { key: 'Received', label: 'Received' }, { key: 'Cancelled', label: 'Cancelled' }];
interface Summary { returnsMtd: number; unitsMtd: number; damagedPct: number; inTransit: number; reasons: string[] }

export default function StockReturnsPage() {
  const { user, can } = useAuth();
  const L = useListState();
  const [reason, setReason] = useState('');
  const { data, error, isLoading } = useApi<Page<any>>('/stock-returns' + qs({ ...L.params, reason: reason || undefined }));
  const { data: sum } = useApi<Summary>('/stock-returns/summary');

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Warehouse' }, { label: 'Stock Returns' }]} title="Stock Returns"
        sub="Stock sent back between locations · leaves the source at once, waits in transit, and lands by condition on receipt"
        actions={can('stockreturns', 'create') ? <ButtonLink variant="primary" icon={Plus} href="/warehouse/returns/new">New stock return</ButtonLink> : null} />
      {sum ? (
        <div className="kpis">
          <Kpi label="Returns (MTD)" value={num(sum.returnsMtd)} icon={Undo2} tone="warning" note="raised this month" />
          <Kpi label="Units returned" value={num(sum.unitsMtd)} icon={Boxes} tone="info" note="this month" />
          <Kpi label="Damaged / expired" value={`${sum.damagedPct}%`} icon={PackageX} tone="danger" note="of units · go to QC Hold" />
          <Kpi label="In transit" value={num(sum.inTransit)} icon={Truck} tone="purple" note="waiting to be received" />
        </div>
      ) : <Card><Loading rows={2} /></Card>}
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search return no, reason, requested by…" chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }}
          right={<select className="select" style={{ width: 190, height: 36 }} value={reason} onChange={(e) => { setReason(e.target.value); L.setPage(1); }} aria-label="Reason">
            <option value="">Reason: All</option>
            {(sum?.reasons || []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>} />}
        rows={data?.rows}
        rowHref={(r) => `/warehouse/returns/${r.id}`}
        empty="No stock returns match"
        columns={[
          { key: 'number', header: 'Return', render: (r) => <Two a={r.number} b={date(r.returnDate)} /> },
          { key: 'route', header: 'From → To', render: (r) => <span className="row nowrap" style={{ gap: 6 }}><span>{r.fromName}</span><ArrowRight size={14} className="muted" /><span>{r.toName}</span></span> },
          { key: 'products', header: 'Products', align: 'right', render: (r) => <Two a={num(r.products)} b={`${num(r.units)} units`} /> },
          { key: 'reason', header: 'Reason', render: (r) => <Chip>{r.reason}</Chip> },
          { key: 'by', header: 'Requested by', render: (r) => <span className="secondary">{r.requestedBy || '—'}</span> },
          { key: 'vehicle', header: 'Vehicle / challan', render: (r) => (r.vehicleNo || r.challanNo ? <Two a={r.vehicleNo || '—'} b={r.challanNo || undefined} /> : <span className="muted">—</span>) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="sr" status={r.status} /> },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="returns" /> : null}
      />
    </>
  );
}
