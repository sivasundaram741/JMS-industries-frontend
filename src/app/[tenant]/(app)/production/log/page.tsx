'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, NotebookPen, Plus } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useDebounced } from '@/lib/hooks';
import { dateShort, num } from '@/lib/format';
import {
  Button, ButtonLink, Card, DataTable, ErrorBox, ListToolbar, Loading,
  PageHeader, StatusBadge, Two,
} from '@/components/ui';
import { ProductionLogView } from '../_components/ProductionLogView';
import { RecordDialog } from '../work-orders/[id]/_components/dialogs';

/** Work orders worth logging against come first. */
const ACTIVE = ['In Progress', 'Released', 'On Hold'];

export default function ProductionLogPage() {
  const { user, can } = useAuth();
  const sp = useSearchParams();
  const [woId, setWoId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [addDate, setAddDate] = useState<string | undefined>();
  const q = useDebounced(search, 300);

  const { data: page, error, isLoading } = useApi<Page<any>>('/work-orders' + qs({ search: q, pageSize: 200 }));
  const list = page?.rows;
  const { data: wo, mutate } = useApi<any>(woId ? `/work-orders/${woId}` : null);
  const { data: machines } = useApi<any[]>('/machines');

  const rows = useMemo(() => {
    const all = list || [];
    const rank = (w: any) => (ACTIVE.indexOf(w.status) < 0 ? 9 : ACTIVE.indexOf(w.status));
    return [...all].sort((a, b) => rank(a) - rank(b) || String(b.number).localeCompare(String(a.number)));
  }, [list]);

  // Open whatever the caller asked for, else the most active work order -
  // taken from the ranked list, so "In Progress" wins over "Released".
  useEffect(() => {
    if (woId || !rows.length) return;
    const fromUrl = Number(sp.get('wo'));
    setWoId(fromUrl && rows.some((w) => w.id === fromUrl) ? fromUrl : rows[0].id);
  }, [rows, sp, woId]);

  const canRecord = can('wo', 'edit') && !!wo && (wo.actions || []).includes('record');

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Production' }, { label: 'Production Log' }]}
        title="Production Log"
        sub="Pick a work order to read everything that was logged against it"
        actions={<>
          {wo ? <ButtonLink href={`/production/work-orders/${wo.id}`} icon={ClipboardList}>Open work order</ButtonLink> : null}
          {canRecord ? <Button variant="primary" icon={Plus} onClick={() => { setAddDate(undefined); setAdding(true); }}>Record Production</Button> : null}
        </>}
      />

      <ErrorBox error={error} />

      <DataTable
        toolbar={<ListToolbar search={search} onSearch={setSearch} placeholder="Search work order or item…" />}
        loading={isLoading}
        rows={rows}
        rowKey="id"
        onRowClick={(w: any) => setWoId(w.id)}
        empty="No work orders yet"
        columns={[
          {
            key: 'number',
            header: 'Work order',
            render: (w: any) => (
              <div className="row" style={{ gap: 8 }}>
                {w.id === woId ? <NotebookPen size={14} style={{ color: 'var(--brand)' }} /> : null}
                <Two a={w.number} b={w.itemName} />
              </div>
            ),
          },
          { key: 'status', header: 'Status', render: (w: any) => <StatusBadge kind="wo" status={w.status} /> },
          {
            key: 'due',
            header: 'Due',
            render: (w: any) => (w.dueDate
              ? <span className={`secondary nowrap${w.late ? ' f-danger' : ''}`}>{dateShort(w.dueDate)}</span>
              : <span className="muted">no due date</span>),
          },
          {
            key: 'qty',
            header: 'Done',
            align: 'right',
            render: (w: any) => <span className="nowrap"><span className="strong">{num(w.qtyCompleted)}</span> <span className="muted">of {num(w.qtyPlanned)}</span></span>,
          },
        ]}
        footer={<div className="tfoot"><span>{num(rows.length)} work order{rows.length === 1 ? '' : 's'} · click one to read its log</span></div>}
      />

      {woId && !wo ? <Loading /> : null}

      {wo ? (
        <>
          <Card
            title={`${wo.number} · ${wo.itemName}`}
            sub={wo.startDate && wo.dueDate
              ? `${dateShort(wo.startDate)} to ${dateShort(wo.dueDate)} · ${num(wo.qtyCompleted)} of ${num(wo.qtyPlanned)} ${wo.uom} done`
              : 'No start or due date set on this work order'}
            right={<StatusBadge kind="wo" status={wo.status} />}
          >
            <div />
          </Card>
          <ProductionLogView wo={wo} canRecord={canRecord} onAdd={(iso) => { setAddDate(iso); setAdding(true); }} />
        </>
      ) : null}

      {adding && wo ? (
        <RecordDialog
          wo={wo}
          machines={machines || []}
          defaultDate={addDate}
          onClose={() => setAdding(false)}
          onDone={(updated: any) => { mutate(updated); setAdding(false); }}
        />
      ) : null}
    </>
  );
}
