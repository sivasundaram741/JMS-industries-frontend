'use client';
// Tracking Center · Stage Tracking: all 7 stages, how many records sit in each step now, what is late and the
// slowest step. A row opens that stage's main page.
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { num } from '@/lib/format';
import type { StageData } from '@/components/StageTracker';
import { DataTable, ErrorBox, Loading, Card, PageHeader, StatStrip } from '@/components/ui';
import { STAGE_HREF, TrackingTabs } from '../_components/TrackingTabs';

interface Overview { summary: { active: number; late: number; atRisk: number; onTimePct: number }; stages: StageData[] }

export default function StageTrackingPage() {
  const { user } = useAuth();
  const { data, error, isLoading } = useApi<Overview>('/tracking/stages', { refreshInterval: 60000 });
  const s = data?.summary;
  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Tracking Center', href: '/tracking' }, { label: 'Stage Tracking' }]}
        title="Stage Tracking"
        sub="All 7 stages · what is in each step now, how long it takes and what is late"
      />
      <TrackingTabs active="stages" />
      <ErrorBox error={error} />
      {s ? (
        <StatStrip items={[
          { label: 'Records in flow', value: num(s.active) },
          { label: 'On time', value: `${s.onTimePct}%`, tag: `${num(Math.round((s.active * s.onTimePct) / 100))} records`, tone: 'success' },
          { label: 'At risk', value: num(s.atRisk), color: s.atRisk ? 'warning' : undefined },
          { label: 'Late', value: num(s.late), color: s.late ? 'danger' : undefined },
        ]} />
      ) : !error ? <Card><Loading rows={2} /></Card> : null}
      <DataTable
        loading={isLoading}
        rows={data?.stages}
        rowKey="key"
        rowHref={(r) => STAGE_HREF[r.key]}
        columns={[
          {
            key: 'stage', header: 'Stage', width: 220, render: (r) => (
              <div className="row" style={{ gap: 12 }}>
                <span className={`stage-dot s-${r.tone}`} style={{ width: 28, height: 28, fontSize: 12 }}>{r.n}</span>
                <div><div className="strong">{r.name}</div><div className="text-xs muted">{r.sub}</div></div>
              </div>
            ),
          },
          {
            key: 'steps', header: 'Steps · in each now', render: (r) => (
              <div className="row wrap" style={{ gap: 6 }}>
                {r.steps.map((st) => (
                  <span key={st.label} className={'chip' + (st.late ? ' t-danger' : '')} style={{ gap: 5 }} title={`${st.label} · ${st.count} now · avg ${st.avg}${st.late ? ' · ' + st.late + ' late' : ''}`}>
                    <b className={st.late ? '' : st.count ? `f-${r.tone === 'neutral' ? 'neutral' : r.tone}` : 'muted'}>{st.count}</b>
                    <span className={st.count || st.late ? '' : 'muted'}>{st.label}</span>
                    {st.late ? <span className="strong">· {st.late} late</span> : null}
                  </span>
                ))}
              </div>
            ),
          },
          { key: 'active', header: 'In stage', align: 'right', width: 90, render: (r) => <span className="strong">{num(r.active)}</span> },
          { key: 'late', header: 'Late', align: 'right', width: 70, render: (r) => <span className={r.late ? 'f-danger strong' : 'muted'}>{num(r.late)}</span> },
          { key: 'slowest', header: 'Slowest step', width: 180, render: (r) => (r.slowest ? <span className="f-danger">{r.slowest}</span> : <span className="muted">None late</span>) },
        ]}
      />
    </>
  );
}
