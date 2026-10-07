'use client';
import { useState } from 'react';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useRouter } from 'next/navigation';
import { PackagePlus, Receipt } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState, useTenantHref } from '@/lib/hooks';
import { date, dateShort, num } from '@/lib/format';
import { Button, DataTable, ErrorBox, ListItem, ListToolbar, Loading, Modal, PageHeader, Pagination, ProgressBar, StatusBadge, Two } from '@/components/ui';

const FILTERS = [
  { key: '', label: 'All' }, { key: 'Pending QC', label: 'Pending QC' }, { key: 'Accepted', label: 'Accepted' },
  { key: 'Partially accepted', label: 'Partially accepted' }, { key: 'Rejected', label: 'Rejected' },
];

export default function GrnListPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const L = useListState();
  const { data, error, isLoading } = useApi<Page<any>>('/grns' + qs(L.params));
  const [pick, setPick] = useState(false);
  const { data: open } = useApi<Page<any>>(pick ? '/purchase-orders?status=Sent,Acknowledged,Partially%20received&pageSize=100' : null);

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Warehouse' }, { label: 'GRN & Stock Entry' }]}
        title="GRN & Stock Entry"
        sub="Goods received against purchase and job-work orders · stock waits in QC Hold for incoming inspection"
        actions={can('stockentry', 'create') ? <Button variant="primary" icon={PackagePlus} onClick={() => setPick(true)}>Receive against PO</Button> : null}
      />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search GRN, PO, vendor, invoice…" chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }} />}
        rows={data?.rows}
        rowHref={(r) => `/warehouse/grn/${r.id}`}
        empty="No goods receipts match"
        columns={[
          { key: 'number', header: 'GRN', render: (r) => <Two a={r.number} b={r.vehicleNo || undefined} /> },
          { key: 'vendor', header: 'Vendor', render: (r) => <span className="strong">{r.vendorName}</span> },
          { key: 'po', header: 'PO', render: (r) => <Link href={`/purchase/orders/${r.purchaseOrderId}`} onClick={(e) => e.stopPropagation()}>{r.poNumber}</Link> },
          { key: 'items', header: 'Items', render: (r) => <span className="secondary">{r.itemsText || '—'}</span> },
          { key: 'date', header: 'Received', render: (r) => <span className="nowrap">{date(r.receivedDate)}</span> },
          { key: 'inv', header: 'Vendor invoice', render: (r) => <span className="num">{r.vendorInvoiceNo || '—'}</span> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="grn" status={r.status} /> },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="goods receipts" /> : null}
      />
      <Modal open={pick} onClose={() => setPick(false)} title="Receive against a purchase order" sub="Orders sent to the vendor with quantity still to come · pick one to record the GRN" wide
        footer={<Button onClick={() => setPick(false)}>Close</Button>}>
        {!open ? <Loading rows={4} /> : open.rows.length ? (
          <div className="list">
            {open.rows.map((p: any) => (
              <ListItem key={p.id} icon={Receipt} tone={p.late ? 'danger' : p.type === 'JOB_WORK' ? 'purple' : 'teal'}
                title={<span>{p.number} · {p.vendorName}{p.late ? <span className="f-danger"> · late</span> : null}</span>}
                sub={`${p.itemsText} · need by ${dateShort(p.needBy)}${p.workOrderNo ? ' · ' + p.workOrderNo : ''}`}
                right={<div className="row" style={{ gap: 12 }}><ProgressBar pct={p.qtyOrdered ? (p.qtyReceived / p.qtyOrdered) * 100 : 0} tone="teal" width={170} label={`${num(p.qtyReceived)} / ${num(p.qtyOrdered)}`} /><StatusBadge kind="po" status={p.status} /></div>}
                onClick={() => router.push(tenantHref(`/purchase/orders/${p.id}?receive=1`))} />
            ))}
          </div>
        ) : <div className="empty text-sm">No purchase orders are waiting for goods</div>}
      </Modal>
    </>
  );
}
