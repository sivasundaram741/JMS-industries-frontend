'use client';
// The route card on a work order: its own steps through the shop, stamped as they are done, with the current
// step marked in safety yellow and one bar underneath saying what to press next. MiniRoute is the same route in
// one line for lists and the Today board.
import type { LucideIcon } from 'lucide-react';
import { Check, ClipboardCheck, Factory, Forklift, Hammer, Lock, Send, ShieldCheck, TriangleAlert, Truck, Wrench } from 'lucide-react';
import type { RouteStep, StepKey } from '@/lib/route';
import { miniRouteOf } from '@/lib/route';
import { flowsOf } from '@/lib/workorder';
import { Badge } from './ui';

const ICON: Record<StepKey, LucideIcon> = { release: Send, outside: Truck, material: Forklift, make: Factory, assembly: Hammer, qc: ShieldCheck, close: Lock };

export function RouteCard({ wo, steps, children }: { wo: any; steps: RouteStep[]; children?: React.ReactNode }) {
  const flows = flowsOf(wo);
  const service = flows[0]?.key === 'service';
  return (
    <section className="route-card" aria-label={`Route card for ${wo.number}`}>
      <div className="rc-head">
        <span className="rc-title">Route card</span>
        <div className="rc-flows">
          {flows.map((f) => <Badge key={f.key} tone={f.tone} dot={false}>{f.n} · {f.label}</Badge>)}
        </div>
      </div>
      <ol className="rc-track" style={{ listStyle: 'none', margin: 0 }}>
        {steps.map((s) => {
          const I = s.key === 'make' && service ? Wrench : ICON[s.key];
          return (
            <li key={s.key} className={`rc-step ${s.state}`} aria-current={s.state === 'now' ? 'step' : undefined}>
              <span className="rc-node" aria-hidden>
                {s.state === 'done' ? <Check size={15} strokeWidth={3} /> : s.state === 'blocked' ? <TriangleAlert size={14} /> : <I size={14} />}
              </span>
              <span className="rc-label">{s.label}</span>
              {s.state === 'done' ? <span className="rc-stamp">{s.stamp || 'Done'}</span>
                : s.state === 'now' ? <span className="rc-now">Now</span>
                  : s.state === 'blocked' ? <span className="rc-blocked">{s.flag || 'Blocked'}</span>
                    : s.state === 'wait' ? <span className="rc-wait">Waiting</span> : null}
              {s.sub ? <span className="rc-sub" style={{ whiteSpace: 'pre-line' }}>{s.sub}</span> : null}
            </li>
          );
        })}
      </ol>
      {children}
    </section>
  );
}

/** The "what next" bar under the route card. */
export function RouteNext({ title, why, children }: { title: React.ReactNode; why?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rc-next">
      <ClipboardCheck size={20} style={{ flex: 'none', color: 'var(--signal-edge)' }} aria-hidden />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="what">{title}</div>
        {why ? <div className="why">{why}</div> : null}
      </div>
      {children ? <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{children}</div> : null}
    </div>
  );
}

/** One-line route for a work order list row (uses status, flags and the outside-order counts). */
export function MiniRoute({ wo, label = true }: { wo: any; label?: boolean }) {
  const m = miniRouteOf(wo);
  return (
    <div title={m.label}>
      <div className="mini-route" aria-hidden>
        {m.steps.map((s, i) => (
          <span key={s.key} style={{ display: 'contents' }}>
            {i ? <b className={s.state === 'done' || s.state === 'now' || s.state === 'blocked' ? (m.steps[i - 1].state === 'done' ? 'done' : '') : ''} /> : null}
            <i className={s.state === 'wait' ? 'wait' : s.state} />
          </span>
        ))}
      </div>
      {label ? <div className={'mini-route-label' + (m.tone === 'blocked' ? ' f-danger' : m.tone === 'wait' ? ' f-warning' : '')}>{m.label}</div> : <span className="sr-only">{m.label}</span>}
    </div>
  );
}
