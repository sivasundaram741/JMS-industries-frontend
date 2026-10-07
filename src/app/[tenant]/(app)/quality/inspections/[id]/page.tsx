'use client';
// Inspection lot: details, start sampling, record results (accepted to store, rejected raises an NCR),
// and the decided results with their NCRs.
import { useState } from 'react';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useParams } from 'next/navigation';
import { CircleCheck, CircleX, ClipboardCheck, Microscope, PackageCheck, TriangleAlert } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { dateTime, num } from '@/lib/format';
import { Alert, Badge, Button, Card, Chip, DataTable, ErrorBox, KeyValue, ListItem, Loading, PageHeader, StatStrip, StatusBadge, useToast } from '@/components/ui';
import { TYPE_TONE } from '../../_components/InspectionsTab';
import { ResultsForm } from './_components/ResultsForm';
import { Attachments } from '@/components/docs/Attachments';

export default function InspectionLotPage() {
  const { id } = useParams<{ id: string }>();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: lot, error, mutate } = useApi<any>(`/quality/inspections/${id}`);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await post(`/quality/inspections/${id}/start`, {});
      await mutate();
      toast.ok(`Sampling started · n = ${lot.sampleSize}`);
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  if (error) return <ErrorBox error={error} />;
  if (!lot) return <Loading rows={6} />;
  const open = ['Pending', 'In progress'].includes(lot.status);
  const editable = can('quality', 'edit');
  const sourceHref = lot.sourceType === 'GRN' ? `/warehouse/grn/${lot.sourceId}` : lot.sourceType === 'WO' ? `/production/work-orders/${lot.sourceId}` : lot.sourceType === 'NCR' ? `/quality?tab=ncr&focus=${lot.sourceId}` : null;
  const sourceLink = sourceHref ? <Link href={sourceHref}>{lot.sourceNo}</Link> : lot.sourceNo;
  const dest = lot.type === 'Incoming' ? 'RM Store' : 'FG Store';
  const decided = lot.qtyAccepted + lot.qtyRejected;
  const held = lot.ncrs.filter((n: any) => n.status !== 'Closed').reduce((a: number, n: any) => a + Number(n.qty), 0);

  return (
    <>
      <PageHeader
        back="/quality"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Quality' }, { label: 'Inspections', href: '/quality' }, { label: lot.number }]}
        title={lot.number}
        tags={<><StatusBadge kind="lot" status={lot.status} /><Chip tone={TYPE_TONE[lot.type]}>{lot.type}</Chip></>}
        sub={<>{lot.itemName} × {num(lot.qty)} {lot.uom} · {lot.type.toLowerCase()} inspection · from {sourceLink}</>}
        actions={lot.status === 'Pending' && editable ? <Button variant="primary" icon={Microscope} loading={busy} onClick={start}>Start sampling</Button> : null}
      />

      <div className="grid main-side">
        <div className="stack">
          {open ? (
            editable ? <ResultsForm key={lot.status} lot={lot} inspector={lot.inspector || user?.name || ''} onDone={() => mutate()} />
              : <Alert tone="info" title="Waiting for inspection">Quality records the results for this lot · the stock stays in QC Hold until then.</Alert>
          ) : (
            <>
              <StatStrip items={[
                { label: 'Accepted', value: `${num(lot.qtyAccepted)} ${lot.uom}`, color: 'success' },
                { label: 'Rejected', value: `${num(lot.qtyRejected)} ${lot.uom}`, color: lot.qtyRejected ? 'danger' : undefined },
                { label: 'Yield', value: decided ? `${num((lot.qtyAccepted / decided) * 100, 1)}%` : '—' },
                { label: 'Decided', value: <span className="text-sm">{dateTime(lot.completedAt)}</span> },
              ]} />
              <DataTable
                toolbar={<div className="toolbar"><div><div className="tt">Results</div><div className="ts">{lot.results.length} check{lot.results.length === 1 ? '' : 's'} · sample n = {lot.sampleSize} · {lot.inspector || '—'}</div></div></div>}
                rows={lot.results}
                empty="No checks recorded"
                columns={[
                  { key: 'c', header: 'Characteristic', render: (r) => <span className="strong">{r.characteristic}</span> },
                  { key: 's', header: 'Spec', render: (r) => r.spec || '—' },
                  { key: 'm', header: 'Measured', render: (r) => <span className="num">{r.measured || '—'}</span> },
                  { key: 'ok', header: 'Result', render: (r) => (r.ok ? <Badge tone="success">OK</Badge> : <Badge tone="danger">Not OK</Badge>) },
                ]}
                footer={lot.remarks ? <div className="tfoot"><span>Remarks · {lot.remarks}</span></div> : null}
              />
            </>
          )}
        </div>

        <div className="stack">
          <Card title="Lot details">
            <KeyValue items={[
              ['Lot no', lot.lotNo || '—'],
              ['Sample size', `n = ${num(lot.sampleSize)}`],
              ['Item', <span key="i">{lot.itemName}<div className="text-xs muted" style={{ fontWeight: 400 }}>{lot.itemCode}</div></span>],
              ['Quantity', `${num(lot.qty)} ${lot.uom}`],
              ['Inspector', lot.inspector || (open ? 'Not started' : '—')],
              ['Source', sourceLink],
              ['Customer order', lot.salesOrderNo ? <Link key="so" href={`/sales/orders/${lot.salesOrderId}`}>{lot.salesOrderNo}</Link> : '—'],
              ['Raised', dateTime(lot.createdAt)],
            ]} />
          </Card>

          <Card title="Where the stock goes">
            <div className="list">
              <ListItem icon={ClipboardCheck} tone="warning" title="Now in QC Hold" sub={open ? `${num(lot.qty)} ${lot.uom} waiting for a decision` : held ? `${num(held)} ${lot.uom} held for NCR disposition` : 'Nothing left in QC Hold from this lot'} />
              <ListItem icon={PackageCheck} tone="success" title={`Accepted → ${dest}`} sub={open ? `Moves as soon as results are saved` : `${num(lot.qtyAccepted)} ${lot.uom} moved`} />
              <ListItem icon={TriangleAlert} tone="danger" title="Rejected → NCR" sub="Stays in QC Hold until its disposition" />
            </div>
          </Card>

          <Card title="NCRs" sub={lot.ncrs.length ? 'Raised for the rejected quantity' : undefined}>
            <div className="list">
              {lot.ncrs.length ? lot.ncrs.map((n: any) => (
                <ListItem key={n.id} icon={n.status === 'Closed' ? CircleCheck : CircleX} tone={n.status === 'Closed' ? 'success' : 'danger'}
                  title={`${n.number} · ${num(n.qty)} ${lot.uom}`} sub={`${n.defect} · ${n.stage}${n.disposition !== 'Pending' ? ' · ' + n.disposition : ''}`}
                  right={<StatusBadge kind="ncr" status={n.status} />} href={`/quality?tab=ncr&focus=${n.id}`} />
              )) : <div className="text-sm muted">{open ? 'Raised if any quantity is rejected' : 'None · nothing rejected'}</div>}
            </div>
          </Card>
          <Attachments entityType="IL" entityId={lot.id} entityNo={lot.number} />
        </div>
      </div>
    </>
  );
}
