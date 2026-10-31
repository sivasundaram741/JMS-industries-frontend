// The four flows a job takes through this shop, and the three reasons one stalls.
// Kept in one place so the picker, the badges and the help text never disagree.
import type { Tone } from './status';

export type WoType = 'Manufacture' | 'Partial Outsourcing' | 'Service';

/**
 * The four flows:
 *   1 Make it all here       raw material to finished goods, all in our factory
 *   2 Parts from a supplier  some components bought in ready-made          → needs a purchase order
 *   3 Work sent outside      welding, grinding, plating… done by a vendor   → needs a job work order
 *   4 Service or repair      a finished product comes back with a problem   → checklist, no bill of material
 * On the work order, 2 and 3 are both type "Partial Outsourcing", told apart by two flags — and one job can take both.
 */
export type FlowKey = 'make' | 'buy' | 'out' | 'service';
export interface Flow { key: FlowKey; n: number; label: string; short: string; sub: string; help: string; tone: Tone }

export const FLOWS: Flow[] = [
  {
    key: 'make', n: 1, label: 'Make it all here', short: 'In-house', tone: 'danger',
    sub: 'Raw material to finished goods, all in our factory',
    help: 'Nothing is bought ready-made and nothing goes outside. Issue the material, work through the operations, assemble, check, then close.',
  },
  {
    key: 'buy', n: 2, label: 'Parts from a supplier', short: 'Parts bought', tone: 'info',
    sub: 'Some components are bought in ready-made',
    help: 'We make the rest here. Raise a purchase order for the bought-in parts from the work order — it cannot be completed until that order exists.',
  },
  {
    key: 'out', n: 3, label: 'Work sent outside', short: 'Sent outside', tone: 'teal',
    sub: 'Welding, grinding, plating… done by a vendor',
    help: 'A vendor does that step and sends it back. Raise a job work order from the work order — it cannot be completed until that order exists.',
  },
  {
    key: 'service', n: 4, label: 'Service or repair', short: 'Service', tone: 'purple',
    sub: 'A finished product comes back with a problem',
    help: 'Check it, find the fault and work through the checklist, ticking each step as it is done. No bill of material. Every step has to be ticked before closing; it only goes to assembly if you say so.',
  },
];
const flow = (k: FlowKey) => FLOWS.find((f) => f.key === k)!;

/** How a work order records its flows — what the API takes and gives back. */
export interface WoKind { type: WoType; buysParts: boolean; sendsOut: boolean }
export const IN_HOUSE: WoKind = { type: 'Manufacture', buysParts: false, sendsOut: false };

/** The flows a work order follows, in order. An outsourced job from before the two flags shows both (either satisfies it). */
export function flowsOf(wo: { type?: string | null; buysParts?: boolean | null; sendsOut?: boolean | null }): Flow[] {
  if (wo.type === 'Service' || wo.type === 'Internal Service') return [flow('service')];
  if (wo.type === 'Partial Outsourcing') {
    const f = [wo.buysParts ? flow('buy') : null, wo.sendsOut ? flow('out') : null].filter((x): x is Flow => !!x);
    return f.length ? f : [flow('buy'), flow('out')];
  }
  return [flow('make')];
}

/** "Parts from a supplier + Work sent outside" */
export const flowsLabel = (wo: Parameters<typeof flowsOf>[0]) => flowsOf(wo).map((f) => f.label).join(' + ');

/** Is this flow one of the ones picked? */
export const isPicked = (k: WoKind, f: FlowKey) =>
  f === 'make' ? k.type === 'Manufacture'
    : f === 'service' ? k.type === 'Service'
      : k.type === 'Partial Outsourcing' && (f === 'buy' ? k.buysParts : k.sendsOut);

/** Picking a flow: 1 and 4 stand alone; 2 and 3 tick on and off and can both be on. Unticking the last one means it is all made here. */
export function pickFlow(k: WoKind, f: FlowKey): WoKind {
  if (f === 'make') return IN_HOUSE;
  if (f === 'service') return { type: 'Service', buysParts: false, sendsOut: false };
  const was = k.type === 'Partial Outsourcing' ? k : IN_HOUSE;
  const buysParts = f === 'buy' ? !was.buysParts : was.buysParts;
  const sendsOut = f === 'out' ? !was.sendsOut : was.sendsOut;
  return buysParts || sendsOut ? { type: 'Partial Outsourcing', buysParts, sendsOut } : IN_HOUSE;
}

/** The one-paragraph explanation under the picker. */
export function kindHelp(k: WoKind) {
  if (k.type === 'Partial Outsourcing' && k.buysParts && k.sendsOut) {
    return 'Some components are bought from a supplier and some of the work is done outside. Raise a purchase order for the parts and a job work order for the outside work from the work order — it cannot be completed until both exist.';
  }
  return flowsOf(k)[0].help;
}

export type HoldCause = 'Internal' | 'Outsourcing' | 'Material';

export const HOLD_CAUSES: Array<{ value: HoldCause; label: string; sub: string; tone: Tone }> = [
  { value: 'Internal', label: 'Internal delay', sub: 'Machine down, operator short, rework — the hold-up is ours', tone: 'warning' },
  { value: 'Outsourcing', label: 'Waiting on an outside vendor', sub: 'Parts or job work have not come back yet', tone: 'teal' },
  { value: 'Material', label: 'Waiting for material', sub: 'Raw material or a bought-out part has not arrived', tone: 'danger' },
];

export const holdCauseOf = (v: string | null | undefined) => HOLD_CAUSES.find((c) => c.value === v) || null;
