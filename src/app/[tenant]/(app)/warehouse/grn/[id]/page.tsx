'use client';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useParams } from 'next/navigation';
import { ClipboardCheck, Receipt } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, dateTime, num } from '@/lib/format';
import { toneOf } from '@/lib/status';
import { JobLink } from '@/components/JobLink';
import { ButtonLink, Card, DataTable, ErrorBox, KeyValue, ListItem, Loading, PageHeader, StatStrip, StatusBadge, Two } from '@/components/ui';
import { Attachments } from '@/components/docs/Attachments';

export default function GrnPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: g, error } = useApi<any>(`/grns/${id}`);

  if (error) return <ErrorBox error={error} />;
  if (!g) return <Loading rows={6} />;

  const lotOf = (lineId: number) => g.inspections.find((i: any) => i.grnLineId === lineId);
  const qty = g.lines.reduce((a: number, l: any) => a + l.qty, 0);
  const acc = g.lines.reduce((a: number, l: any) => a + l.qtyAccepted, 0);
  const rej = g.lines.reduce((a: number, l: any) => a + l.qtyRejected, 0);
  const pending = g.inspections.filter((i: any) => ['Pending', 'In progress'].includes(i.status)).length;

  return (
    <>
      <PageHeader
        back="/warehouse/grn"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Warehouse' }, { label: 'GRN & Stock Entry', href: '/warehouse/grn' }, { label: g.number }]}
        title={g.number}
        tags={<StatusBadge kind="grn" status={g.status} />}
        sub={`${g.vendorName} · against ${g.poNumber} · received ${date(g.receivedDate)}`}
        actions={<ButtonLink href={`/purchase/orders/${g.purchaseOrderId}`} icon={Receipt}>Open {g.poNumber}</ButtonLink>}
      />
      <JobLink woId={g.workOrderId} role="Received for job" />
      <StatStrip items={[
        { label: 'Received', value: num(qty, 3) },
        { label: 'Accepted', value: num(acc, 3), color: acc ? 'success' : undefined },
        { label: 'Rejected', value: num(rej, 3), color: rej ? 'danger' : undefined },
        { label: 'Inspection lots', value: num(g.inspections.length), tag: pending ? `${pending} pending` : undefined, tone: 'warning' },
      ]} />
      <div className="grid main-side">
        <div className="stack">
          <DataTable
            toolbar={<div className="toolbar"><div><div className="tt">Items received</div><div className="ts">Held in QC Hold until the incoming inspection accepts them</div></div></div>}
            rows={g.lines}
            columns={[
              { key: 'item', header: 'Item', render: (l) => <Two a={l.itemName} b={l.itemCode} /> },
              { key: 'qty', header: 'Qty', align: 'right', render: (l) => <span className="nowrap"><span className="strong">{num(l.qty, 3)}</span> <span className="muted">{l.uom}</span></span> },
              { key: 'lot', header: 'Lot / heat no', render: (l) => <span className="chip">{l.lotNo || '—'}</span> },
              { key: 'acc', header: 'Accepted', align: 'right', render: (l) => <span className={l.qtyAccepted ? 'f-success strong' : 'muted'}>{num(l.qtyAccepted, 3)}</span> },
              { key: 'rej', header: 'Rejected', align: 'right', render: (l) => <span className={l.qtyRejected ? 'f-danger strong' : 'muted'}>{num(l.qtyRejected, 3)}</span> },
              { key: 'il', header: 'Inspection', render: (l) => { const il = lotOf(l.id); return il ? <Link href={`/quality/inspections/${il.id}`}>{il.number}</Link> : '—'; } },
            ]}
          />
          <Card title="Inspection lots" sub="One incoming inspection lot per line">
            <div className="list">
              {g.inspections.length ? g.inspections.map((i: any) => {
                const line = g.lines.find((l: any) => l.id === i.grnLineId);
                return (
                  <ListItem key={i.id} icon={ClipboardCheck} tone={toneOf('lot', i.status)} title={`${i.number}${line ? ' · ' + line.itemName : ''}`}
                    sub={i.qtyAccepted || i.qtyRejected ? `${num(i.qtyAccepted, 3)} accepted · ${num(i.qtyRejected, 3)} rejected` : `${line ? num(line.qty, 3) + ' ' + line.uom + ' · ' : ''}waiting for inspection`}
                    right={<StatusBadge kind="lot" status={i.status} />} href={`/quality/inspections/${i.id}`} />
                );
              }) : <div className="empty text-sm">No inspection lots</div>}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Receipt details">
            <KeyValue cols={1} items={[
              ['Vendor', g.vendorName],
              ['Purchase order', <Link key="po" href={`/purchase/orders/${g.purchaseOrderId}`}>{g.poNumber}</Link>],
              ['Received date', date(g.receivedDate)],
              ['Vendor invoice', g.vendorInvoiceNo],
              ['Vehicle', g.vehicleNo],
              ['Recorded', dateTime(g.createdAt)],
            ]} />
          </Card>
          <Attachments entityType="GRN" entityId={g.id} entityNo={g.number} />
        </div>
      </div>
    </>
  );
}
