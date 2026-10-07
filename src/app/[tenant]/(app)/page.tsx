'use client';
// Plant Dashboard: today's output, money, shortages and quality; where every order is in the 7 stages;
// machines, work orders and what needs attention.
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { Activity, BadgeCheck, CircleCheck, ClipboardCheck, Factory, IndianRupee, Landmark, PackageX, Plus, Route, TriangleAlert, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { dateShort, greeting, inrShort, num } from '@/lib/format';
import { hrefFor } from '@/lib/links';
import { STAGE_SECTIONS } from '@/lib/nav';
import { toneOf } from '@/lib/status';
import { Badge, ButtonLink, Card, DataTable, ErrorBox, Kpi, ListItem, Loading, PageHeader, ProgressBar, StatusBadge, Two } from '@/components/ui';
import { BarChart, Gauge, Legend } from '@/components/charts/BarChart';

const ICONS: Record<string, LucideIcon> = { 'triangle-alert': TriangleAlert, 'clipboard-check': ClipboardCheck, 'circle-check': CircleCheck, 'package-x': PackageX, landmark: Landmark };

export default function DashboardPage() {
  const { user, can } = useAuth();
  const { data, error } = useApi<any>('/dashboard', { refreshInterval: 60000 });
  const now = new Date();
  const isMgr = user?.role.key === 'manager';
  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Dashboard' }]}
        title={isMgr ? 'Plant Dashboard' : `${greeting()}, ${user?.name.split(' ')[0]}`}
        tags={<Badge tone="success">Shift {now.getHours() < 14 && now.getHours() >= 6 ? 'A' : now.getHours() >= 14 && now.getHours() < 22 ? 'B' : 'C'} running</Badge>}
        sub={`${user?.title} · live as of ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
        actions={<>
          {can('shopfloor') ? <ButtonLink href="/production/shop-floor" icon={Activity}>Andon board</ButtonLink> : null}
          {can('wo', 'create') ? <ButtonLink href="/production/work-orders/new" variant="primary" icon={Plus}>New work order</ButtonLink> : null}
        </>}
      />
      <ErrorBox error={error} />
      {!data ? <Card><Loading rows={5} /></Card> : (
        <>
          <div className="kpis">
            <Kpi label="Output today" value={num(data.kpis.outputToday)} icon={Factory} tone="info" delta={data.kpis.outputPlan ? Math.round((data.kpis.outputToday / data.kpis.outputPlan) * 100) + '%' : '—'} trend={data.kpis.outputPlan && data.kpis.outputToday >= data.kpis.outputPlan ? 'up' : 'flat'} note={`of ${num(data.kpis.outputPlan)} plan · ${num(data.kpis.scrapToday)} scrap`} href="/production/work-orders" />
            {isMgr
              ? <Kpi label="Revenue (MTD)" value={inrShort(data.kpis.revenueMtd)} icon={IndianRupee} tone="purple" note={`${inrShort(data.kpis.receivables)} receivable`} href="/finance" />
              : <Kpi label="In production" value={num(data.stages?.find((s: any) => s.key === 'prod')?.active ?? 0)} icon={Factory} tone="purple" note="open work orders" href="/production/work-orders" />
            }
            <Kpi label="Material shortages" value={`${data.kpis.shortages} items`} icon={PackageX} tone="warning" delta={`${data.kpis.criticalShortages} critical`} trend="up" good={false} href="/warehouse/stock?low=1" />
            <Kpi label="First-pass yield" value={`${data.kpis.firstPassYield}%`} icon={BadgeCheck} tone="success" note="last 30 days" href="/quality" />
          </div>

          <Card title="Order-to-cash pipeline" sub="Where every order is right now · click a stage to open it" right={can('track') ? <ButtonLink href="/tracking/orders" size="sm" icon={Route}>Order tracking</ButtonLink> : null}>
            <div className="pipeline" style={{ gridTemplateColumns: `repeat(${data.stages.length}, minmax(0, 1fr))` }}>
              {data.stages.map((s: any) => {
                const sec = STAGE_SECTIONS.find((x) => x.key === s.key);
                return (
                  <Link key={s.key} href={sec?.items[0].href || '/'} style={{ background: `var(--${s.tone}-bg)`, borderColor: `color-mix(in srgb, var(--${s.tone}-solid) 40%, transparent)` }}>
                    <span className="row" style={{ gap: 6 }}><span className={`stage-dot s-${s.tone}`}>{s.n}</span><span className={`text-xs strong f-${s.tone} truncate`}>{s.name}</span></span>
                    <span className="h3 num">{s.active} open</span>
                    <span className="text-xs muted">{s.late ? <span className="f-danger strong">{s.late} late</span> : 'none late'}{s.atRisk ? ` · ${s.atRisk} at risk` : ''}</span>
                  </Link>
                );
              })}
            </div>
          </Card>

          <div className="grid main-side">
            <Card title="Production vs plan" sub="Good pieces finishing their last operation · last 6 days" right={<Legend items={[{ name: 'Actual', color: 'var(--chart-1)' }, { name: 'Plan', color: 'var(--chart-6)' }]} />}>
              <BarChart labels={data.productionByDay.map((d: any) => dateShort(d.date))} series={[{ name: 'Actual', color: 'var(--chart-1)', values: data.productionByDay.map((d: any) => d.actual) }, { name: 'Plan', color: 'var(--chart-6)', values: data.productionByDay.map((d: any) => d.plan) }]} format={(v) => (v >= 1000 ? v / 1000 + 'k' : String(v))} />
            </Card>
            <Card title="Machines now" sub={`${data.machines.running} of ${data.machines.total} running · ${data.machines.down} down`} right={<ButtonLink href="/production/shop-floor" size="sm">Shop floor</ButtonLink>}>
              <div style={{ display: 'grid', placeItems: 'center' }}><Gauge value={data.machines.total ? (data.machines.running / data.machines.total) * 100 : 0} label="machines running" color="var(--success-solid)" /></div>
              <div className="list">
                {data.machines.list.slice(0, 5).map((m: any) => (
                  <ListItem key={m.id} icon={Factory} tone={toneOf('machine', m.status)} title={`${m.code} · ${m.name}`} sub={m.woNumber ? `${m.woNumber} · ${m.itemCode}` : m.statusNote || 'No work order loaded'} right={<StatusBadge kind="machine" status={m.status} />} />
                ))}
              </div>
            </Card>
          </div>

          <div className="grid main-side">
            <DataTable
              toolbar={<div className="toolbar"><div><div className="tt">Work orders</div><div className="ts">Completed vs planned · partial production shown</div></div><div className="spacer" /><ButtonLink href="/production/work-orders" size="sm">All work orders</ButtonLink></div>}
              rows={data.workOrders}
              rowHref={(r) => `/production/work-orders/${r.id}`}
              empty="No open work orders"
              columns={[
                { key: 'number', header: 'Work order', render: (r) => <Two a={r.number} b={r.itemCode} /> },
                { key: 'pct', header: 'Completed', render: (r) => <ProgressBar pct={r.pct} tone={toneOf('wo', r.status)} label={`${num(r.qtyCompleted)} / ${num(r.qtyPlanned)}`} /> },
                { key: 'machine', header: 'Machine', render: (r) => (r.machineCode ? <span className="chip">{r.machineCode}</span> : '—') },
                { key: 'due', header: 'Due', render: (r) => dateShort(r.dueDate) },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="wo" status={r.status} /> },
              ]}
            />
            <Card title="Needs attention">
              <div className="list">
                {data.attention.length ? data.attention.map((a: any, i: number) => (
                  <ListItem key={i} icon={ICONS[a.icon] || User} tone={a.tone} title={a.title} sub={a.sub} href={hrefFor(a.link)} />
                )) : <div className="empty text-sm">All clear</div>}
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
