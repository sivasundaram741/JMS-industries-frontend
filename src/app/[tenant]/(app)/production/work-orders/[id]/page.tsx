'use client';
// Work order: process, details, parts availability, routing progress, production entries and material issue,
// output, partial production & split, inspection lots, job work and activity — with every action.
import { useState } from 'react';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useParams, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Check, CircleAlert, CircleCheck, CirclePause, CirclePlay, ClipboardCheck, Factory, Forklift, GitFork, Hourglass, Lock, Play, Plus, Send, ShieldCheck, Truck } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useTenantHref } from '@/lib/hooks';
import { ago, date, dateShort, num } from '@/lib/format';
import { WO_STATUSES, toneOf, type Tone } from '@/lib/status';
import { Alert, Badge, Button, ButtonLink, Card, Chip, DataTable, ErrorBox, KeyValue, ListItem, Loading, Modal, PageHeader, ProcessStrip, StatusBadge, Stepper, TextField, Two, useToast } from '@/components/ui';
import { Gauge } from '@/components/charts/BarChart';
import { MoreMenu, WO_PROCESS } from '../../_components/shared';
import { IssueDialog, MoveDialog, RecordDialog } from './_components/dialogs';
import { Attachments } from '@/components/docs/Attachments';

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const inHouse = (m: any) => m.itemType === 'RM' || m.itemType === 'FG';
const EV_TONE: Record<string, Tone> = { done: 'success', alert: 'danger', wait: 'warning' };

function partState(m: any): { label: string; tone: Tone; icon: LucideIcon } {
  const need = r3(m.qtyRequired - m.qtyIssued);
  if (need <= 0) return { label: 'Issued', tone: 'success', icon: CircleCheck };
  if (m.stockAvailable < need) return { label: 'Short', tone: 'danger', icon: CircleAlert };
  if (m.qtyIssued > 0) return { label: 'Partly issued', tone: 'warning', icon: Hourglass };
  return { label: 'In stock', tone: 'info', icon: Hourglass };
}

export default function WorkOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: wo, error, mutate } = useApi<any>(`/work-orders/${id}`);
  const { data: machines } = useApi<any[]>('/machines');
  const [busy, setBusy] = useState('');
  const [dlg, setDlg] = useState<'' | 'issue' | 'record' | 'move' | 'hold' | 'complete' | 'close'>('');
  const [reason, setReason] = useState('');
  const [allActivity, setAllActivity] = useState(false);

  async function act(action: string, body: any = {}, msg?: (r: any) => string) {
    setBusy(action);
    try {
      const r = await post(`/work-orders/${id}/actions/${action}`, body);
      await mutate(r, { revalidate: false });
      toast.ok(msg ? msg(r) : `${r.number} · ${r.status}`);
      setDlg('');
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  const done = (r: any) => { mutate(r, { revalidate: false }); setDlg(''); };

  if (error) return <ErrorBox error={error} />;
  if (!wo) return <Loading rows={6} />;

  const edit = can('wo', 'edit');
  const has = (a: string) => wo.actions.includes(a) && edit;
  const canIssue = wo.actions.includes('issue') && (edit || can('stockentry', 'edit'));
  const waiting = r3(wo.qtyCompleted - wo.qtyToQc);
  const remaining = r3(Math.max(0, wo.qtyPlanned - wo.qtyCompleted));
  const partial = wo.qtyToQc > 0 && wo.qtyToQc < wo.qtyPlanned;
  const tone = toneOf('wo', wo.status);
  const ops: any[] = wo.operations;
  // An operation is done when it has made the planned quantity (after a split the plan shrinks)
  const opDone = (o: any) => o.status === 'Done' || o.qtyDone >= wo.qtyPlanned - 0.0005;
  const curOp = ops.findIndex((o) => !opDone(o));
  const openLots = wo.inspections.filter((l: any) => ['Pending', 'In progress'].includes(l.status));
  const shortParts = wo.materials.filter((m: any) => partState(m).label === 'Short');
  const allIssued = wo.materials.length > 0 && wo.materials.every((m: any) => m.qtyIssued >= m.qtyRequired - 0.0005);
  const jobWorkOk = can('subcon', 'create') && !['Completed', 'Closed'].includes(wo.status);
  const steps = WO_PROCESS.map((s, i) => ({ ...s, href: ['#details', '#materials', '#routing', '#entries', '#split', '#inspections', wo.salesOrderId ? `/sales/orders/${wo.salesOrderId}` : '/dispatch'][i] }));
  const now = [
    'Now: ' + WO_PROCESS[Math.min(wo.processStep, 6)].label.toLowerCase(),
    wo.approvalPending ? 'release waiting for approval' : null,
    wo.status === 'On Hold' ? 'on hold · ' + (wo.holdReason || '') : null,
    waiting > 0 && wo.status !== 'Completed' && wo.status !== 'Closed' ? `${num(waiting)} finished pieces ready for quality` : null,
    shortParts.length ? `${shortParts.length} part${shortParts.length === 1 ? '' : 's'} short in RM Store` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        back="/production/work-orders"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Production' }, { label: 'Work Orders', href: '/production/work-orders' }, { label: wo.number }]}
        title={wo.number}
        tags={<>
          <StatusBadge kind="wo" status={wo.status} />
          {partial ? <Badge tone="purple" dot={false}>Partial</Badge> : null}
          {wo.late ? <Badge tone="danger">Late</Badge> : null}
          {wo.approvalPending ? <Badge tone="warning">Approval pending</Badge> : null}
        </>}
        sub={<>
          {wo.itemName} · {num(wo.qtyCompleted)} of {num(wo.qtyPlanned)} done
          {wo.salesOrderNo ? <> · for <Link href={`/sales/orders/${wo.salesOrderId}`}>{wo.salesOrderNo}</Link>{wo.customerName ? ` (${wo.customerName})` : ''}</> : ' · make to stock'}
          {wo.parentWoNo ? <> · split from <Link href={`/production/work-orders/${wo.parentWoId}`}>{wo.parentWoNo}</Link></> : null}
          {' · '}<span className={wo.late ? 'f-danger strong' : ''}>due {date(wo.dueDate)}</span>
        </>}
        actions={<>
          <MoreMenu items={[
            has('hold') && { label: 'Put on hold', icon: CirclePause, onClick: () => { setReason(''); setDlg('hold'); } },
            has('complete') && { label: wo.qtyCompleted < wo.qtyPlanned ? 'Short-close work order' : 'Complete work order', icon: CircleCheck, onClick: () => setDlg('complete') },
            jobWorkOk && { label: 'Raise job work', icon: Truck, onClick: () => router.push(tenantHref(`/purchase/orders/new?type=JOB_WORK&wo=${wo.id}`)) },
          ]} />
          {has('release') ? (wo.approvalPending
            ? <Button icon={Hourglass} disabled title="A manager has to approve the release">Waiting for approval</Button>
            : <Button variant="primary" icon={Send} loading={busy === 'release'} onClick={() => act('release', {}, (r) => (r.approvalPending ? 'Release sent to the manager for approval' : `${r.number} released to the shop floor`))}>Release</Button>) : null}
          {has('resume') ? <Button variant="primary" icon={CirclePlay} loading={busy === 'resume'} onClick={() => act('resume', {}, (r) => `${r.number} resumed · ${r.status}`)}>Resume</Button> : null}
          {canIssue ? <Button icon={Forklift} onClick={() => setDlg('issue')}>Issue material</Button> : null}
          {has('start') ? <Button variant="primary" icon={Play} loading={busy === 'start'} onClick={() => act('start', {}, (r) => `${r.number} started${r.machineCode ? ' on ' + r.machineCode : ''}`)}>Start</Button> : null}
          {has('move-to-quality') && waiting > 0 ? <Button icon={ShieldCheck} onClick={() => setDlg('move')}>Move to quality</Button> : null}
          {has('record') ? <Button variant="primary" icon={Check} onClick={() => setDlg('record')}>Record production</Button> : null}
          {has('close') ? <Button variant="primary" icon={Lock} onClick={() => setDlg('close')}>Close work order</Button> : null}
        </>}
      />

      <Card title="Work order process" sub={now}>
        <ProcessStrip steps={steps} current={wo.processStep} />
      </Card>

      <div className="grid cols-2">
        <Card title="Work order details" id="details">
          <KeyValue items={[
            ['Work order no', wo.number],
            ['Product', <Two key="p" a={wo.itemName} b={wo.itemCode} />],
            ['Qty planned', `${num(wo.qtyPlanned)} ${wo.uom}`],
            ['Qty completed', `${num(wo.qtyCompleted)}${wo.qtyCompleted > 0 && wo.qtyCompleted < wo.qtyPlanned ? ' (partial)' : ''}`],
            ['Scrap', `${num(wo.qtyScrap)} ${wo.uom}`],
            ['Status', wo.status === 'On Hold' && wo.holdReason ? <span className="f-purple">On Hold · <span className="secondary" style={{ fontWeight: 500 }}>{wo.holdReason}</span></span> : wo.status],
            ['Due date', <span key="d" className={wo.late ? 'f-danger' : ''}>{date(wo.dueDate)}{wo.late ? ' · late' : ''}</span>],
            ['Machine', wo.machineCode ? `${wo.machineCode} · ${wo.machineName}` : '—'],
            ['Shift', wo.shift ? 'Shift ' + wo.shift : '—'],
            ['Customer order', wo.salesOrderNo ? <Link key="so" href={`/sales/orders/${wo.salesOrderId}`}>{wo.salesOrderNo}</Link> : 'Make to stock'],
          ]} />
          <div className="row wrap" style={{ gap: 14, marginTop: 18 }}>
            {WO_STATUSES.map((s) => (
              <span key={s} className={'row text-xs ' + (s === wo.status ? 'strong' : 'secondary')} style={{ gap: 6 }}>
                <i className={`s-${toneOf('wo', s)}`} style={{ width: 8, height: 8, borderRadius: 999, display: 'inline-block' }} />{s}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Parts availability" sub="Issued against required · stock available in RM Store">
          <div className="stack" style={{ gap: 12 }}>
            <div className="grid cols-2" style={{ gap: 12 }}>
              {([['Production parts · made in-house', 'danger', wo.materials.filter(inHouse)], ['Bought-out parts', 'warning', wo.materials.filter((m: any) => !inHouse(m))]] as Array<[string, Tone, any[]]>).map(([title, t, list]) => (
                <div key={title} style={{ border: `1px solid color-mix(in srgb, var(--${t}-solid) 30%, transparent)`, background: `var(--${t}-bg)`, borderRadius: 10, padding: '10px 12px' }}>
                  <div className={`text-sm strong f-${t}`} style={{ marginBottom: 6 }}>{title}</div>
                  {list.length ? list.map((m) => {
                    const st = partState(m), I = st.icon;
                    return (
                      <div key={m.id} className="row" style={{ gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
                        <I size={16} className={`f-${st.tone}`} style={{ marginTop: 2, flex: 'none' }} />
                        <div style={{ minWidth: 0 }}>
                          <div className="text-sm strong truncate">{m.itemName}</div>
                          <div className="text-xs muted">{num(m.qtyIssued, 3)} / {num(m.qtyRequired, 3)} {m.uom} issued · {num(m.stockAvailable, 3)} in stock</div>
                        </div>
                      </div>
                    );
                  }) : <div className="text-xs muted" style={{ padding: '6px 0' }}>None on this work order</div>}
                </div>
              ))}
            </div>
            {shortParts.length ? (
              <Alert tone="warning" title={`${shortParts.length} part${shortParts.length === 1 ? '' : 's'} short in RM Store`}
                action={waiting > 0 && has('move-to-quality') ? <Button size="sm" onClick={() => setDlg('move')}>Move {num(waiting)} to QC</Button> : undefined}>
                {shortParts.map((m: any) => `${m.itemName}: ${num(r3(m.qtyRequired - m.qtyIssued - m.stockAvailable), 3)} ${m.uom} more needed`).join(' · ')}
                {waiting > 0 ? ` · quality can start on ${num(waiting)} pcs now` : ''}
              </Alert>
            ) : allIssued ? (
              <Alert tone="success" title="All parts issued to the shop floor"
                action={waiting > 0 && has('move-to-quality') ? <Button size="sm" onClick={() => setDlg('move')}>Move {num(waiting)} to QC</Button> : undefined}>
                {waiting > 0 ? `${num(waiting)} finished pieces are waiting for quality` : wo.status === 'Closed' ? 'Shop-floor material was consumed when the work order closed' : 'Material on the shop floor is consumed when the work order closes'}
              </Alert>
            ) : wo.materials.length ? (
              <Alert tone="info" title={`${wo.materials.filter((m: any) => m.qtyIssued < m.qtyRequired - 0.0005).length} of ${wo.materials.length} parts still to issue`}
                action={canIssue ? <Button size="sm" icon={Forklift} onClick={() => setDlg('issue')}>Issue material</Button> : waiting > 0 && has('move-to-quality') ? <Button size="sm" onClick={() => setDlg('move')}>Move {num(waiting)} to QC</Button> : undefined}>
                RM Store has the stock for them{wo.status === 'Planned' ? ' · issue once the work order is released' : ''}
              </Alert>
            ) : null}
          </div>
        </Card>
      </div>

      <Card title="Routing progress" id="routing" sub={`${ops.length} operation${ops.length === 1 ? '' : 's'} · ${ops.filter(opDone).length} done · then final inspection`}
        right={<ButtonLink href="/production/shop-floor" size="sm" icon={Factory}>Shop floor</ButtonLink>}>
        <Stepper current={curOp < 0 ? ops.length : curOp} steps={ops.map((o) => ({ label: `Op ${o.seq} · ${o.name}`, sub: `${o.machineCode || 'Bench'} · ${num(o.qtyDone)} / ${num(wo.qtyPlanned)}${o.qtyScrap ? ` · ${num(o.qtyScrap)} scrap` : ''}` }))} />
      </Card>

      <div className="grid main-side">
        <div className="stack">
          <div id="entries">
            <DataTable
              toolbar={<div className="toolbar"><div><div className="tt">Production entries</div><div className="ts">Good qty, scrap and downtime per shift</div></div><div className="spacer" />{has('record') ? <Button size="sm" variant="primary" icon={Plus} onClick={() => setDlg('record')}>Add entry</Button> : null}</div>}
              rows={wo.entries}
              empty="No production recorded yet"
              columns={[
                { key: 'date', header: 'Date · shift · operator', render: (e) => <div className="nowrap"><div className="strong">{dateShort(e.entryDate)} · {e.shift || '—'}</div><div className="text-xs muted">{e.operator || '—'}</div></div> },
                { key: 'op', header: 'Operation · machine', render: (e) => <div style={{ maxWidth: 220 }} title={e.operationName}><div className="row" style={{ gap: 6 }}><span className="strong nowrap">Op {e.seq}</span>{e.machineCode ? <Chip>{e.machineCode}</Chip> : null}</div><div className="text-xs muted truncate">{e.operationName}</div></div> },
                { key: 'good', header: 'Good', align: 'right', render: (e) => <span className="strong">{num(e.qtyGood)}</span> },
                { key: 'scrap', header: 'Scrap', align: 'right', render: (e) => <span className={e.qtyScrap ? 'f-danger' : 'muted'}>{num(e.qtyScrap)}</span> },
                { key: 'down', header: 'Down', align: 'right', render: (e) => <span className={'nowrap ' + (e.downtimeMin ? 'f-warning' : 'muted')}>{num(e.downtimeMin)} min</span> },
                { key: 'run', header: 'Run h', align: 'right', render: (e) => num(e.runHours, 1) },
              ]}
            />
          </div>
          <div id="materials">
            <DataTable
              toolbar={<div className="toolbar"><div><div className="tt">Material requirement & issue</div><div className="ts">Issued from RM Store to the shop floor · oldest lot first</div></div><div className="spacer" />{canIssue ? <Button size="sm" icon={Forklift} onClick={() => setDlg('issue')}>Issue material</Button> : null}</div>}
              rows={wo.materials}
              empty="No materials on this work order"
              columns={[
                { key: 'item', header: 'Component', render: (m) => <div style={{ minWidth: 170 }}><Two a={m.itemName} b={`${m.itemCode} · ${inHouse(m) ? 'production · in-house' : m.itemType === 'CONSUMABLE' ? 'consumable' : 'bought-out'}`} /></div> },
                { key: 'req', header: 'Required', align: 'right', render: (m) => <span className="nowrap">{num(m.qtyRequired, 3)} {m.uom}</span> },
                { key: 'iss', header: 'Issued', align: 'right', render: (m) => num(m.qtyIssued, 3) },
                { key: 'bal', header: 'To issue', align: 'right', render: (m) => num(Math.max(0, r3(m.qtyRequired - m.qtyIssued)), 3) },
                { key: 'stock', header: 'In stock', align: 'right', render: (m) => num(m.stockAvailable, 3) },
                { key: 'st', header: 'Status', render: (m) => { const st = partState(m); return <Badge tone={st.tone}>{st.label}</Badge>; } },
              ]}
            />
          </div>
        </div>

        <div className="stack">
          <Card title="Output">
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <Gauge value={wo.qtyPlanned ? (wo.qtyCompleted / wo.qtyPlanned) * 100 : 0} label={`${num(wo.qtyCompleted)} of ${num(wo.qtyPlanned)} good`} color={`var(--${tone}-solid)`} />
            </div>
            <KeyValue items={[
              ['Remaining', `${num(remaining)} ${wo.uom}`],
              ['Scrap', `${num(wo.qtyScrap)} (${wo.qtyCompleted + wo.qtyScrap ? num((wo.qtyScrap / (wo.qtyCompleted + wo.qtyScrap)) * 100, 1) : 0}%)`],
              ['Sent to quality', num(wo.qtyToQc)],
              ['Waiting for quality', <span key="w" className={waiting > 0 ? 'f-warning' : ''}>{num(waiting)}</span>],
            ]} />
          </Card>

          <Card title="Partial production & split" id="split" sub={remaining > 0 ? `${num(remaining)} ${wo.uom} still to make` : wo.children.length ? 'Remaining quantity re-planned' : 'Nothing left to make'}>
            <div className="list">
              {wo.parentWoNo ? <ListItem icon={GitFork} tone="purple" title={`Split from ${wo.parentWoNo}`} sub="This work order carries the parent's remaining quantity" href={`/production/work-orders/${wo.parentWoId}`} /> : null}
              {wo.children.map((c: any) => (
                <ListItem key={c.id} icon={GitFork} tone="warning" title={`${c.number} · ${num(c.qtyPlanned)} ${wo.uom}`} sub={`Split from this order · ${num(c.qtyCompleted)} / ${num(c.qtyPlanned)} done`} right={<StatusBadge kind="wo" status={c.status} />} href={`/production/work-orders/${c.id}`} />
              ))}
              {!wo.parentWoNo && !wo.children.length ? <div className="text-sm muted">No split yet · Move to quality can send finished pieces now and re-plan the rest as a new work order.</div> : null}
            </div>
            {has('move-to-quality') && waiting > 0 ? <div style={{ marginTop: 12 }}><Button size="sm" icon={GitFork} onClick={() => setDlg('move')}>Move {num(waiting)} to quality{remaining > 0 ? ' · split' : ''}</Button></div> : null}
          </Card>

          <Card title="Inspection lots" id="inspections" sub={openLots.length ? `${openLots.length} waiting for a decision` : 'Final inspection of finished pieces'}>
            <div className="list">
              {wo.inspections.length ? wo.inspections.map((l: any) => (
                <ListItem key={l.id} icon={ClipboardCheck} tone={toneOf('lot', l.status)} title={`${l.number} · ${num(l.qty)} ${wo.uom}`}
                  sub={['Pending', 'In progress'].includes(l.status) ? 'Awaiting inspection' : `${num(l.qtyAccepted)} accepted${l.qtyRejected ? ' · ' + num(l.qtyRejected) + ' rejected' : ''}`}
                  right={<StatusBadge kind="lot" status={l.status} />} href={`/quality/inspections/${l.id}`} />
              )) : <div className="text-sm muted">Raised when pieces move to quality</div>}
            </div>
          </Card>

          <Card title="Job work orders" sub="Operations sent to a subcontractor" right={jobWorkOk ? <ButtonLink href={`/purchase/orders/new?type=JOB_WORK&wo=${wo.id}`} size="sm" icon={Plus}>Raise job work</ButtonLink> : null}>
            <div className="list">
              {wo.jobWork.length ? wo.jobWork.map((j: any) => (
                <ListItem key={j.id} icon={Truck} tone="teal" title={`${j.number} · ${j.vendorName}`} sub={j.needBy ? `Need by ${date(j.needBy)}` : undefined} right={<StatusBadge kind="po" status={j.status} />} href={`/purchase/orders/${j.id}`} />
              )) : <div className="text-sm muted">None raised</div>}
            </div>
          </Card>

          <Card title="Activity">
            <div className="timeline">
              {wo.activity.length ? (allActivity ? wo.activity : wo.activity.slice(0, 6)).map((a: any) => (
                <div key={a.id} className="ev">
                  <span className={`s-${EV_TONE[a.tone] || 'info'}`} style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, flex: 'none' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="text-sm strong">{a.event}</div>
                    {a.detail ? <div className="text-xs secondary">{a.detail}</div> : null}
                    <div className="text-xs muted">{a.userName || 'System'} · {ago(a.createdAt)}</div>
                  </div>
                </div>
              )) : <div className="text-sm muted">No activity yet</div>}
            </div>
            {wo.activity.length > 6 ? <Button size="xs" variant="ghost" onClick={() => setAllActivity(!allActivity)}>{allActivity ? 'Show less' : `Show all ${wo.activity.length}`}</Button> : null}
          </Card>
          <Attachments entityType="WO" entityId={wo.id} entityNo={wo.number} />
        </div>
      </div>

      {dlg === 'issue' ? <IssueDialog wo={wo} onClose={() => setDlg('')} onDone={done} /> : null}
      {dlg === 'record' ? <RecordDialog wo={wo} machines={machines || []} onClose={() => setDlg('')} onDone={done} /> : null}
      {dlg === 'move' ? <MoveDialog wo={wo} machines={machines || []} onClose={() => setDlg('')} onDone={done} /> : null}

      <Modal open={dlg === 'hold'} onClose={() => setDlg('')} title={`Put ${wo.number} on hold`} sub="Production stops until the work order is resumed"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy === 'hold'} disabled={!reason.trim()} onClick={() => act('hold', { reason: reason.trim() }, (r) => `${r.number} on hold`)}>Put on hold</Button></>}>
        <TextField label="Reason" value={reason} onChange={setReason} placeholder="e.g. Heat treatment late at vendor" required />
      </Modal>

      <Modal open={dlg === 'complete'} onClose={() => setDlg('')}
        title={wo.qtyCompleted < wo.qtyPlanned ? `Short-close ${wo.number}?` : `Complete ${wo.number}?`}
        sub={wo.qtyCompleted < wo.qtyPlanned ? `Only ${num(wo.qtyCompleted)} of ${num(wo.qtyPlanned)} made` : `All ${num(wo.qtyPlanned)} made`}
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button>
          {wo.qtyCompleted < wo.qtyPlanned
            ? <Button variant="danger" loading={busy === 'complete'} disabled={wo.qtyCompleted <= 0} onClick={() => act('complete', { shortClose: true }, (r) => `${r.number} short-closed at ${num(r.qtyPlanned)}`)}>Short-close at {num(wo.qtyCompleted)}</Button>
            : <Button variant="primary" loading={busy === 'complete'} onClick={() => act('complete', {}, (r) => `${r.number} completed`)}>Complete</Button>}
        </>}>
        <div className="stack" style={{ gap: 12 }}>
          {wo.qtyCompleted <= 0 ? <Alert tone="danger" title="Record production before completing" /> : null}
          {wo.qtyCompleted > 0 && wo.qtyCompleted < wo.qtyPlanned ? (
            <Alert tone="warning" title={`${num(remaining)} ${wo.uom} will not be made on this work order`}>The planned quantity is reduced to {num(wo.qtyCompleted)}. To make the rest later, use Move to quality and split the remaining quantity into a new work order instead.</Alert>
          ) : null}
          {waiting > 0 ? <div className="text-sm secondary">{num(waiting)} finished pieces not yet in quality move to QC Hold now, with a final inspection lot.</div> : null}
          <div className="text-sm secondary">The machine is freed for the next work order.</div>
        </div>
      </Modal>

      <Modal open={dlg === 'close'} onClose={() => setDlg('')} title={`Close ${wo.number}?`} sub="Closing is final · material still on the shop floor is consumed"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy === 'close'} disabled={openLots.length > 0} onClick={() => act('close', {}, (r) => `${r.number} closed · shop-floor material consumed`)}>Close work order</Button></>}>
        {openLots.length ? <Alert tone="warning" title={`Inspection ${openLots.map((l: any) => l.number).join(', ')} is still open`}>Record the inspection results before closing.</Alert>
          : <div className="text-sm secondary">Material issued to the shop floor (WIP) for {wo.number} is written off as consumed, and the work order leaves the open list.</div>}
      </Modal>
    </>
  );
}
