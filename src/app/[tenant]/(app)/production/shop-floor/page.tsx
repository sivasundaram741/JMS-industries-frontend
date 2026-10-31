'use client';
// Shop Floor: every machine with its status, current work order and today's output; change a machine's status
// and see the andon alerts.
import { useState } from 'react';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { Check, CirclePause, TriangleAlert, User, Wrench } from 'lucide-react';
import { patch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { ago, num } from '@/lib/format';
import { hrefFor } from '@/lib/links';
import { toneOf } from '@/lib/status';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorBox, ListItem, Loading, Modal, PageHeader, ProgressBar, Segmented, StatStrip, StatusBadge, TextField, useToast } from '@/components/ui';
import { ProductionTabs } from '../_components/shared';

const STATUSES = ['Running', 'Setup', 'Down', 'Idle'] as const;
type MStatus = (typeof STATUSES)[number];

export default function ShopFloorPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const { data, error, mutate } = useApi<any>('/shop-floor', { refreshInterval: 30000 });
  const [sel, setSel] = useState<any>(null);
  const [status, setStatus] = useState<MStatus>('Running');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const editable = can('shopfloor', 'edit');

  function open(m: any) {
    if (!editable) return;
    setSel(m); setStatus(m.status); setNote(m.statusNote || '');
  }
  async function save() {
    setBusy(true);
    try {
      await patch(`/machines/${sel.id}/status`, { status, note: note.trim() || undefined });
      toast.ok(`${sel.code} · ${status}`);
      setSel(null);
      mutate();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  const maxOut = Math.max(1, ...(data?.machines || []).map((m: any) => m.outputToday));
  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Production' }, { label: 'Shop Floor' }]}
        title="Shop floor"
        tags={<Badge tone="success">Live</Badge>}
        sub="Every machine, the job on it and today's output · tap Record output to log pieces against that job"
      />
      <ProductionTabs active="floor" />
      <ErrorBox error={error} />
      {!data ? <Card><Loading rows={5} /></Card> : (
        <>
          <StatStrip items={[
            { label: 'Running', value: data.summary.running, color: 'success' },
            { label: 'Setup', value: data.summary.setup, color: 'warning' },
            { label: 'Down', value: data.summary.down, color: 'danger' },
            { label: 'Idle', value: data.summary.idle },
            { label: 'Output today', value: `${num(data.summary.outputToday)} pcs` },
            { label: 'Downtime today', value: `${num(data.summary.downtimeToday)} min`, color: data.summary.downtimeToday ? 'warning' : undefined },
          ]} />

          <div className="floor-grid">
            {data.machines.map((m: any) => {
              const t = toneOf('machine', m.status);
              return (
                <div
                  key={m.id}
                  className="card machine"
                  style={{ borderColor: m.status === 'Down' ? 'var(--danger-solid)' : undefined, boxShadow: m.status === 'Down' ? '0 0 0 1px var(--danger-solid)' : undefined }}
                >
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`s-${t}`} style={{ width: 9, height: 9, borderRadius: 999, flex: 'none' }} />
                    <span className="h4">{m.code}</span>
                    <span className="spacer" />
                    <StatusBadge kind="machine" status={m.status} dot={false} />
                  </div>
                  <div className="text-xs muted truncate">{m.name} · {m.workCentre}</div>
                  <div className="text-sm strong truncate" style={{ minHeight: 20 }}>
                    {m.woNumber ? <Link href={`/production/work-orders/${m.currentWoId}`} onClick={(e) => e.stopPropagation()}>{m.woNumber} · {m.itemCode}</Link> : <span className="muted" style={{ fontWeight: 500 }}>No work order loaded</span>}
                  </div>
                  <ProgressBar pct={m.qtyPlanned ? (m.qtyCompleted / m.qtyPlanned) * 100 : 0} tone={t} label={m.qtyPlanned ? `${num(m.qtyCompleted)} / ${num(m.qtyPlanned)}` : '—'} />
                  <div className="row between text-xs">
                    <span className="secondary">Output today <span className="strong" style={{ color: 'var(--text-primary)' }}>{num(m.outputToday)} pcs</span></span>
                    <span className={m.downtimeToday ? 'f-warning strong' : 'muted'}>{num(m.downtimeToday)} min down</span>
                  </div>
                  <div className="row between text-xs" style={{ gap: 8 }}>
                    <span className="row secondary truncate" style={{ gap: 4, minWidth: 0 }}><User size={13} style={{ flex: 'none' }} />{m.operator || '—'}</span>
                    <span className="muted nowrap">since {ago(m.statusSince)}</span>
                  </div>
                  {m.statusNote ? <div className={`text-xs strong f-${t} truncate`} title={m.statusNote}>{m.statusNote}</div> : null}
                  {/* Big, plain actions for the floor: record against the loaded job, or say what the machine is doing */}
                  <div className="row" style={{ gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                    {m.currentWoId && can('wo', 'edit') && ['In Progress', 'In Assembly'].includes(m.woStatus)
                      ? <ButtonLink href={`/production/work-orders/${m.currentWoId}?do=record`} variant="primary" size="lg" icon={Check} className="grow">Record output</ButtonLink>
                      : m.currentWoId ? <ButtonLink href={`/production/work-orders/${m.currentWoId}`} size="lg" className="grow">{m.woStatus === 'On Hold' ? 'Job on hold' : 'Open job'}</ButtonLink> : null}
                    {editable ? <Button size="lg" onClick={() => open(m)} className="grow" aria-label={`Change status of ${m.code}`}>Status</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid main-side" style={{ alignItems: 'start' }}>
            <Card title="Andon alerts" sub="Machine stops and work order holds, newest first">
              {data.alerts.length ? (
                <div className="list">
                  {data.alerts.map((a: any) => (
                    <ListItem key={a.id} icon={a.entityType === 'MACHINE' ? TriangleAlert : CirclePause} tone={a.entityType === 'MACHINE' ? 'danger' : 'purple'}
                      title={a.event.startsWith(a.entityNo) ? a.event : `${a.entityNo} · ${a.event.toLowerCase()}`}
                      sub={[a.detail, a.userName].filter(Boolean).join(' · ')}
                      right={<span className="text-xs muted nowrap">{ago(a.createdAt)}</span>}
                      href={a.entityType === 'WO' ? hrefFor({ type: 'WO', id: a.entityId }) : null} />
                  ))}
                </div>
              ) : <EmptyState title="No alerts" icon={Wrench}>Every machine is running normally</EmptyState>}
            </Card>
            <Card title="Output today" sub="Good pieces by machine">
              <div className="stack" style={{ gap: 12 }}>
                {data.machines.map((m: any) => (
                  <div key={m.id}>
                    <div className="row between text-sm" style={{ marginBottom: 4 }}><span className="strong">{m.code}</span><span className="num secondary">{num(m.outputToday)} pcs{m.scrapToday ? ` · ${num(m.scrapToday)} scrap` : ''}</span></div>
                    <ProgressBar pct={(m.outputToday / maxOut) * 100} tone={toneOf('machine', m.status)} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.code} · ${sel.name}` : ''} sub={sel ? `${sel.workCentre}${sel.woNumber ? ' · running ' + sel.woNumber : ''}` : undefined}
        footer={<><Button onClick={() => setSel(null)}>Cancel</Button><Button variant={status === 'Down' ? 'danger' : 'primary'} loading={busy} onClick={save}>Set {status.toLowerCase()}</Button></>}>
        <div className="stack" style={{ gap: 16 }}>
          <div>
            <div className="text-sm secondary" style={{ marginBottom: 6, fontWeight: 500 }}>Status</div>
            <Segmented options={STATUSES} value={status} onChange={setStatus} />
          </div>
          <TextField label={status === 'Down' ? 'What happened?' : 'Note'} value={note} onChange={setNote} placeholder={status === 'Down' ? 'e.g. Spindle overload alarm' : status === 'Setup' ? 'e.g. Fixture change for HV-20' : 'Optional'} />
          {status === 'Down' ? <div className="text-xs muted">A machine going down raises an andon alert for the supervisor.</div> : null}
        </div>
      </Modal>
    </>
  );
}
