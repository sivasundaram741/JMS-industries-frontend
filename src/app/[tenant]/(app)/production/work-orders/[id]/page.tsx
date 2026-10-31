'use client';
import { Fragment, useEffect, useState } from 'react';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Check, ChevronDown, ChevronRight as ChevronR, CircleAlert, CircleCheck,
  CirclePause, CirclePlay, Factory, Forklift, GitFork, Hammer, Hourglass, NotebookPen, Square, SquareCheck,
  Lock, MessageSquare, Play, Plus, Send, ShieldCheck, ShoppingCart, SlidersHorizontal, Trash2, Truck,
} from 'lucide-react';
import { del, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useTenantHref } from '@/lib/hooks';
import { ago, date, dateShort, num } from '@/lib/format';
import { WO_STATUSES, toneOf, type Tone } from '@/lib/status';
import { FLOWS, HOLD_CAUSES, flowsOf, holdCauseOf, isPicked, pickFlow, type HoldCause, type WoKind } from '@/lib/workorder';
import {
  Alert, Badge, Button, ButtonLink, Card, Chip, DataTable, ErrorBox,
  KeyValue, ListItem, Loading, Modal, PageHeader, RowMenuButton, StatusBadge, TextField, Two, useContextMenu, useToast,
} from '@/components/ui';
import { SupplierChip, SuppliersSummary, materialMenu, operationMenu, type Vendor } from '@/components/SupplierMenu';
import { Gauge } from '@/components/charts/BarChart';
import { MoreMenu, WorkOrderNote } from '../../_components/shared';
import { RouteCard, RouteNext } from '@/components/RouteCard';
import { routeOf } from '@/lib/route';
import { IssueDialog, MaterialQcDialog, MoveDialog, RecordDialog } from './_components/dialogs';
import { DayWiseLog } from './_components/DayWiseLog';
import { Attachments } from '@/components/docs/Attachments';
import { AdjustModal } from '../../../warehouse/stock/_components/AdjustModal';

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

type Tab = 'details' | 'ops' | 'mats' | 'log' | 'qc' | 'activity';

export default function WorkOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: wo, error, mutate } = useApi<any>(`/work-orders/${id}`);
  const { data: machines } = useApi<any[]>('/machines');
  const [busy, setBusy] = useState('');
  const [dlg, setDlg] = useState<'' | 'issue' | 'record' | 'move' | 'hold' | 'complete' | 'close' | 'task' | 'kind'>('');
  const [kind, setKind] = useState<WoKind | null>(null);
  const [reason, setReason] = useState('');
  const [cause, setCause] = useState<HoldCause | ''>('');
  const [task, setTask] = useState('');
  const [allActivity, setAllActivity] = useState(false);
  const [tab, setTab] = useState<Tab>('details');
  const [expandedOps, setExpandedOps] = useState<Set<number>>(new Set());
  const [qcMat, setQcMat] = useState<any>(null);
  const [adjMat, setAdjMat] = useState<any>(null);
  // Who supplies each line on this job: right-click a material or operation (or its ⋯ button)
  const menu = useContextMenu();
  const { data: vendorPage } = useApi<any>(can('wo', 'edit') ? '/vendors?pageSize=200' : null);
  // Opened from the shop floor with ?do=record: go straight to recording output
  const doParam = useSearchParams().get('do');
  const [autoDone, setAutoDone] = useState(false);
  useEffect(() => {
    if (!wo || autoDone || !doParam) return;
    setAutoDone(true);
    if (doParam === 'record' && wo.actions.includes('record') && can('wo', 'edit')) setDlg('record');
  }, [wo, doParam, autoDone, can]);

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
  const canIssue = wo.actions.includes('issue') && wo.materials.length > 0 && (edit || can('stockentry', 'edit'));
  const canAdjust = can('inventory', 'edit');
  const waiting = r3(wo.qtyCompleted - wo.qtyToQc);
  const remaining = r3(Math.max(0, wo.qtyPlanned - wo.qtyCompleted));
  const partial = wo.qtyToQc > 0 && wo.qtyToQc < wo.qtyPlanned;
  const tone = toneOf('wo', wo.status);
  const ops: any[] = wo.operations;
  const opDone = (o: any) => o.status === 'Done' || o.qtyDone >= wo.qtyPlanned - 0.0005;
  const curOp = ops.findIndex((o) => !opDone(o));
  const openLots = wo.inspections.filter((l: any) => ['Pending', 'In progress'].includes(l.status));
  const shortParts = wo.materials.filter((m: any) => partState(m).label === 'Short');
  const allIssued = wo.materials.length > 0 && wo.materials.every((m: any) => m.qtyIssued >= m.qtyRequired - 0.0005);
  const isOpen = !['Completed', 'Closed'].includes(wo.status);
  const jobWorkOk = can('subcon', 'create') && isOpen;
  const poOk = can('purchase', 'create') && isOpen;
  const flows = flowsOf(wo);
  const poHref = `/purchase/orders/new?type=PO&wo=${wo.id}`;
  const jwHref = `/purchase/orders/new?type=JOB_WORK&wo=${wo.id}`;
  const canChangeKind = can('wo', 'edit') && isOpen && wo.type !== 'Service';
  async function saveKind() {
    if (!kind) return;
    setBusy('kind');
    try { done(await patch(`/work-orders/${wo.id}/kind`, kind)); toast.ok('Kind of job changed'); }
    catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  // The job's own route through the shop, and the one thing to do next
  const route = routeOf(wo);
  const nx = route.next;

  // Estimated daily material consumption (BOM-based: rate × good qty)
  const totalGood = wo.entries?.reduce((a: number, e: any) => a + e.qtyGood, 0) || 0;
  const matConsumption = wo.materials.map((m: any) => ({
    ...m,
    qtyConsumed: wo.qtyPlanned > 0 ? r3((m.qtyRequired / wo.qtyPlanned) * totalGood) : 0,
  }));

  const canEdit = can('wo', 'edit');

  // Checklist edits return the whole work order, so the page just takes what comes back.
  async function tickTask(c: any) {
    setBusy('task' + c.id);
    try { mutate(await patch(`/work-orders/${wo.id}/checklist/${c.id}`, { done: !c.done }), false); }
    catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  async function dropTask(c: any) {
    setBusy('task' + c.id);
    try { mutate(await del(`/work-orders/${wo.id}/checklist/${c.id}`), false); }
    catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  async function addTask() {
    setBusy('task');
    try { mutate(await post(`/work-orders/${wo.id}/checklist`, { task: task.trim() }), false); setDlg(''); }
    catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  // Supplier plan for this job: change a line's supplier, and raise one order per supplier for what is not ordered yet
  const vendors: Vendor[] = vendorPage?.rows || [];
  const planEditable = canEdit && isOpen;
  const orderHref = (id?: number | null) => (id ? `/purchase/orders/${id}` : null);
  async function changeLine(kind: 'mat' | 'op', lineId: number, body: any, msg: string) {
    setBusy(kind + lineId);
    try {
      mutate(await patch(`/work-orders/${wo.id}/${kind === 'mat' ? 'materials' : 'operations'}/${lineId}/${kind === 'mat' ? 'source' : 'outside'}`, body), false);
      toast.ok(msg);
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  async function raisePlan() {
    setBusy('raise');
    try {
      const r = await post(`/work-orders/${wo.id}/raise-outside`);
      mutate(r.workOrder, false);
      toast.ok(`Raised ${r.created.join(', ')} as drafts · send them for approval from each order`);
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  const vendorLabel = (id: number) => vendors.find((v) => v.id === id)?.name || 'the supplier';
  const matMenuFor = (m: any) => (e: React.MouseEvent) => menu.open(e, m.itemName, materialMenu({
    source: m.source, vendorId: m.vendorId, vendorName: m.vendorName, vendors, editable: planEditable, orderNo: m.poNumber,
    onStore: () => changeLine('mat', m.id, { source: 'stock' }, `${m.itemName} will be issued from our store`),
    onBuy: (v) => changeLine('mat', m.id, { source: 'buy', vendorId: v }, `${m.itemName} will be bought from ${vendorLabel(v)}`),
    onOpenOrder: m.purchaseOrderId ? () => router.push(tenantHref(`/purchase/orders/${m.purchaseOrderId}`)) : undefined,
  }));
  const opMenuFor = (o: any) => (e: React.MouseEvent) => menu.open(e, o.name, operationMenu({
    doneBy: o.doneBy, vendorId: o.vendorId, vendorName: o.vendorName, vendors, editable: planEditable, orderNo: o.poNumber,
    onInhouse: () => changeLine('op', o.id, { doneBy: 'inhouse' }, `${o.name} will be done in our shop`),
    onOutside: (v) => changeLine('op', o.id, { doneBy: 'outside', vendorId: v }, `${o.name} will be sent to ${vendorLabel(v)}`),
    onOpenOrder: o.purchaseOrderId ? () => router.push(tenantHref(`/purchase/orders/${o.purchaseOrderId}`)) : undefined,
  }));
  const planBuy = wo.materials.filter((m: any) => m.source === 'buy');
  const planOut = ops.filter((o: any) => o.doneBy === 'outside');
  const pendingPlan = [...planBuy, ...planOut].filter((x: any) => x.vendorId && !x.purchaseOrderId);
  const pendingSuppliers = new Set(pendingPlan.map((x: any) => x.vendorId)).size;
  const canRaisePlan = pendingPlan.length > 0 && isOpen && (poOk || jobWorkOk);
  const planLines = [
    ...planBuy.map((m: any) => ({ vendorName: m.vendorName, kind: 'buy' as const, what: m.itemName, orderNo: m.poNumber, orderHref: orderHref(m.purchaseOrderId), orderStatus: m.poStatus })),
    ...planOut.map((o: any) => ({ vendorName: o.vendorName, kind: 'outside' as const, what: o.name, orderNo: o.poNumber, orderHref: orderHref(o.purchaseOrderId), orderStatus: o.poStatus })),
  ];
  const raisePlanButton = canRaisePlan
    ? <Button variant={nx.key === 'none' ? 'primary' : undefined} icon={Truck} loading={busy === 'raise'} onClick={raisePlan}>Raise orders for {pendingSuppliers} supplier{pendingSuppliers === 1 ? '' : 's'}</Button>
    : null;

  const nextTask = nx.key === 'task' ? wo.checklist.find((c: any) => c.id === nx.taskId) : null;
  const nextButton = (() => {
    switch (nx.key) {
      case 'release': return has('release') ? <Button variant="primary" icon={Send} loading={busy === 'release'} onClick={() => act('release', {}, (r) => (r.approvalPending ? 'Release sent for approval' : `${r.number} released`))}>Release</Button> : null;
      case 'resume': return has('resume') ? <Button variant="primary" icon={CirclePlay} loading={busy === 'resume'} onClick={() => act('resume', {}, (r) => `${r.number} resumed`)}>Resume</Button> : null;
      case 'issue': return canIssue ? <Button variant="primary" icon={Forklift} onClick={() => setDlg('issue')}>Issue material</Button> : null;
      case 'start': return has('start') ? <Button variant="primary" icon={Play} loading={busy === 'start'} onClick={() => act('start', {}, (r) => `${r.number} started`)}>Start</Button> : null;
      case 'record': return has('record') ? <Button variant="primary" icon={Check} onClick={() => setDlg('record')}>Record production</Button> : null;
      case 'task': return nextTask && canEdit ? <Button variant="primary" icon={SquareCheck} loading={busy === 'task' + nextTask.id} onClick={() => tickTask(nextTask)}>Mark step done</Button> : null;
      case 'assemble': return has('assemble') ? <Button variant="primary" icon={Hammer} loading={busy === 'assemble'} onClick={() => act('assemble', {}, (r) => `${r.number} is on the assembly bench`)}>Send to assembly</Button> : null;
      case 'move': return has('move-to-quality') ? <Button variant="primary" icon={ShieldCheck} onClick={() => setDlg('move')}>Move to QC</Button> : null;
      case 'complete': return has('complete') ? <Button variant="primary" icon={CircleCheck} onClick={() => setDlg('complete')}>Complete</Button> : null;
      case 'inspect': return nx.href ? <ButtonLink variant="primary" icon={ShieldCheck} href={nx.href}>Open inspection</ButtonLink> : null;
      case 'close': return has('close') ? <Button variant="primary" icon={Lock} loading={busy === 'close'} onClick={() => setDlg('close')}>Close work order</Button> : null;
      default: return null;
    }
  })();

  const TABS: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'details', label: 'Work Order Details' },
    { key: 'ops', label: 'Operations', count: ops.length },
    { key: 'mats', label: 'Raw Materials', count: wo.materials.length },
    { key: 'log', label: 'Production Log', count: wo.entries?.length || 0 },
    { key: 'qc', label: 'Quality', count: wo.inspections?.length || 0 },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <>
      <PageHeader
        back="/production/work-orders"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Production' }, { label: 'Work Orders', href: '/production/work-orders' }, { label: wo.number }]}
        title={wo.number}
        tags={<>
          <StatusBadge kind="wo" status={wo.status} />
          {wo.status === 'On Hold' && holdCauseOf(wo.holdCause) ? <Badge tone={holdCauseOf(wo.holdCause)!.tone}>{holdCauseOf(wo.holdCause)!.label}</Badge> : null}
          {partial ? <Badge tone="purple" dot={false}>Partial</Badge> : null}
          {wo.late ? <Badge tone="danger">Late</Badge> : null}
          {wo.approvalPending ? <Badge tone="warning">Approval pending</Badge> : null}
        </>}
        sub={<>
          {wo.itemName} · {num(wo.qtyCompleted)} of {num(wo.qtyPlanned)} {wo.uom} done
          {' · '}<span className={wo.late ? 'f-danger strong' : ''}>due {date(wo.dueDate)}</span>
        </>}
        actions={<>
          <MoreMenu items={[
            has('hold') && { label: 'Put on hold', icon: CirclePause, onClick: () => { setReason(''); setDlg('hold'); } },
            has('move-to-quality') && waiting > 0 && nx.key !== 'move' && { label: `Move ${num(waiting)} to QC`, icon: ShieldCheck, onClick: () => setDlg('move') },
            has('complete') && { label: wo.qtyCompleted < wo.qtyPlanned ? 'Short-close' : 'Complete work order', icon: CircleCheck, onClick: () => setDlg('complete') },
            poOk && { label: 'Raise purchase order', icon: ShoppingCart, onClick: () => router.push(tenantHref(poHref)) },
            jobWorkOk && { label: 'Raise job work', icon: Truck, onClick: () => router.push(tenantHref(jwHref)) },
            canChangeKind && { label: 'Change kind of job', icon: SlidersHorizontal, onClick: () => { setKind({ type: wo.type, buysParts: !!wo.buysParts, sendsOut: !!wo.sendsOut }); setDlg('kind'); } },
          ]} />
          {/* The main next step lives on the route card; these two are needed at any time while the job runs */}
          {canIssue && nx.key !== 'issue' ? <Button icon={Forklift} onClick={() => setDlg('issue')}>Issue material</Button> : null}
          {has('record') && !['record', 'task'].includes(nx.key) ? <Button icon={Check} onClick={() => setDlg('record')}>Record production</Button> : null}
        </>}
      />

      <WorkOrderNote notes={wo.notes} />

      {/* ── Route card: this job's own path through the shop, and what to do next ── */}
      <RouteCard wo={wo} steps={route.steps}>
        <RouteNext title={nx.title} why={nx.why}>
          {nextButton}
          {raisePlanButton}
          {route.also.filter((x) => !(x.key === 'raise-po' && planBuy.some((m: any) => !m.purchaseOrderId)) && !(x.key === 'raise-jw' && planOut.some((o: any) => !o.purchaseOrderId))).map((x) => x.key === 'raise-po'
            ? (poOk ? <ButtonLink key={x.key} href={poHref} icon={ShoppingCart}>Raise purchase order</ButtonLink> : null)
            : (jobWorkOk ? <ButtonLink key={x.key} href={jwHref} icon={Truck}>Raise job work</ButtonLink> : null))}
        </RouteNext>
      </RouteCard>

      {/* ── Tab bar ── */}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}{t.count !== undefined ? <span className="cnt">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* ═══ Tab: Work Order Details ═══════════════════════════════════════════ */}
      {tab === 'details' && (
        <>
          {planLines.length ? (
            <Card title="Suppliers for this job" sub="Who supplies what · right-click a material or operation on its tab to change one supplier for this job"
              right={raisePlanButton}>
              <SuppliersSummary lines={planLines} />
            </Card>
          ) : null}
          <div className="grid cols-2">
            <Card title="Work Order Details" id="details">
              <KeyValue items={[
                ['Work order no', wo.number],
                ['Product', <Two key="p" a={wo.itemName} b={wo.itemCode} />],
                ['Qty planned', `${num(wo.qtyPlanned)} ${wo.uom}`],
                ['Qty completed', `${num(wo.qtyCompleted)}${wo.qtyCompleted > 0 && wo.qtyCompleted < wo.qtyPlanned ? ' (partial)' : ''}`],
                ['Scrap', `${num(wo.qtyScrap)} ${wo.uom}`],
                ['Kind of job', <Two key="k" a={flows.map((f) => `${f.n} · ${f.label}`).join(' + ')} b={flows.length > 1 ? 'Some components bought in and some work done outside' : flows[0].sub} />],
                ['Status', wo.status === 'On Hold' && wo.holdReason
                  ? <span key="s" className="f-purple">On Hold · {holdCauseOf(wo.holdCause)?.label || 'held'} · {wo.holdReason}</span>
                  : wo.status],
                ['Due date', <span key="d" className={wo.late ? 'f-danger' : ''}>{date(wo.dueDate)}{wo.late ? ' · late' : ''}</span>],
                ['Machine', wo.machineCode ? `${wo.machineCode} · ${wo.machineName}` : '—'],
                ['Shift', wo.shift ? 'Shift ' + wo.shift : '—'],
              ]} />
            </Card>

            <Card title="Output" sub={`${num(wo.qtyCompleted)} of ${num(wo.qtyPlanned)} ${wo.uom} completed`}>
              <div style={{ display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                <Gauge value={wo.qtyPlanned ? (wo.qtyCompleted / wo.qtyPlanned) * 100 : 0} label={`${num(wo.qtyCompleted)} / ${num(wo.qtyPlanned)} good`} color={`var(--${tone}-solid)`} />
              </div>
              <KeyValue items={[
                ['Remaining', `${num(remaining)} ${wo.uom}`],
                ['Scrap', `${num(wo.qtyScrap)} (${wo.qtyCompleted + wo.qtyScrap ? num((wo.qtyScrap / (wo.qtyCompleted + wo.qtyScrap)) * 100, 1) : 0}%)`],
                ['Sent to quality', num(wo.qtyToQc)],
                ['Waiting for QC', <span key="w" className={waiting > 0 ? 'f-warning' : ''}>{num(waiting)}</span>],
              ]} />
            </Card>
          </div>

          {wo.checklist?.length ? (
            <Card
              title="Service checklist"
              sub={`${wo.checklist.filter((c: any) => c.done).length} of ${wo.checklist.length} done · every step has to be ticked before this job can be closed`}
              right={canEdit ? <Button size="sm" icon={Plus} onClick={() => { setTask(''); setDlg('task'); }}>Add step</Button> : null}
            >
              <div className="list">
                {wo.checklist.map((c: any) => (
                  <div key={c.id} className="li">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={c.done ? `Reopen ${c.task}` : `Mark done: ${c.task}`}
                      disabled={!canEdit || busy === 'task' + c.id}
                      onClick={() => tickTask(c)}
                      style={{ color: c.done ? 'var(--success-fg)' : 'var(--text-tertiary)' }}
                    >
                      {c.done ? <SquareCheck size={18} /> : <Square size={18} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={'lt truncate' + (c.done ? ' muted' : '')} style={c.done ? { textDecoration: 'line-through' } : undefined}>{c.task}</div>
                      <div className="ls truncate">{c.done ? `${c.doneBy || 'done'} · ${ago(c.doneAt)}` : 'not done yet'}</div>
                    </div>
                    {canEdit ? <button type="button" className="icon-btn" aria-label={`Remove ${c.task}`} onClick={() => dropTask(c)}><Trash2 size={16} /></button> : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {shortParts.length ? (
            <Alert tone="warning" title={`${shortParts.length} material${shortParts.length === 1 ? '' : 's'} short in RM Store`}
              action={canIssue ? <Button size="sm" icon={Forklift} onClick={() => setDlg('issue')}>Issue</Button> : undefined}>
              {shortParts.map((m: any) => `${m.itemName}: need ${num(r3(m.qtyRequired - m.qtyIssued - m.stockAvailable), 3)} more`).join(' · ')}
            </Alert>
          ) : allIssued ? (
            <Alert tone="success" title="All materials issued to shop floor"
              action={waiting > 0 && has('move-to-quality') ? <Button size="sm" onClick={() => setDlg('move')}>Move {num(waiting)} to QC</Button> : undefined}>
              {waiting > 0 ? `${num(waiting)} finished pieces waiting for quality` : 'Material consumed when the work order closes'}
            </Alert>
          ) : null}

          <div className="grid cols-2">
            <Card title="Partial production & split" id="split">
              <div className="list">
                {wo.parentWoNo ? <ListItem icon={GitFork} tone="purple" title={`Split from ${wo.parentWoNo}`} sub="This order carries the parent's remaining quantity" href={`/production/work-orders/${wo.parentWoId}`} /> : null}
                {wo.children.map((c: any) => (
                  <ListItem key={c.id} icon={GitFork} tone="warning" title={`${c.number} · ${num(c.qtyPlanned)} ${wo.uom}`} sub={`Split · ${num(c.qtyCompleted)} / ${num(c.qtyPlanned)} done`} right={<StatusBadge kind="wo" status={c.status} />} href={`/production/work-orders/${c.id}`} />
                ))}
                {!wo.parentWoNo && !wo.children.length && <div className="text-sm muted">No split · use Move to Quality to split remaining quantity.</div>}
              </div>
              {has('move-to-quality') && waiting > 0 ? <div style={{ marginTop: 12 }}><Button size="sm" icon={GitFork} onClick={() => setDlg('move')}>Move {num(waiting)} to quality{remaining > 0 ? ' · split' : ''}</Button></div> : null}
            </Card>
          </div>
        </>
      )}

      {/* ═══ Tab: Operations ════════════════════════════════════════════════════ */}
      {tab === 'ops' && (
        <Card title="Operations / Routing" id="routing"
          sub={`${ops.length} operation${ops.length === 1 ? '' : 's'} · ${ops.filter(opDone).length} done · click row to expand daily log`}
          right={<div className="row" style={{ gap: 8 }}>{has('record') ? <Button size="sm" variant="primary" icon={Plus} onClick={() => setDlg('record')}>Log Entry</Button> : null}<ButtonLink href="/production/shop-floor" size="sm" icon={Factory}>Shop Floor</ButtonLink></div>}>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>#</th>
                  <th>Operation</th>
                  <th>Done by</th>
                  <th>Machine</th>
                  <th>Status</th>
                  <th className="r">Planned</th>
                  <th className="r">Done</th>
                  <th className="r">Scrap</th>
                  <th className="r">Progress</th>
                  <th style={{ width: 110 }} />
                </tr>
              </thead>
              <tbody>
                {ops.map((o, i) => {
                  const isDone = opDone(o);
                  const isActive = !isDone && i === curOp;
                  const isExpanded = expandedOps.has(o.id);
                  const opEntries = (wo.entries || []).filter((e: any) => e.operationId === o.id);
                  const toggle = () => setExpandedOps((s) => { const n = new Set(s); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; });
                  return (
                    <Fragment key={o.id}>
                      <tr className={`click ${isDone ? 'op-row-done' : isActive ? 'op-row-active' : ''}`} onClick={toggle} onContextMenu={opMenuFor(o)} style={{ cursor: 'pointer' }}>
                        <td><span className="muted secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isExpanded ? <ChevronDown size={14} /> : <ChevronR size={14} />}</span></td>
                        <td className="num secondary">{o.seq}</td>
                        <td className="strong">{o.name}</td>
                        <td onClick={(e) => e.stopPropagation()}><SupplierChip kind={o.doneBy === 'outside' ? 'outside' : 'inhouse'} name={o.vendorName} orderNo={o.poNumber} orderHref={orderHref(o.purchaseOrderId)} onClick={opMenuFor(o)} /></td>
                        <td>{o.doneBy === 'outside' ? <span className="muted secondary text-xs">At the supplier</span> : o.machineCode ? <Chip>{o.machineCode}</Chip> : <span className="muted secondary text-xs">Bench</span>}</td>
                        <td>
                          <Badge tone={isDone ? 'success' : isActive ? 'warning' : 'neutral'}>
                            {isDone ? 'Done' : isActive ? 'Active' : 'Pending'}
                          </Badge>
                        </td>
                        <td className="r num">{num(wo.qtyPlanned)}</td>
                        <td className="r num"><span className={isDone ? 'f-success strong' : isActive ? 'f-warning strong' : ''}>{num(o.qtyDone)}</span></td>
                        <td className="r num">{o.qtyScrap > 0 ? <span className="f-danger">{num(o.qtyScrap)}</span> : <span className="muted">—</span>}</td>
                        <td className="r" style={{ minWidth: 90 }}>
                          <div style={{ background: 'var(--bg-muted)', borderRadius: 2, height: 5, overflow: 'hidden' }}>
                            <div style={{ width: `${wo.qtyPlanned ? Math.min(100, (o.qtyDone / wo.qtyPlanned) * 100) : 0}%`, height: '100%', background: isDone ? 'var(--success-solid)' : 'var(--brand)' }} />
                          </div>
                          <div className="text-xs muted" style={{ marginTop: 2, textAlign: 'right' }}>{wo.qtyPlanned ? `${Math.round((o.qtyDone / wo.qtyPlanned) * 100)}%` : '—'}</div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                          <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                            {has('record') && isActive ? <button type="button" className="btn xs primary" onClick={(e) => { e.stopPropagation(); setDlg('record'); }}>Log</button> : null}
                            <RowMenuButton label={`Options for ${o.name}`} onClick={opMenuFor(o)} />
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={11} style={{ padding: '0 0 0 28px', background: 'var(--bg-subtle)' }}>
                            {opEntries.length ? (
                              <table className="tbl" style={{ fontSize: 12 }}>
                                <thead>
                                  <tr style={{ background: 'var(--bg-muted)' }}>
                                    <th>Date</th><th>Shift</th><th>Operator</th><th className="r">Good</th><th className="r">Scrap</th><th className="r">Downtime</th><th className="r">Run h</th><th>Notes</th><th>Logged by</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {opEntries.map((e: any) => (
                                    <tr key={e.id}>
                                      <td className="strong nowrap">{dateShort(e.entryDate)}</td>
                                      <td className="secondary">Shift {e.shift || '—'}</td>
                                      <td className="secondary">{e.operator || '—'}</td>
                                      <td className="r num f-success">{num(e.qtyGood)}</td>
                                      <td className="r num">{e.qtyScrap > 0 ? <span className="f-danger">{num(e.qtyScrap)}</span> : <span className="muted">—</span>}</td>
                                      <td className="r num">{e.downtimeMin > 0 ? <span className="f-warning">{e.downtimeMin} min</span> : <span className="muted">—</span>}</td>
                                      <td className="r num secondary">{num(e.runHours, 1)}</td>
                                      <td className="secondary" style={{ maxWidth: 220 }}>{e.notes || <span className="muted">—</span>}</td>
                                      <td className="secondary text-xs">{e.loggedBy || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr style={{ background: 'var(--bg-muted)', fontWeight: 600 }}>
                                    <td colSpan={3}>Total ({opEntries.length} entries)</td>
                                    <td className="r num">{num(opEntries.reduce((a: number, e: any) => a + e.qtyGood, 0))}</td>
                                    <td className="r num">{num(opEntries.reduce((a: number, e: any) => a + e.qtyScrap, 0))}</td>
                                    <td className="r num">{opEntries.reduce((a: number, e: any) => a + e.downtimeMin, 0)} min</td>
                                    <td className="r num">{num(opEntries.reduce((a: number, e: any) => a + e.runHours, 0), 1)} h</td>
                                    <td colSpan={2} />
                                  </tr>
                                </tfoot>
                              </table>
                            ) : (
                              <div className="text-xs muted" style={{ padding: '10px 14px' }}>No production logged for this operation yet.</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {ops.length === 0 && <tr><td colSpan={10} className="muted secondary" style={{ textAlign: 'center', padding: '20px 0' }}>No operations on this work order</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ═══ Tab: Raw Materials ═════════════════════════════════════════════════ */}
      {tab === 'mats' && (
        <>
          <DataTable
            toolbar={
              <div className="toolbar">
                <div><div className="tt">Raw Material Requirement & Issue</div><div className="ts">RM Store → shop floor · planned vs issued vs consumed</div></div>
                <div className="spacer" />
                {canIssue ? <Button size="sm" icon={Forklift} onClick={() => setDlg('issue')}>Issue Material</Button> : null}
              </div>
            }
            rows={matConsumption}
            empty="No materials on this work order"
            onRowContextMenu={(m, e) => matMenuFor(m)(e)}
            columns={[
              { key: 'item', header: 'Material', render: (m) => <Two a={m.itemName} b={`${m.itemCode} · ${inHouse(m) ? 'production' : m.itemType === 'CONSUMABLE' ? 'consumable' : 'bought-out'}`} /> },
              { key: 'from', header: 'Comes from', render: (m) => <SupplierChip kind={m.source === 'buy' ? 'buy' : 'stock'} name={m.vendorName} orderNo={m.poNumber} orderHref={orderHref(m.purchaseOrderId)} onClick={matMenuFor(m)} /> },
              { key: 'req', header: 'Required', align: 'right', render: (m) => <span className="nowrap num">{num(m.qtyRequired, 3)} {m.uom}</span> },
              { key: 'iss', header: 'Issued', align: 'right', render: (m) => <span className="num">{num(m.qtyIssued, 3)}</span> },
              { key: 'bal', header: 'To Issue', align: 'right', render: (m) => { const bal = r3(m.qtyRequired - m.qtyIssued); return <span className={bal > 0 ? 'num f-warning' : 'num muted'}>{num(Math.max(0, bal), 3)}</span>; } },
              { key: 'consumed', header: 'Est. Consumed', align: 'right', render: (m) => <span className="num secondary">{m.qtyConsumed > 0 ? num(m.qtyConsumed, 3) : '—'}</span> },
              {
                key: 'stock', header: 'In RM Store', align: 'right', render: (m) => {
                  const short = m.stockAvailable < r3(m.qtyRequired - m.qtyIssued) - 0.0005;
                  return (
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <span className={short ? 'num f-danger strong' : 'num'}>{num(m.stockAvailable, 3)}</span>
                      {canAdjust ? (
                        <button type="button" className="btn xs" title={`Adjust ${m.itemName} stock in RM Store`}
                          onClick={(e) => { e.stopPropagation(); setAdjMat(m); }}>
                          <SlidersHorizontal size={12} />
                        </button>
                      ) : null}
                    </div>
                  );
                },
              },
              { key: 'st', header: 'Status', render: (m) => { const st = partState(m); return <Badge tone={st.tone}>{st.label}</Badge>; } },
              {
                key: 'qc', header: 'QC', render: (m) => {
                  const qs = m.qcStatus || 'Pending';
                  const tone = qs === 'Pass' ? 'success' : qs === 'Fail' ? 'danger' : 'neutral';
                  return (
                    <div className="row" style={{ gap: 6 }}>
                      <Badge tone={tone}>{qs}</Badge>
                      {edit ? (
                        <button type="button" className="btn xs" onClick={() => setQcMat(m)} title="Log QC inspection">
                          <ShieldCheck size={12} />
                        </button>
                      ) : null}
                    </div>
                  );
                }
              },
              { key: 'menu', header: '', render: (m) => <RowMenuButton label={`Options for ${m.itemName}`} onClick={matMenuFor(m)} /> },
            ]}
          />
          {totalGood > 0 && (
            <Alert tone="info" title="Estimated consumption based on BOM">
              {num(totalGood)} {wo.uom} produced. Material consumption above is calculated from the BOM ratio (actual may vary by scrap and rework).
            </Alert>
          )}
          {qcMat && (
            <MaterialQcDialog wo={wo} material={qcMat} onClose={() => setQcMat(null)} onDone={(updated) => { mutate(updated); setQcMat(null); }} />
          )}
          <AdjustModal
            open={!!adjMat}
            fixedItem={adjMat ? { id: adjMat.itemId, code: adjMat.itemCode, name: adjMat.itemName, uom: adjMat.uom } : null}
            fixedWarehouse="RM"
            onClose={() => setAdjMat(null)}
            onDone={() => { setAdjMat(null); mutate(); }}
          />
        </>
      )}

      {/* ═══ Tab: Production Log ════════════════════════════════════════════════ */}
      {tab === 'log' && (
        <>
          <DayWiseLog wo={wo} canRecord={has('record')} onAdd={() => setDlg('record')} />

          <DataTable
            toolbar={<div className="toolbar"><div><div className="tt">Individual entries</div><div className="ts">Every shift posting behind the day totals above</div></div></div>}
            rows={wo.entries}
            empty="No production recorded yet — click Add Entry to log daily output"
            columns={[
              { key: 'date', header: 'Date', render: (e) => <div><div className="strong nowrap">{dateShort(e.entryDate)}</div><div className="text-xs muted">{e.shift ? `Shift ${e.shift}` : '—'}</div></div> },
              { key: 'op', header: 'Operation · Machine', render: (e) => <div><div className="row" style={{ gap: 6 }}><span className="strong nowrap">Op {e.seq}</span>{e.machineCode ? <Chip>{e.machineCode}</Chip> : null}</div><div className="text-xs muted truncate">{e.operationName}</div></div> },
              { key: 'operator', header: 'Operator', render: (e) => <span className="secondary">{e.operator || '—'}</span> },
              { key: 'good', header: 'Good', align: 'right', render: (e) => <span className="strong num f-success">{num(e.qtyGood)} {wo.uom}</span> },
              { key: 'scrap', header: 'Scrap', align: 'right', render: (e) => <span className={e.qtyScrap ? 'num f-danger' : 'muted'}>{num(e.qtyScrap)}</span> },
              { key: 'down', header: 'Downtime', align: 'right', render: (e) => <span className={e.downtimeMin ? 'nowrap f-warning' : 'muted'}>{num(e.downtimeMin)} min</span> },
              { key: 'run', header: 'Run h', align: 'right', render: (e) => <span className="num secondary">{num(e.runHours, 1)}</span> },
            ]}
          />
          {wo.materials.length > 0 && wo.entries?.length > 0 && (
            <Card title="Raw Material — Daily Consumption Estimate" sub="Calculated from BOM ratio per good piece produced">
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Material</th><th className="r">Per Unit ({wo.uom})</th><th className="r">Total Made</th><th className="r">Est. Consumed</th><th className="r">Issued</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {matConsumption.map((m: any) => (
                      <tr key={m.id}>
                        <td><Two a={m.itemName} b={m.itemCode} /></td>
                        <td className="r num secondary">{num(wo.qtyPlanned > 0 ? r3(m.qtyRequired / wo.qtyPlanned) : 0, 4)} {m.uom}</td>
                        <td className="r num">{num(totalGood)} {wo.uom}</td>
                        <td className="r num strong">{num(m.qtyConsumed, 3)} {m.uom}</td>
                        <td className="r num">{num(m.qtyIssued, 3)}</td>
                        <td><Badge tone={partState(m).tone}>{partState(m).label}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ═══ Tab: Quality ═══════════════════════════════════════════════════════ */}
      {tab === 'qc' && (
        <>
          <Card
            title="Quality"
            sub="The last step before this work order closes · pieces sent to quality are inspected lot by lot"
            right={has('move-to-quality') && waiting > 0 ? <Button size="sm" variant="primary" icon={ShieldCheck} onClick={() => setDlg('move')}>Move {num(waiting)} to QC</Button> : undefined}
          >
            <KeyValue items={[
              ['Made so far', `${num(wo.qtyCompleted)} ${wo.uom}`],
              ['Sent to quality', `${num(wo.qtyToQc)} ${wo.uom}`],
              ['Still on the floor', <span key="w" className={waiting > 0 ? 'f-warning strong' : ''}>{num(waiting)} {wo.uom}</span>],
              ['Accepted', `${num(wo.inspections.reduce((a: number, l: any) => a + Number(l.qtyAccepted || 0), 0))} ${wo.uom}`],
              ['Rejected', <span key="r" className={wo.inspections.some((l: any) => Number(l.qtyRejected)) ? 'f-danger strong' : ''}>
                {num(wo.inspections.reduce((a: number, l: any) => a + Number(l.qtyRejected || 0), 0))} {wo.uom}
              </span>],
            ]} />
          </Card>

          <DataTable
            toolbar={<div className="toolbar">
              <div>
                <div className="tt">Inspection lots</div>
                <div className="ts">One lot per batch of pieces sent across · open a lot to record the measurements</div>
              </div>
              <div className="spacer" />
              {openLots.length ? <Chip>{openLots.length} waiting for a decision</Chip> : null}
            </div>}
            rows={wo.inspections}
            rowKey="id"
            rowHref={(l: any) => `/quality/inspections/${l.id}`}
            empty="Nothing has gone to quality yet · finished pieces are sent across with Move to QC"
            columns={[
              { key: 'no', header: 'Lot', render: (l: any) => <Two a={l.number} b={`${num(l.qty)} ${wo.uom}`} /> },
              { key: 'status', header: 'Status', render: (l: any) => <StatusBadge kind="lot" status={l.status} /> },
              { key: 'acc', header: 'Accepted', align: 'right', render: (l: any) => (Number(l.qtyAccepted) ? <span className="num f-success strong">{num(l.qtyAccepted)}</span> : <span className="muted">—</span>) },
              { key: 'rej', header: 'Rejected', align: 'right', render: (l: any) => (Number(l.qtyRejected) ? <span className="num f-danger strong">{num(l.qtyRejected)}</span> : <span className="muted">—</span>) },
              { key: 'next', header: '', render: (l: any) => <span className="text-xs muted">{['Pending', 'In progress'].includes(l.status) ? 'Open it to record the result' : 'Decision recorded'}</span> },
            ]}
          />
        </>
      )}

      {/* ═══ Tab: Activity ══════════════════════════════════════════════════════ */}
      {tab === 'activity' && (
        <>
          <Card title="Activity log" sub="All events and status changes">
            <div className="timeline">
              {wo.activity.length ? (allActivity ? wo.activity : wo.activity.slice(0, 8)).map((a: any) => (
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
            {wo.activity.length > 8 ? <Button size="xs" variant="ghost" onClick={() => setAllActivity(!allActivity)}>{allActivity ? 'Show less' : `Show all ${wo.activity.length}`}</Button> : null}
          </Card>
          <Card title="Linked outside orders" sub="What was sent out to a vendor, and what was bought in, for this work order"
            right={poOk || jobWorkOk ? <div className="row" style={{ gap: 6 }}>
              {poOk ? <ButtonLink href={poHref} size="sm" icon={Plus}>Raise purchase order</ButtonLink> : null}
              {jobWorkOk ? <ButtonLink href={jwHref} size="sm" icon={Plus}>Raise job work</ButtonLink> : null}
            </div> : null}>
            <div className="list">
              {wo.jobWork.length ? wo.jobWork.map((j: any) => {
                const out = j.type === 'JOB_WORK';
                return (
                  <ListItem key={j.id} icon={out ? Truck : ShoppingCart} tone={out ? 'teal' : 'info'}
                    title={`${j.number} · ${j.vendorName}`}
                    sub={`${out ? 'Sent out for job work' : 'Parts bought in'}${j.needBy ? ' · need by ' + date(j.needBy) : ''}`}
                    right={<StatusBadge kind="po" status={j.status} />} href={`/purchase/orders/${j.id}`} />
                );
              }) : <div className="text-sm muted">Nothing was sent out or bought in for this work order</div>}
            </div>
          </Card>
          <Attachments entityType="WO" entityId={wo.id} entityNo={wo.number} />
        </>
      )}

      {menu.node}

      {/* Dialogs */}
      {dlg === 'issue' ? <IssueDialog wo={wo} onClose={() => setDlg('')} onDone={done} /> : null}
      {dlg === 'record' ? <RecordDialog wo={wo} machines={machines || []} onClose={() => setDlg('')} onDone={done} /> : null}
      {dlg === 'move' ? <MoveDialog wo={wo} machines={machines || []} onClose={() => setDlg('')} onDone={done} /> : null}

      <Modal open={dlg === 'task'} onClose={() => setDlg('')} title="Add a checklist step" sub="One job to get through before this service order can close"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy === 'task'} disabled={!task.trim()} onClick={addTask}>Add step</Button></>}>
        <TextField label="What has to be done" value={task} onChange={setTask} placeholder="e.g. Replace the drive belt" required />
      </Modal>

      <Modal open={dlg === 'kind' && !!kind} onClose={() => setDlg('')} title={`How is ${wo.number} done?`}
        sub="Tick parts from a supplier, work sent outside, or both · a service job keeps its checklist and cannot be changed here"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy === 'kind'} onClick={saveKind}>Save</Button></>}>
        <div className="stack tight" style={{ gap: 6 }}>
          {kind ? FLOWS.filter((f) => f.key !== 'service').map((f) => {
            const on = isPicked(kind, f.key);
            return (
              <button key={f.key} type="button" onClick={() => setKind(pickFlow(kind, f.key))} aria-pressed={on}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: on ? 'var(--brand-subtle)' : 'var(--bg-surface)',
                  border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, color: 'var(--text-primary)' }}>
                <span className={`stage-dot s-${f.tone}`} style={{ marginTop: 2 }}>{f.n}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="text-sm strong" style={{ display: 'block' }}>{f.label}</span>
                  <span className="text-xs secondary">{f.sub}</span>
                </span>
                {f.key !== 'make' ? (on ? <SquareCheck size={16} className="f-info" /> : <Square size={16} className="muted" />) : null}
              </button>
            );
          }) : null}
        </div>
      </Modal>

      <Modal open={dlg === 'hold'} onClose={() => setDlg('')} title={`Put ${wo.number} on hold`} sub="Production stops until someone resumes it · say what is holding it up so it can be chased"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy === 'hold'} disabled={!reason.trim() || !cause} onClick={() => act('hold', { reason: reason.trim(), cause }, (r) => `${r.number} on hold`)}>Put on hold</Button></>}>
        <div className="stack" style={{ gap: 12 }}>
          <div>
            <div className="text-sm strong" style={{ marginBottom: 6 }}>What is holding it up?</div>
            <div className="stack tight" style={{ gap: 6 }}>
              {HOLD_CAUSES.map((c) => (
                <button key={c.value} type="button" onClick={() => setCause(c.value)} aria-pressed={cause === c.value}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    background: cause === c.value ? 'var(--brand-subtle)' : 'var(--bg-surface)',
                    border: `1px solid ${cause === c.value ? 'var(--brand)' : 'var(--border-default)'}`, color: 'var(--text-primary)' }}>
                  <Badge tone={c.tone} dot={false}>{c.label}</Badge>
                  <span className="text-xs secondary" style={{ flex: 1 }}>{c.sub}</span>
                </button>
              ))}
            </div>
          </div>
          <TextField label="In your words" value={reason} onChange={setReason} placeholder="e.g. SS 304 2.0 mm sheet not delivered" required />
        </div>
      </Modal>

      <Modal open={dlg === 'complete'} onClose={() => setDlg('')}
        title={wo.qtyCompleted < wo.qtyPlanned ? `Short-close ${wo.number}?` : `Complete ${wo.number}?`}
        sub={wo.qtyCompleted < wo.qtyPlanned ? `Only ${num(wo.qtyCompleted)} of ${num(wo.qtyPlanned)} made` : `All ${num(wo.qtyPlanned)} ${wo.uom} made`}
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button>
          {wo.qtyCompleted < wo.qtyPlanned
            ? <Button variant="danger" loading={busy === 'complete'} disabled={wo.qtyCompleted <= 0} onClick={() => act('complete', { shortClose: true }, (r) => `${r.number} short-closed`)}>Short-close at {num(wo.qtyCompleted)}</Button>
            : <Button variant="primary" loading={busy === 'complete'} onClick={() => act('complete', {}, (r) => `${r.number} completed`)}>Complete</Button>}
        </>}>
        <div className="stack" style={{ gap: 12 }}>
          {wo.qtyCompleted <= 0 ? <Alert tone="danger" title="Record production before completing" /> : null}
          {wo.qtyCompleted > 0 && wo.qtyCompleted < wo.qtyPlanned ? (
            <Alert tone="warning" title={`${num(remaining)} ${wo.uom} will not be made on this work order`}>To make the rest later, use Move to Quality and split.</Alert>
          ) : null}
          {waiting > 0 ? <div className="text-sm secondary">{num(waiting)} finished pieces not yet in QC will move to QC Hold now.</div> : null}
        </div>
      </Modal>

      <Modal open={dlg === 'close'} onClose={() => setDlg('')} title={`Close ${wo.number}?`} sub="Closing is final · material on shop floor is consumed"
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" loading={busy === 'close'} disabled={openLots.length > 0} onClick={() => act('close', {}, (r) => `${r.number} closed`)}>Close work order</Button></>}>
        {openLots.length ? <Alert tone="warning" title={`Inspection ${openLots.map((l: any) => l.number).join(', ')} still open`}>Record inspection results before closing.</Alert>
          : <div className="text-sm secondary">Material issued to the shop floor for {wo.number} will be consumed, and the work order will leave the open list.</div>}
      </Modal>
    </>
  );
}
