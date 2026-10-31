// A job's route card: the steps this work order takes through the shop, worked out from its own data —
// its flows (made here, parts from a supplier, work sent outside, service), its outside orders, material,
// operations or repair checklist, assembly, final QC and close. Every step is done, now, waiting, blocked or
// still to do, and one "next" says what to press. The full card is on the work order; lists and the Today
// board show the same route in miniature (miniRouteOf), worked out from the list's lighter data.
import { HOLD_CAUSES } from './workorder';

export type StepKey = 'release' | 'outside' | 'material' | 'make' | 'assembly' | 'qc' | 'close';
export type StepState = 'done' | 'now' | 'wait' | 'blocked' | 'todo';
export interface RouteStep { key: StepKey; label: string; state: StepState; sub?: string; stamp?: string; flag?: string }

export type NextKey = 'release' | 'approval' | 'issue' | 'start' | 'record' | 'task' | 'assemble' | 'move' | 'complete' | 'inspect' | 'close' | 'resume' | 'raise-po' | 'raise-jw' | 'none';
export interface NextStep { key: NextKey; title: string; why?: string; href?: string; taskId?: number }

const n = (v: unknown) => Number(v) || 0;
const RECEIVED = ['Received', 'Billed'];
const OPEN_LOT = ['Pending', 'In progress'];
const isService = (t?: string | null) => t === 'Service' || t === 'Internal Service';
const causeLabel = (c?: string | null) => HOLD_CAUSES.find((h) => h.value === c)?.label || 'On hold';

function outsideLabel(buys: boolean, sends: boolean) {
  if (buys && sends) return 'Parts & outside work';
  if (buys) return 'Parts from supplier';
  if (sends) return 'Work sent outside';
  return 'Outside orders';
}

/** The route of one work order, from the detail API (operations, materials, checklist, inspections, jobWork). */
export function routeOf(wo: any): { steps: RouteStep[]; next: NextStep; also: NextStep[] } {
  const status: string = wo.status;
  const service = isService(wo.type);
  const outsourced = wo.type === 'Partial Outsourcing';
  const actions: string[] = wo.actions || [];
  const outside = (wo.jobWork || []).filter((j: any) => j.status !== 'Cancelled');
  const pos = outside.filter((j: any) => j.type === 'PO');
  const jws = outside.filter((j: any) => j.type === 'JOB_WORK');
  const needPo = outsourced && !!wo.buysParts && !pos.length;
  const needJw = outsourced && !!wo.sendsOut && !jws.length;
  const needAny = outsourced && !wo.buysParts && !wo.sendsOut && !outside.length;
  const mats: any[] = wo.materials || [];
  const issuedCount = mats.filter((m) => n(m.qtyIssued) >= n(m.qtyRequired) - 0.0005).length;
  const allIssued = mats.length > 0 && issuedCount === mats.length;
  const ops: any[] = wo.operations || [];
  const opDone = (o: any) => o.status === 'Done' || n(o.qtyDone) >= n(wo.qtyPlanned) - 0.0005;
  const opsDone = ops.filter(opDone).length;
  const curOp = ops.find((o) => !opDone(o));
  const checklist: any[] = wo.checklist || [];
  const ticks = checklist.filter((c) => c.done).length;
  const nextTask = checklist.find((c) => !c.done);
  const lots: any[] = wo.inspections || [];
  const openLots = lots.filter((l) => OPEN_LOT.includes(l.status));
  const waiting = n(wo.qtyCompleted) - n(wo.qtyToQc);
  const finished = ['Completed', 'Closed'].includes(status);
  const makeDone = finished || status === 'In Assembly' || (service ? checklist.length > 0 && ticks === checklist.length && n(wo.qtyCompleted) > 0 : ops.length > 0 && opsDone === ops.length);

  // Which step is current — by status first, then by what is actually done
  let cur: StepKey | null;
  if (status === 'Planned') cur = 'release';
  else if (status === 'Released') cur = mats.length && !allIssued ? 'material' : 'make';
  else if (status === 'In Progress' || status === 'On Hold') cur = !makeDone ? 'make' : wo.needsAssembly ? 'assembly' : 'qc';
  else if (status === 'In Assembly') cur = 'assembly';
  else if (status === 'Completed') cur = openLots.length ? 'qc' : 'close';
  else cur = null; // Closed

  const order: StepKey[] = ['release', 'outside', 'material', 'make', 'assembly', 'qc', 'close'];
  const curIdx = cur ? order.indexOf(cur) : order.length;
  const held = status === 'On Hold';
  const base = (k: StepKey): StepState => {
    const i = order.indexOf(k);
    if (i < curIdx) return 'done';
    if (i === curIdx) return held ? 'blocked' : 'now';
    return 'todo';
  };

  const steps: RouteStep[] = [];
  steps.push({
    key: 'release', label: 'Release', state: base('release'),
    sub: status === 'Planned' ? (wo.approvalPending ? 'Waiting for approval' : 'Not released yet') : 'Released to the floor',
    stamp: 'Released',
  });

  if (outsourced || outside.length) {
    const lines = outside.map((j: any) => `${j.number} · ${RECEIVED.includes(j.status) ? (j.type === 'JOB_WORK' ? 'back' : 'received') : j.status.toLowerCase()}`);
    if (needPo) lines.push('Purchase order not raised');
    if (needJw) lines.push('Job work not raised');
    if (needAny) lines.push('No outside order yet');
    const missing = needPo || needJw || needAny;
    const openOrders = outside.some((j: any) => !RECEIVED.includes(j.status));
    const state: StepState = finished ? 'done' : missing ? (status === 'Planned' ? 'todo' : 'blocked') : openOrders ? 'wait' : 'done';
    steps.push({ key: 'outside', label: outsideLabel(!!wo.buysParts, !!wo.sendsOut), state, sub: lines.join('\n'), stamp: 'All in', flag: missing ? 'Not raised' : undefined });
  }

  if (mats.length) {
    let state = base('material');
    if (state === 'done' && !allIssued && !finished) state = 'wait';
    steps.push({ key: 'material', label: 'Material', state, sub: allIssued ? 'All issued' : `${issuedCount} of ${mats.length} issued`, stamp: 'Issued' });
  }

  steps.push(service
    ? { key: 'make', label: 'Repair checklist', state: base('make'), sub: checklist.length ? `${ticks} of ${checklist.length} steps done` : 'No steps listed', stamp: 'Repaired' }
    : { key: 'make', label: 'Production', state: base('make'), sub: `${opsDone} of ${ops.length} operations · ${n(wo.qtyCompleted)}/${n(wo.qtyPlanned)} made`, stamp: 'Made' });

  if (wo.needsAssembly) {
    steps.push({ key: 'assembly', label: 'Assembly', state: base('assembly'), sub: status === 'In Assembly' ? 'On the bench' : base('assembly') === 'done' ? 'Assembled' : 'After production', stamp: 'Assembled' });
  }

  steps.push({
    key: 'qc', label: 'Final QC', state: base('qc'),
    sub: lots.length ? `${lots.length} lot${lots.length === 1 ? '' : 's'}${openLots.length ? ` · ${openLots.length} to inspect` : ' · decided'}` : n(wo.qtyToQc) > 0 ? `${n(wo.qtyToQc)} sent to QC` : 'Checked before it goes out',
    stamp: 'Passed',
  });
  steps.push({ key: 'close', label: 'Close', state: status === 'Closed' ? 'done' : base('close'), sub: status === 'Closed' ? 'Closed' : status === 'Completed' ? 'Completed · ready to close' : 'Material consumed on close', stamp: 'Closed' });

  for (const s of steps) if (held && s.state === 'blocked') s.flag = causeLabel(wo.holdCause);

  // What to press next
  let next: NextStep = { key: 'none', title: 'This job is closed', why: 'Every step on its route is done' };
  if (held) next = { key: 'resume', title: 'Resume this job', why: `Held for ${causeLabel(wo.holdCause).toLowerCase()}${wo.holdReason ? ' · ' + wo.holdReason : ''}` };
  else if (cur === 'release') next = wo.approvalPending
    ? { key: 'approval', title: 'Waiting for a manager to approve the release', why: 'It goes to the floor as soon as it is approved' }
    : { key: 'release', title: 'Release this job to the floor', why: 'Nothing can be issued or made until it is released' };
  else if (cur === 'material') next = { key: 'issue', title: 'Issue material from the store', why: `${mats.length - issuedCount} of ${mats.length} materials still to issue` };
  else if (cur === 'make') {
    if (status === 'Released') next = { key: 'start', title: service ? 'Start the repair' : 'Start production', why: service ? 'Then work through the checklist' : `First operation: ${ops[0]?.name || 'production'}` };
    else if (service && nextTask) next = { key: 'task', title: `Next step: ${nextTask.task}`, why: `${ticks} of ${checklist.length} steps done · tick it when it is finished`, taskId: nextTask.id };
    else next = { key: 'record', title: service ? 'Record the repair as done' : 'Record production', why: service ? 'Every checklist step is ticked' : curOp ? `${curOp.name} · ${n(curOp.qtyDone)} of ${n(wo.qtyPlanned)} done` : undefined };
  }
  else if (cur === 'assembly') next = status === 'In Assembly'
    ? (waiting > 0 ? { key: 'move', title: `Move ${waiting} finished to QC`, why: 'Assembled pieces wait for final inspection' } : { key: 'complete', title: 'Complete the work order', why: 'Anything not yet sent goes to QC on completion' })
    : { key: 'assemble', title: 'Send to the assembly bench', why: 'Every operation is finished' };
  else if (cur === 'qc') next = openLots.length
    ? { key: 'inspect', title: `Record the result of ${openLots[0].number}`, why: `${n(openLots[0].qty)} pieces waiting for final inspection`, href: `/quality/inspections/${openLots[0].id}` }
    : waiting > 0 ? { key: 'move', title: `Move ${waiting} finished to QC`, why: 'Finished pieces wait for final inspection' }
      : { key: 'complete', title: 'Complete the work order', why: 'Everything made has gone to QC' };
  else if (cur === 'close') next = { key: 'close', title: 'Close the work order', why: 'Consumes the material issued to the floor' };
  if (next.key !== 'none' && !['approval', 'inspect'].includes(next.key) && !actions.includes(next.key === 'move' ? 'move-to-quality' : next.key === 'task' ? 'record' : next.key)) {
    // The status machine does not allow it from here — say what is happening instead of offering a dead button
    if (next.key !== 'task') next = { ...next, key: 'none' };
  }

  const also: NextStep[] = [];
  if (!finished) {
    if (needPo) also.push({ key: 'raise-po', title: 'Raise purchase order', why: 'Bought-in parts' });
    if (needJw) also.push({ key: 'raise-jw', title: 'Raise job work', why: 'Work done outside' });
  }
  return { steps, next, also };
}

/** The same route in miniature, from a work order list row (status, flags and outside-order counts). */
export function miniRouteOf(r: any): { steps: Array<{ key: StepKey; state: StepState }>; label: string; tone: 'now' | 'blocked' | 'wait' | 'done' } {
  const status: string = r.status;
  const service = isService(r.type);
  const outsourced = r.type === 'Partial Outsourcing';
  const finished = ['Completed', 'Closed'].includes(status);
  const missing = outsourced && ((r.buysParts && !n(r.outsidePo)) || (r.sendsOut && !n(r.outsideJw)) || (!r.buysParts && !r.sendsOut && !n(r.outsidePo) && !n(r.outsideJw)));
  const hasOutside = outsourced || n(r.outsidePo) + n(r.outsideJw) > 0;
  const order: StepKey[] = ['release', ...(hasOutside ? ['outside' as StepKey] : []), 'make', ...(r.needsAssembly ? ['assembly' as StepKey] : []), 'qc', 'close'];
  let cur: StepKey | null =
    status === 'Planned' ? 'release'
      : status === 'Released' || status === 'In Progress' || status === 'On Hold' ? 'make'
        : status === 'In Assembly' ? 'assembly'
          : status === 'Completed' ? 'close' : null;
  if ((status === 'In Progress') && n(r.qtyToQc) > 0 && n(r.qtyToQc) >= n(r.qtyPlanned)) cur = 'qc';
  const curIdx = cur ? order.indexOf(cur) : order.length;
  const steps = order.map((k, i) => {
    if (k === 'outside') return { key: k, state: (finished ? 'done' : missing ? (status === 'Planned' ? 'todo' : 'blocked') : n(r.outsideOpen) ? 'wait' : 'done') as StepState };
    return { key: k, state: (i < curIdx ? 'done' : i === curIdx ? (status === 'On Hold' ? 'blocked' : 'now') : 'todo') as StepState };
  });
  const NAMES: Record<StepKey, string> = { release: 'Not released', outside: 'Outside', material: 'Material', make: service ? 'Repair' : 'Production', assembly: 'Assembly', qc: 'Final QC', close: 'Ready to close' };
  if (status === 'Closed') return { steps, label: 'Closed', tone: 'done' };
  if (status === 'On Hold') return { steps, label: `Held · ${causeLabel(r.holdCause).toLowerCase()}`, tone: 'blocked' };
  if (missing && status !== 'Planned') return { steps, label: 'Outside order not raised', tone: 'blocked' };
  if (status === 'Planned') return { steps, label: r.approvalPending ? 'Waiting for approval' : 'Not released', tone: 'now' };
  const outsideWait = hasOutside && n(r.outsideOpen) > 0 && !finished;
  const here = status === 'Released' ? 'Ready to start' : NAMES[cur || 'make'];
  return { steps, label: `${here}${outsideWait ? ' · waiting on vendor' : ''}`, tone: outsideWait ? 'wait' : 'now' };
}
