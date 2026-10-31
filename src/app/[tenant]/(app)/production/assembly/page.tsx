'use client';
// Assembly Log: the bench between the shop floor and QC.
// Left of the flow a work order is being made; right of it, it is being checked.
// This screen is what the assembly team works from — what is on the bench now,
// what is ready to come to it, and the work logged against each one.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, Hammer, Plus, ShieldCheck } from 'lucide-react';
import { post, qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useDebounced } from '@/lib/hooks';
import { dateShort, num } from '@/lib/format';
import {
  Alert, Badge, Button, ButtonLink, Card, Chip, DataTable, ErrorBox, KeyValue,
  ListToolbar, Loading, PageHeader, StatusBadge, Two, useToast,
} from '@/components/ui';
import { ProductionLogView } from '../_components/ProductionLogView';
import { RecordDialog, MoveDialog } from '../work-orders/[id]/_components/dialogs';

/** On the bench first, then ready to come to it, then the ones already through. */
const RANK: Record<string, number> = { 'In Assembly': 0, 'In Progress': 1, 'On Hold': 2, Released: 3, Completed: 4 };
const rank = (w: any) => (RANK[w.status] ?? 9);

export default function AssemblyLogPage() {
  const { user, can } = useAuth();
  const sp = useSearchParams();
  const toast = useToast();
  const [woId, setWoId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [dlg, setDlg] = useState<'' | 'record' | 'move'>('');
  const [busy, setBusy] = useState('');
  const q = useDebounced(search, 300);

  const { data: page, error, isLoading, mutate: mList } = useApi<Page<any>>('/work-orders' + qs({ search: q, pageSize: 200 }));
  const { data: wo, mutate } = useApi<any>(woId ? `/work-orders/${woId}` : null);
  const { data: machines } = useApi<any[]>('/machines');

  // Only jobs that assembly cares about: on the bench, heading for it, or just through it.
  const rows = useMemo(() => {
    const all = (page?.rows || []).filter((w: any) => w.needsAssembly !== false && RANK[w.status] !== undefined);
    return [...all].sort((a, b) => rank(a) - rank(b) || String(b.number).localeCompare(String(a.number)));
  }, [page]);

  useEffect(() => {
    if (woId || !rows.length) return;
    const fromUrl = Number(sp.get('wo'));
    setWoId(fromUrl && rows.some((w) => w.id === fromUrl) ? fromUrl : rows[0].id);
  }, [rows, sp, woId]);

  const has = (a: string) => !!wo && (wo.actions || []).includes(a);
  const canRecord = can('wo', 'edit') && has('record');
  const waiting = wo ? Math.round((wo.qtyCompleted - wo.qtyToQc) * 1000) / 1000 : 0;
  const onBench = rows.filter((w) => w.status === 'In Assembly').length;

  async function act(action: string, done: string) {
    setBusy(action);
    try {
      await post(`/work-orders/${wo.id}/actions/${action}`, {});
      toast.ok(done);
      mutate(); mList();
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Production' }, { label: 'Assembly Log' }]}
        title="Assembly Log"
        sub="Step 5 of the flow · everything is made, now it gets put together before it goes to QC"
        tags={onBench ? <Badge tone="warning">{onBench} on the bench</Badge> : undefined}
        actions={wo ? <ButtonLink href={`/production/work-orders/${wo.id}`} icon={ClipboardList}>Open work order</ButtonLink> : undefined}
      />

      <ErrorBox error={error} />

      <DataTable
        toolbar={<ListToolbar search={search} onSearch={setSearch} placeholder="Search work order or item…" />}
        loading={isLoading}
        rows={rows}
        rowKey="id"
        onRowClick={(w: any) => setWoId(w.id)}
        empty="Nothing is at or near the assembly bench"
        columns={[
          {
            key: 'number',
            header: 'Work order',
            render: (w: any) => (
              <div className="row" style={{ gap: 8 }}>
                {w.id === woId ? <Hammer size={14} style={{ color: 'var(--brand)' }} /> : null}
                <Two a={w.number} b={w.itemName} />
              </div>
            ),
          },
          { key: 'status', header: 'Status', render: (w: any) => <StatusBadge kind="wo" status={w.status} /> },
          {
            key: 'where',
            header: 'Where it is',
            render: (w: any) => (w.status === 'In Assembly'
              ? <span className="f-warning strong nowrap">On the assembly bench</span>
              : w.status === 'Completed'
                ? <span className="secondary nowrap">Through assembly</span>
                : w.status === 'On Hold'
                  ? <span className="f-purple nowrap">Held · {w.holdReason || 'see the work order'}</span>
                  : <span className="muted nowrap">Still on the shop floor</span>),
          },
          {
            key: 'due',
            header: 'Due',
            render: (w: any) => (w.dueDate
              ? <span className={`secondary nowrap${w.late ? ' f-danger' : ''}`}>{dateShort(w.dueDate)}</span>
              : <span className="muted">no due date</span>),
          },
          { key: 'qty', header: 'Done', align: 'right', render: (w: any) => <span className="nowrap"><span className="strong">{num(w.qtyCompleted)}</span> <span className="muted">of {num(w.qtyPlanned)}</span></span> },
        ]}
        footer={<div className="tfoot"><span>{num(rows.length)} work order{rows.length === 1 ? '' : 's'} · click one to see its assembly work</span></div>}
      />

      {woId && !wo ? <Loading /> : null}

      {wo ? (
        <>
          <Card
            title={`${wo.number} · ${wo.itemName}`}
            sub={wo.status === 'In Assembly'
              ? 'On the assembly bench now · log the work, then send the finished pieces to QC'
              : wo.status === 'Completed'
                ? 'Already through assembly'
                : 'Still being made · it comes to the bench once every operation is finished'}
            right={<StatusBadge kind="wo" status={wo.status} />}
          >
            <KeyValue items={[
              ['Operations finished', `${wo.operations.filter((o: any) => o.status === 'Done').length} of ${wo.operations.length}`],
              ['Made so far', `${num(wo.qtyCompleted)} of ${num(wo.qtyPlanned)} ${wo.uom}`],
              ['Waiting to go to QC', <span key="w" className={waiting > 0 ? 'f-warning strong' : ''}>{num(waiting)} {wo.uom}</span>],
            ]} />
            <div className="row" style={{ gap: 8, padding: '0 14px 14px', flexWrap: 'wrap' }}>
              {has('assemble') ? <Button variant="primary" icon={Hammer} loading={busy === 'assemble'} onClick={() => act('assemble', `${wo.number} is on the assembly bench`)}>Send to Assembly</Button> : null}
              {canRecord ? <Button icon={Plus} onClick={() => setDlg('record')}>Record assembly work</Button> : null}
              {has('move-to-quality') && waiting > 0 ? <Button variant="primary" icon={ShieldCheck} onClick={() => setDlg('move')}>Move {num(waiting)} to QC</Button> : null}
            </div>
            {!has('assemble') && wo.status === 'In Progress' ? (
              <Alert tone="info" title="Not ready for the bench yet">
                Every operation has to be finished before it can come to assembly. {wo.operations.filter((o: any) => o.status !== 'Done').length} still open.
              </Alert>
            ) : null}
          </Card>

          <ProductionLogView wo={wo} canRecord={canRecord} onAdd={() => setDlg('record')} showStats={false} />
        </>
      ) : null}

      {dlg === 'record' && wo ? (
        <RecordDialog wo={wo} machines={machines || []} onClose={() => setDlg('')} onDone={(u: any) => { mutate(u); mList(); setDlg(''); }} />
      ) : null}
      {dlg === 'move' && wo ? (
        <MoveDialog wo={wo} machines={machines || []} onClose={() => setDlg('')} onDone={(u: any) => { mutate(u); mList(); setDlg(''); }} />
      ) : null}
    </>
  );
}
