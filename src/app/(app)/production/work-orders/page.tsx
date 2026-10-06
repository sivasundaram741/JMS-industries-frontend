'use client';
// Work Orders: every production order from release to close, with partial production and splits.
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, num } from '@/lib/format';
import { WO_STATUSES, toneOf } from '@/lib/status';
import { ButtonLink, Card, Chip, DataTable, ErrorBox, ListToolbar, PageHeader, Pagination, ProcessStrip, ProgressBar, StatusBadge, Two } from '@/components/ui';
import { StageTracker } from '@/components/StageTracker';
import { ProductionTabs, WO_PROCESS } from '../_components/shared';

const FILTERS = [
  { key: '', label: 'All' }, { key: 'Planned,Released,In Progress,On Hold', label: 'Open' },
  ...WO_STATUSES.map((s) => ({ key: s, label: s })),
];

export default function WorkOrdersPage() {
  const { user, can } = useAuth();
  const sp = useSearchParams();
  const L = useListState();
  const { data, error, isLoading } = useApi<Page<any>>('/work-orders' + qs(L.params));
  const { data: summary } = useApi<Record<string, number>>('/work-orders/summary');

  // Follow ?status= when a process step links back to this page
  const urlStatus = sp.get('status');
  useEffect(() => { if (urlStatus !== null) L.setStatus(urlStatus); }, [urlStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Production' }, { label: 'Work Orders' }]}
        title="Work Orders"
        sub="Every production order from release to close · partial production and re-planning included"
        actions={can('wo', 'create') ? <ButtonLink href="/production/work-orders/new" variant="primary" icon={Plus}>New work order</ButtonLink> : null}
      />
      <ProductionTabs active="wo" />
      <Card title="Work order process" sub="Click a step to open it">
        <ProcessStrip steps={WO_PROCESS} />
      </Card>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {WO_STATUSES.map((s) => {
          const on = L.status === s;
          const t = toneOf('wo', s);
          return (
            <button
              key={s}
              type="button"
              className="card link"
              aria-pressed={on}
              onClick={() => L.setStatus(on ? '' : s)}
              style={{ textAlign: 'left', padding: '14px 16px', cursor: 'pointer', font: 'inherit', color: 'inherit', borderColor: on ? `var(--${t}-solid)` : undefined, boxShadow: on ? `0 0 0 3px var(--${t}-bg)` : undefined }}
            >
              <div className="row text-sm secondary" style={{ gap: 8 }}><span className={`s-${t}`} style={{ width: 8, height: 8, borderRadius: 999, display: 'inline-block' }} />{s}</div>
              <div className="h2 num" style={{ marginTop: 6 }}>{summary ? num(summary[s]) : '—'}</div>
            </button>
          );
        })}
      </div>

      <StageTracker stage="prod" />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search WO, item, order…" chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }} />}
        rows={data?.rows}
        rowHref={(r) => `/production/work-orders/${r.id}`}
        empty="No work orders match"
        columns={[
          { key: 'number', header: 'Work order', render: (r) => <Two a={r.number} b={r.salesOrderNo ? `${r.salesOrderNo}${r.parentWoId ? ' · split' : ''}` : r.parentWoId ? 'Split from parent' : 'Make to stock'} /> },
          { key: 'item', header: 'Item', render: (r) => <Two a={r.itemName} b={r.itemCode} /> },
          { key: 'progress', header: 'Completed / planned', render: (r) => <ProgressBar pct={r.qtyPlanned ? (r.qtyCompleted / r.qtyPlanned) * 100 : 0} tone={toneOf('wo', r.status)} label={`${num(r.qtyCompleted)} / ${num(r.qtyPlanned)}`} /> },
          { key: 'remaining', header: 'Remaining', align: 'right', render: (r) => num(Math.max(0, r.qtyPlanned - r.qtyCompleted)) },
          { key: 'machine', header: 'Machine', render: (r) => (r.machineCode ? <Chip>{r.machineCode}</Chip> : <span className="muted">—</span>) },
          { key: 'due', header: 'Due', render: (r) => <span className={'nowrap' + (r.late ? ' f-danger strong' : '')}>{date(r.dueDate)}</span> },
          {
            key: 'status', header: 'Status', render: (r) => (
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <StatusBadge kind="wo" status={r.status} />
                {r.approvalPending ? <Chip tone="warning">Approval pending</Chip> : null}
                {r.status === 'On Hold' && r.holdReason ? <span className="chip t-purple" title={r.holdReason} style={{ maxWidth: 220 }}><span className="truncate">{r.holdReason}</span></span> : null}
              </div>
            ),
          },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="work orders" /> : null}
      />
    </>
  );
}
