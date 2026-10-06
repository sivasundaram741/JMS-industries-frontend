'use client';
// Inspections tab: stage tracker, quality KPIs and every inspection lot with type and status filters.
import { useState } from 'react';
import { BadgeCheck, ClipboardCheck, Hourglass, TriangleAlert } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useApi, useListState } from '@/lib/hooks';
import { dateShort, num } from '@/lib/format';
import type { Tone } from '@/lib/status';
import { Chip, DataTable, ErrorBox, Kpi, ListToolbar, Pagination, StatusBadge, Two } from '@/components/ui';
import { StageTracker } from '@/components/StageTracker';

const TYPES = [{ key: '', label: 'All types' }, { key: 'Incoming', label: 'Incoming' }, { key: 'Final', label: 'Final' }, { key: 'In-process', label: 'In-process' }];
const STATUS = [
  { key: '', label: 'All' }, { key: 'Pending,In progress', label: 'Open' },
  { key: 'Accepted,Accepted w/ deviation,Partially accepted', label: 'Accepted' }, { key: 'Rejected', label: 'Rejected' },
];
export const TYPE_TONE: Record<string, Tone> = { Incoming: 'teal', Final: 'info', 'In-process': 'purple' };

export function InspectionsTab({ summary }: { summary?: { lotsPending: number; firstPassYield: number; openNcrs: number; inspected30d: number } }) {
  const L = useListState();
  const [type, setType] = useState('');
  const { data, error, isLoading } = useApi<Page<any>>('/quality/inspections' + qs({ ...L.params, type: type || undefined }));
  return (
    <>
      <StageTracker stage="quality" />
      <div className="kpis">
        <Kpi label="Lots pending" value={summary ? num(summary.lotsPending) : '—'} icon={Hourglass} tone="warning" note="waiting for sampling or results" />
        <Kpi label="First-pass yield" value={summary ? `${num(summary.firstPassYield, 1)}%` : '—'} icon={BadgeCheck} tone="success" note="accepted first time · last 30 days" />
        <Kpi label="Open NCRs" value={summary ? num(summary.openNcrs) : '—'} icon={TriangleAlert} tone="danger" note="waiting for disposition" href="/quality?tab=ncr" />
        <Kpi label="Inspected in 30 days" value={summary ? `${num(summary.inspected30d)} pcs` : '—'} icon={ClipboardCheck} tone="info" note="accepted + rejected" />
      </div>
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={
          <ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search lot, item, source…" chips={{ options: STATUS, value: L.status, onChange: L.setStatus }}
            right={<div className="chips" role="group" aria-label="Inspection type">{TYPES.map((t) => <button key={t.key} type="button" className={t.key === type ? 'on' : ''} onClick={() => { setType(t.key); L.setPage(1); }}>{t.label}</button>)}</div>} />
        }
        rows={data?.rows}
        rowHref={(r) => `/quality/inspections/${r.id}`}
        empty="No inspection lots match"
        columns={[
          { key: 'number', header: 'Lot', render: (r) => <Two a={r.number} b={`${r.lotNo ? 'lot ' + r.lotNo + ' · ' : ''}${dateShort(r.createdAt)}`} /> },
          { key: 'item', header: 'Item', render: (r) => <Two a={r.itemName} b={r.itemCode} /> },
          { key: 'type', header: 'Type', render: (r) => <Chip tone={TYPE_TONE[r.type]}>{r.type}</Chip> },
          { key: 'source', header: 'Source', render: (r) => <span className="nowrap">{r.sourceNo}</span> },
          { key: 'qty', header: 'Qty', align: 'right', render: (r) => <span className="nowrap">{num(r.qty)} {r.uom}</span> },
          { key: 'sample', header: 'Sample', align: 'right', render: (r) => <span className="nowrap">n = {num(r.sampleSize)}</span> },
          { key: 'inspector', header: 'Inspector', render: (r) => r.inspector || <span className="muted">—</span> },
          {
            key: 'result', header: 'Result', render: (r) => (
              <div className="stack" style={{ gap: 2 }}>
                <span><StatusBadge kind="lot" status={r.status} /></span>
                {r.qtyRejected > 0 ? <span className="text-xs muted nowrap">{num(r.qtyAccepted)} ok · {num(r.qtyRejected)} rejected</span> : null}
              </div>
            ),
          },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="lots" /> : null}
      />
    </>
  );
}
