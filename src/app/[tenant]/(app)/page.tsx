'use client';
// Today: the day in one sentence, every open job on a board by where it is on its route, and the few things that
// need a decision. Owners read the sentence and the decisions; supervisors work the board; anyone can open a job.
import { CircleCheck, Factory, Plus, TriangleAlert } from 'lucide-react';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { dateShort, num } from '@/lib/format';
import { hrefFor } from '@/lib/links';
import { flowsOf, holdCauseOf } from '@/lib/workorder';
import { ButtonLink, Card, ErrorBox, Loading, PageHeader } from '@/components/ui';
import { BarChart, Legend } from '@/components/charts/BarChart';
import { MiniRoute } from '@/components/RouteCard';

function currentShift() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 'Shift A, 6 am to 2 pm';
  if (h >= 14 && h < 22) return 'Shift B, 2 pm to 10 pm';
  return 'Shift C, 10 pm to 6 am';
}

// Board columns follow the route: each open job sits in exactly one
const COLUMNS: Array<{ key: string; label: string; match: (w: any) => boolean }> = [
  { key: 'planned', label: 'To release', match: (w) => w.status === 'Planned' },
  { key: 'released', label: 'Ready to start', match: (w) => w.status === 'Released' },
  { key: 'floor', label: 'On the floor', match: (w) => w.status === 'In Progress' },
  { key: 'held', label: 'Held', match: (w) => w.status === 'On Hold' },
  { key: 'assembly', label: 'Assembly', match: (w) => w.status === 'In Assembly' },
  { key: 'close', label: 'Ready to close', match: (w) => w.status === 'Completed' },
];

const outsideWaiting = (w: any) => w.type === 'Partial Outsourcing' && Number(w.outsideOpen) > 0;
const outsideMissing = (w: any) => w.type === 'Partial Outsourcing' && ((w.buysParts && !Number(w.outsidePo)) || (w.sendsOut && !Number(w.outsideJw)));

export default function TodayPage() {
  const { user, can } = useAuth();
  const { data, error } = useApi<any>('/dashboard', { refreshInterval: 60_000 });
  const { data: jobs } = useApi<any>(can('wo') ? '/work-orders?open=1&pageSize=100' : null, { refreshInterval: 60_000 });
  const { data: analytics } = useApi<any>(can('wo') ? '/analytics/production?days=7' : null);
  const open: any[] = (jobs?.rows || []).filter((w: any) => w.status !== 'Closed');
  const late = open.filter((w) => w.late);
  const held = open.filter((w) => w.status === 'On Hold');
  const vendor = open.filter((w) => outsideWaiting(w) || outsideMissing(w));
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <PageHeader
        title="Today"
        sub={`${today} · ${currentShift()}`}
        actions={<>
          {can('shopfloor') ? <ButtonLink href="/production/shop-floor" icon={Factory}>Shop floor</ButtonLink> : null}
          {can('wo', 'create') ? <ButtonLink href="/production/work-orders/new" variant="primary" icon={Plus}>New work order</ButtonLink> : null}
        </>}
      />
      <ErrorBox error={error} />

      {!data || (can('wo') && !jobs) ? <Card><Loading rows={5} /></Card> : (
        <>
          {/* The day in one sentence — numbers link to the jobs behind them */}
          <p className="today-line" style={{ margin: 0 }}>
            <Link href="/production/work-orders"><b>{num(open.length)}</b> jobs open</Link>.{' '}
            {late.length ? <><b className="f-danger">{num(late.length)}</b> late, </> : 'None late, '}
            <b>{num(held.length)}</b> on hold, and <b>{num(vendor.length)}</b> waiting on a supplier or job worker.{' '}
            <b>{num(data.kpis.outputToday)}</b> pieces made today against <b>{num(data.kpis.outputPlan)}</b> planned{data.kpis.scrapToday ? <>, with <b>{num(data.kpis.scrapToday)}</b> scrapped</> : null}.
          </p>

          {/* Job board: every open job by where it is on its route */}
          {can('wo') ? (
            <section aria-label="Job board" className="stack" style={{ gap: 10 }}>
              <div className="row between">
                <h2 className="h3">Job board</h2>
                <Link href="/production/work-orders" className="text-sm">All work orders</Link>
              </div>
              <div className="board">
                {COLUMNS.map((c) => {
                  const rows = open.filter(c.match);
                  return (
                    <div key={c.key} className={'board-col' + (c.key === 'held' && rows.length ? ' hot' : '')}>
                      <div className="board-col-head"><span className="n">{rows.length}</span><span className="l">{c.label}</span></div>
                      {rows.length ? rows.slice(0, 8).map((w) => {
                        const cause = holdCauseOf(w.holdCause);
                        return (
                          <Link key={w.id} href={`/production/work-orders/${w.id}`} className={'ticket' + (w.late ? ' late' : w.status === 'On Hold' ? ' held' : '')}>
                            <div className="row between" style={{ alignItems: 'baseline' }}>
                              <span className="no">{w.number}</span>
                              <span className={'text-xs' + (w.late ? ' f-danger strong' : ' muted')}>{w.late ? 'late · ' : ''}{dateShort(w.dueDate)}</span>
                            </div>
                            <div className="item truncate">{w.itemName}</div>
                            <div style={{ marginTop: 8 }}><MiniRoute wo={w} label={false} /></div>
                            <div className="meta">
                              {flowsOf(w).map((f) => <span key={f.key} className={`chip t-${f.tone}`}>{f.n}</span>)}
                              <span>{num(w.qtyCompleted)} / {num(w.qtyPlanned)}</span>
                              {w.status === 'On Hold' && cause ? <span className={`chip t-${cause.tone}`}>{cause.label}</span> : null}
                              {outsideMissing(w) ? <span className="chip t-danger">Order not raised</span> : outsideWaiting(w) ? <span className="chip t-warning">Waiting on vendor</span> : null}
                            </div>
                          </Link>
                        );
                      }) : <div className="board-empty">Nothing here</div>}
                      {rows.length > 8 ? <Link href={`/production/work-orders`} className="text-sm">{rows.length - 8} more</Link> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="grid main-side" style={{ alignItems: 'start' }}>
            {analytics ? (
              <Card title="Pieces made, last 7 days" sub="Good pieces and scrap per day"
                right={<Legend items={[{ name: 'Good', color: 'var(--chart-1)' }, { name: 'Scrap', color: 'var(--chart-3)' }]} />}>
                <BarChart
                  labels={analytics.daily.map((d: any) => dateShort(d.date))}
                  series={[
                    { name: 'Good', color: 'var(--chart-1)', values: analytics.daily.map((d: any) => d.good) },
                    { name: 'Scrap', color: 'var(--chart-3)', values: analytics.daily.map((d: any) => d.scrap) },
                  ]}
                  height={220}
                />
              </Card>
            ) : <div />}

            <div className="stack">
              <Card title="Needs a decision" pad={false}>
                <div className="list" style={{ padding: '4px 18px 8px' }}>
                  {late.slice(0, 3).map((w) => (
                    <Link key={'late' + w.id} href={`/production/work-orders/${w.id}`} className="li">
                      <TriangleAlert size={18} className="f-danger" style={{ flex: 'none' }} />
                      <div style={{ minWidth: 0, flex: 1 }}><div className="lt truncate">{w.number} is late</div><div className="ls truncate">{w.itemName} · was due {dateShort(w.dueDate)}</div></div>
                    </Link>
                  ))}
                  {data.attention.slice(0, 5).map((a: any, i: number) => {
                    const href = hrefFor(a.link);
                    const body = (
                      <>
                        <TriangleAlert size={18} className={a.tone === 'danger' ? 'f-danger' : a.tone === 'warning' ? 'f-warning' : 'f-info'} style={{ flex: 'none' }} />
                        <div style={{ minWidth: 0, flex: 1 }}><div className="lt truncate">{a.title}</div><div className="ls truncate">{a.sub}</div></div>
                      </>
                    );
                    return href ? <Link key={i} href={href} className="li">{body}</Link> : <div key={i} className="li">{body}</div>;
                  })}
                  {!late.length && !data.attention.length ? (
                    <div className="li"><CircleCheck size={18} className="f-success" /><div className="lt">Nothing needs a decision right now</div></div>
                  ) : null}
                </div>
              </Card>

              <Card title="Machines" sub={`${data.machines.running} of ${data.machines.total} running${data.machines.down ? ` · ${data.machines.down} down` : ''}`}
                right={can('shopfloor') ? <Link href="/production/shop-floor" className="text-sm">Shop floor</Link> : null} pad={false}>
                <div className="list" style={{ padding: '4px 18px 8px' }}>
                  {data.machines.list.slice(0, 6).map((m: any) => {
                    const tone = m.status === 'Running' ? 'success' : m.status === 'Down' ? 'danger' : m.status === 'Setup' ? 'warning' : 'neutral';
                    return (
                      <div key={m.id} className="li">
                        <span className={`s-${tone}`} style={{ width: 10, height: 10, borderRadius: 999, flex: 'none' }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="lt code">{m.code}</div>
                          <div className="ls truncate">{m.woNumber ? `${m.woNumber} · ${m.itemCode}` : m.name || 'No job loaded'}</div>
                        </div>
                        <span className={`text-sm strong f-${tone}`}>{m.status}</span>
                      </div>
                    );
                  })}
                  {!data.machines.list.length ? <div className="li text-sm muted">No machines set up yet · add them under Masters</div> : null}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
