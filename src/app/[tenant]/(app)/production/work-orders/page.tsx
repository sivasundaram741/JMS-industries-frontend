'use client';
// Work orders: every job with where it is on its route, which of the four flows it takes, how much is made and
// when it is due. Filter by status, by flow, or search.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, num } from '@/lib/format';
import { WO_STATUSES, toneOf } from '@/lib/status';
import { FLOWS, flowsOf, type FlowKey } from '@/lib/workorder';
import { ButtonLink, DataTable, ErrorBox, ListToolbar, PageHeader, Pagination, ProgressBar, StatusBadge } from '@/components/ui';
import { MiniRoute } from '@/components/RouteCard';

const OPEN = 'Planned,Released,In Progress,On Hold,In Assembly';

export default function WorkOrdersPage() {
  const { user, can } = useAuth();
  const sp = useSearchParams();
  const L = useListState({ status: OPEN });
  const [flow, setFlow] = useState<FlowKey | ''>('');
  const { data, error, isLoading } = useApi<Page<any>>('/work-orders' + qs({ ...L.params, flow: flow || undefined }));
  const { data: summary } = useApi<Record<string, number>>('/work-orders/summary');

  // Follow ?status= and ?flow= when another screen links here
  const urlStatus = sp.get('status');
  const urlFlow = sp.get('flow');
  useEffect(() => { if (urlStatus !== null) L.setStatus(urlStatus); }, [urlStatus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (urlFlow && FLOWS.some((f) => f.key === urlFlow)) setFlow(urlFlow as FlowKey); }, [urlFlow]);

  const count = (s: string) => (summary ? s.split(',').reduce((a, k) => a + (summary[k] || 0), 0) : undefined);
  const label = (text: string, n?: number) => (n === undefined ? text : `${text} ${num(n)}`);
  const statusChips = [
    { key: OPEN, label: label('Open', count(OPEN)) },
    ...WO_STATUSES.map((s) => ({ key: s, label: label(s, count(s)) })),
    { key: '', label: 'All' },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Work orders' }]}
        title="Work orders"
        sub="Every job, where it is on its route, and what it is waiting for"
        actions={can('wo', 'create') ? <ButtonLink href="/production/work-orders/new" variant="primary" icon={Plus}>New work order</ButtonLink> : null}
      />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<>
          <ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search job, item, customer…" chips={{ options: statusChips, value: L.status, onChange: L.setStatus }} />
          <div className="toolbar" style={{ paddingTop: 10, paddingBottom: 10, minHeight: 0 }}>
            <span className="text-sm muted">Flow</span>
            <div className="chips" role="group" aria-label="Filter by flow">
              <button type="button" className={flow === '' ? 'on' : ''} onClick={() => { setFlow(''); L.setPage(1); }}>Any</button>
              {FLOWS.map((f) => (
                <button key={f.key} type="button" className={flow === f.key ? 'on' : ''} onClick={() => { setFlow(flow === f.key ? '' : f.key); L.setPage(1); }}>
                  {f.n} · {f.label}
                </button>
              ))}
            </div>
          </div>
        </>}
        rows={data?.rows}
        rowHref={(r) => `/production/work-orders/${r.id}`}
        empty={L.search || L.status || flow ? 'No work orders match these filters' : 'No work orders yet · create one to start a job on its route'}
        columns={[
          {
            key: 'job', header: 'Job', render: (r) => (
              <div>
                <div className="code" style={{ fontSize: 15 }}>{r.number}</div>
                <div className="text-sm secondary truncate" style={{ maxWidth: 260 }}>{r.itemName}</div>
                <div className="text-xs muted">{r.customerName ? `${r.customerName}${r.salesOrderNo ? ' · ' + r.salesOrderNo : ''}` : r.parentWoId ? 'Split from a parent job' : 'Make to stock'}</div>
              </div>
            ),
          },
          { key: 'route', header: 'Where it is', render: (r) => <MiniRoute wo={r} /> },
          {
            key: 'flow', header: 'Flow', render: (r) => (
              <div className="row" style={{ gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
                {flowsOf(r).map((f) => <span key={f.key} className={`chip t-${f.tone}`}>{f.n} · {f.short}</span>)}
              </div>
            ),
          },
          { key: 'progress', header: 'Made', render: (r) => <ProgressBar pct={r.qtyPlanned ? (r.qtyCompleted / r.qtyPlanned) * 100 : 0} tone={toneOf('wo', r.status)} label={`${num(r.qtyCompleted)} / ${num(r.qtyPlanned)}`} /> },
          { key: 'due', header: 'Due', render: (r) => <span className={'nowrap' + (r.late ? ' f-danger strong' : '')}>{date(r.dueDate)}{r.late ? ' · late' : ''}</span> },
          {
            key: 'status', header: 'Status', render: (r) => (
              <div className="stack tight" style={{ alignItems: 'flex-start' }}>
                <StatusBadge kind="wo" status={r.status} />
                {r.approvalPending ? <span className="chip t-warning">Approval pending</span> : null}
              </div>
            ),
          },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="work orders" /> : null}
      />
    </>
  );
}
