'use client';
// Tracking Center · Order Tracking: one customer order through all 7 stages, with every event, what is planned,
// delays and risks, and a forecast against the promised date.
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Circle, CircleCheck, ExternalLink, Hourglass, Link2, Minus, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { ago, dateShort, dateTime, num } from '@/lib/format';
import { hrefFor } from '@/lib/links';
import type { Tone } from '@/lib/status';
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, ErrorBox, KeyValue, Loading, PageHeader, StatStrip, StatusBadge, useToast } from '@/components/ui';
import { STAGE_HREF, TrackingTabs } from '../_components/TrackingTabs';
import { OrderPicker, type PickerOrder } from '../_components/OrderPicker';

type State = 'done' | 'current' | 'planned' | 'none';
interface Ev { id?: number; event: string; detail: string | null; at: string; user?: string | null; ref?: string | null; tone: string; link?: { type: string; id: number } | null; stage?: string }
interface Stage { key: string; n: number; name: string; tone: Tone; state: State; when: string | null; until: string | null; events: Ev[]; planned: Array<{ event: string; detail: string }> }
interface Tracking {
  order: { id: number; number: string; status: string; customerName: string; customerPo: string | null; orderDate: string; promisedDate: string | null; forecastDate: string | null; itemsText: string; qtyOrdered: number; qtyMade: number; qtyDispatched: number; progressPct: number; documents: number; atRisk: boolean };
  currentStage: { n: number; name: string };
  stages: Stage[];
  risks: Array<{ tone: Tone; title: string; text: string; link: { type: string; id: number } | null }>;
  events: Ev[];
}

const EV_ICON: Record<string, { icon: LucideIcon; cls: string }> = {
  done: { icon: CircleCheck, cls: 'f-success' }, alert: { icon: TriangleAlert, cls: 'f-danger' }, wait: { icon: Hourglass, cls: 'f-warning' },
};
const STATE_BADGE: Record<State, { tone: Tone; label: string }> = {
  done: { tone: 'success', label: 'Done' }, current: { tone: 'warning', label: 'In progress' }, planned: { tone: 'neutral', label: 'Planned' }, none: { tone: 'neutral', label: 'Not needed' },
};
const RISK_ACTION: Record<string, string> = { MACHINE: 'Shop floor', PO: 'Open PO', SO: 'Open order', WO: 'Open WO', IL: 'Inspection', NCR: 'Open NCR', DC: 'Shipment', INV: 'Invoice' };

const CSS = `.trk-ev { display: flex; gap: 10px; align-items: flex-start; padding: 7px 8px; margin: 0 -8px; border-radius: 8px; color: var(--text-primary); }
a.trk-ev:hover { background: var(--bg-subtle); text-decoration: none; }
.trk-stage { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 12px 8px; border-radius: 10px; text-align: center; color: var(--text-primary); min-height: 88px; }
a.trk-stage:hover { text-decoration: none; filter: brightness(0.98); }
.trk-circle { width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center; font-size: 11px; font-weight: 600; flex: none; }`;

const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);

function span(s: Stage) {
  if (!s.when) return null;
  const a = dateTime(s.when), b = s.until ? dateTime(s.until) : null;
  if (!b || b === a) return a;
  return dateShort(s.when) === dateShort(s.until) ? `${a} → ${b.split(' · ')[1]}` : `${a} → ${b}`;
}

// Details from the API carry ISO dates (2026-10-01); show them the way the rest of the app does
const tidy = (t?: string | null) => (t ? t.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) => dateShort(d)) : t);
const byTime = (a: Ev, b: Ev) => a.at.localeCompare(b.at);

function StageCircle({ s, size = 24 }: { s: Stage; size?: number }) {
  const solid = `var(--${s.tone}-solid)`;
  if (s.state === 'done') return <span className="trk-circle" style={{ width: size, height: size, background: solid, color: '#fff' }}><Check size={13} /></span>;
  if (s.state === 'current') return <span className="trk-circle" style={{ width: size, height: size, background: solid, color: '#fff' }}>{s.n}</span>;
  if (s.state === 'none') return <span className="trk-circle" style={{ width: size, height: size, border: '1.5px dashed var(--border-strong)', color: 'var(--text-tertiary)' }}><Minus size={12} /></span>;
  return <span className="trk-circle" style={{ width: size, height: size, border: '1.5px solid var(--border-strong)', color: 'var(--text-tertiary)', background: 'var(--bg-surface)' }}>{s.n}</span>;
}

export default function OrderTrackingPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const sp = useSearchParams();
  const qid = sp.get('id');
  const { data: list, error: listError } = useApi<PickerOrder[]>(qid ? null : '/tracking/orders');
  const soId = qid || (list?.[0] ? String(list[0].id) : null);
  const { data, error } = useApi<Tracking>(soId ? `/tracking/orders/${soId}` : null);
  const o = data?.order;

  async function share() {
    const url = `${window.location.origin}/tracking/orders?id=${soId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.ok('Tracking link copied');
    } catch {
      toast.err('Could not copy the link · ' + url);
    }
  }

  const late = o && o.forecastDate && o.promisedDate && o.forecastDate > o.promisedDate ? daysBetween(o.promisedDate, o.forecastDate) : 0;
  const stageName = (key?: string) => data?.stages.find((s) => s.key === key)?.name || '';

  return (
    <>
      <style>{CSS}</style>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Tracking Center', href: '/tracking' }, { label: 'Order Tracking' }]}
        title="Order Tracking"
        tags={o ? (o.atRisk ? <Badge tone="warning">At risk · {late} day{late === 1 ? '' : 's'}</Badge> : <StatusBadge kind="so" status={o.status} />) : null}
        sub={o ? `${o.number} · ${o.customerName} · ${o.itemsText}` : 'Follow one customer order through all 7 stages'}
        actions={<>
          <OrderPicker current={o} onPick={(id) => router.push(`/tracking/orders?id=${id}`)} />
          {soId ? <Button icon={Link2} onClick={share}>Share tracking link</Button> : null}
          {o && can('sales') ? <ButtonLink href={`/sales/orders/${o.id}`} variant="primary" icon={ExternalLink}>Open order</ButtonLink> : null}
        </>}
      />
      <TrackingTabs active="orders" />
      <ErrorBox error={error || listError} />

      {!soId && list && !list.length ? <Card><EmptyState title="No customer orders yet">Orders show here as soon as they are received</EmptyState></Card> : null}
      {soId && !data && !error ? <Card><Loading rows={6} /></Card> : null}

      {data && o ? (
        <>
          <StatStrip items={[
            { label: 'Ordered', value: dateShort(o.orderDate) },
            { label: 'Promised', value: dateShort(o.promisedDate) },
            { label: 'Current stage', value: `${data.currentStage.n} · ${data.currentStage.name}` },
            { label: 'Progress', value: `${o.progressPct}%`, tag: `${num(o.qtyMade)} / ${num(o.qtyOrdered)} made`, tone: 'info' },
            { label: 'Forecast', value: dateShort(o.forecastDate), color: late > 0 ? 'warning' : undefined },
            { label: 'Documents', value: num(o.documents) },
          ]} />

          <Card title="Stage progress" sub="Tick = done · filled = working now · outline = planned · dash = not needed for this order · click a stage to open it">
            <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
              {data.stages.map((s) => {
                const solid = `var(--${s.tone}-solid)`;
                const style: React.CSSProperties = s.state === 'done' ? { background: `var(--${s.tone}-bg)`, border: `1px solid color-mix(in srgb, ${solid} 40%, transparent)` }
                  : s.state === 'current' ? { background: `var(--${s.tone}-bg)`, border: `1.5px solid ${solid}` }
                  : s.state === 'none' ? { background: 'var(--bg-subtle)', border: '1px dashed var(--border-default)' }
                  : { background: 'var(--bg-surface)', border: '1px solid var(--border-default)' };
                const sub = s.state === 'none' ? 'Not needed'
                  : s.state === 'planned' ? (s.key === 'dispatch' ? 'Planned ' + dateShort(o.promisedDate) : s.key === 'finance' ? 'On delivery' : 'Planned')
                  : s.state === 'current' ? (s.when ? `${dateShort(s.when)} →` : 'In progress')
                  : s.when ? (s.until && dateShort(s.until) !== dateShort(s.when) ? `${dateShort(s.when)} → ${dateShort(s.until)}` : dateShort(s.when)) : 'Done';
                return (
                  <Link key={s.key} href={STAGE_HREF[s.key] || '/'} className="trk-stage" style={style} title={`${s.name} · ${STATE_BADGE[s.state].label}`}>
                    <StageCircle s={s} />
                    <span className={'text-sm strong' + (s.state === 'planned' || s.state === 'none' ? ' secondary' : '')}>{s.name}</span>
                    <span className="text-xs muted">{sub}</span>
                  </Link>
                );
              })}
            </div>
          </Card>

          <div className="grid main-side">
            <Card title="Detailed tracking" sub="Every step with time, owner and reference document">
              <div>
                {data.stages.map((s, i) => {
                  const b = STATE_BADGE[s.state];
                  const dim = s.state === 'planned' || s.state === 'none';
                  return (
                    <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', gap: 16, padding: '14px 0', borderTop: i ? '1px solid var(--border-subtle)' : undefined }}>
                      <div className="stack tight" style={{ gap: 6 }}>
                        <div className="row" style={{ gap: 8 }}><StageCircle s={s} /><span className={'h4' + (dim ? ' secondary' : '')}>{s.name}</span></div>
                        <div><Badge tone={b.tone}>{b.label}</Badge></div>
                        {span(s) ? <div className="text-xs muted">{span(s)}</div> : null}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        {[...s.events].sort(byTime).map((e, j) => {
                          const I = EV_ICON[e.tone] || EV_ICON.done;
                          const href = hrefFor(e.link);
                          const inner = (
                            <>
                              <I.icon size={16} className={I.cls} style={{ flex: 'none', marginTop: 2 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="text-sm strong">{e.event}</div>
                                {e.detail ? <div className="text-xs muted">{tidy(e.detail)}</div> : null}
                              </div>
                              <div style={{ textAlign: 'right', flex: 'none', maxWidth: '42%' }}>
                                <div className="text-xs strong nowrap">{dateTime(e.at)}</div>
                                <div className="text-micro muted truncate">{[e.user, e.ref].filter(Boolean).join(' · ')}</div>
                              </div>
                            </>
                          );
                          return href ? <Link key={e.id ?? j} href={href} className="trk-ev">{inner}</Link> : <div key={e.id ?? j} className="trk-ev">{inner}</div>;
                        })}
                        {s.planned.map((p, j) => (
                          <div key={'p' + j} className="trk-ev">
                            <Circle size={16} className="muted" style={{ flex: 'none', marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="text-sm secondary">{p.event}</div>
                              <div className="text-xs muted">{tidy(p.detail)}</div>
                            </div>
                          </div>
                        ))}
                        {s.state === 'none' ? <div className="text-sm muted" style={{ padding: '7px 0' }}>{s.key === 'purchase' ? 'No purchasing needed for this order' : 'Not needed for this order'}</div> : null}
                        {!s.events.length && !s.planned.length && s.state !== 'none' ? <div className="text-sm muted" style={{ padding: '7px 0' }}>No events yet</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="stack">
              <Card title="Delays & risks">
                <div className="stack tight" style={{ gap: 10 }}>
                  {data.risks.length ? data.risks.map((r, i) => {
                    const href = hrefFor(r.link);
                    return <Alert key={i} tone={r.tone} title={r.title} action={href ? <ButtonLink href={href} size="sm">{RISK_ACTION[r.link?.type || ''] || 'Open'}</ButtonLink> : null}>{tidy(r.text)}</Alert>;
                  }) : <Alert tone="success" title="On track">No delays or risks on this order</Alert>}
                </div>
              </Card>
              <Card title="Live events" sub="Latest first">
                {data.events.length ? (
                  <div className="list">
                    {[...data.events].sort((a, b) => byTime(b, a)).map((e, i) => {
                      const I = EV_ICON[e.tone] || EV_ICON.done;
                      return (
                        <div key={i} style={{ alignItems: 'flex-start' }}>
                          <I.icon size={16} className={I.cls} style={{ flex: 'none', marginTop: 2 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="text-sm strong">{e.event}</div>
                            {e.detail ? <div className="text-xs muted">{tidy(e.detail)}</div> : null}
                          </div>
                          <div className="text-xs muted nowrap" style={{ textAlign: 'right' }}>{ago(e.at)}<div className="text-micro">{stageName(e.stage)}</div></div>
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="empty text-sm">No events yet</div>}
              </Card>
              <Card title="Order">
                <KeyValue items={[
                  ['Order', can('sales') ? <Link key="o" href={`/sales/orders/${o.id}`}>{o.number}</Link> : o.number],
                  ['Status', <StatusBadge key="s" kind="so" status={o.status} />],
                  ['Customer', o.customerName],
                  ['Customer PO', o.customerPo],
                  ['Ordered', `${num(o.qtyOrdered)} pcs`],
                  ['Made', `${num(o.qtyMade)} pcs`],
                  ['Dispatched', `${num(o.qtyDispatched)} pcs`],
                  ['Forecast', <span key="f" className={late > 0 ? 'f-warning' : ''}>{dateShort(o.forecastDate)}{late > 0 ? ` · ${late} d late` : ''}</span>],
                ]} />
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
