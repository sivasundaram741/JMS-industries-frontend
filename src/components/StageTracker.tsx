'use client';
// The stage tracker shown on each stage's main page: steps with counts, average time and late items, and every
// record in the stage with its step trail, owner, time in stage, SLA and next action.
import { ChevronRight } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { hrefFor } from '@/lib/links';
import type { Tone } from '@/lib/status';
import { toneOf } from '@/lib/status';
import { Badge, Card, DataTable, Loading, Trail, Two } from './ui';

export interface StageData {
  key: string; n: number; name: string; sub: string; tone: Tone; unit: string;
  steps: Array<{ label: string; count: number; late: number; avg: string }>;
  total: number; active: number; late: number; atRisk: number; slowest: string | null;
  records: Array<{ ref: string; detail: string; step: number; owner: string | null; age: string; sla: string; next: string; stepLabel: string; stepOf: string; link: { type: string; id: number } }>;
}

export function StageTracker({ stage, limit = 8 }: { stage: string; limit?: number }) {
  const { data, error } = useApi<StageData>(`/tracking/stages?stage=${stage}&limit=${limit}`, { refreshInterval: 60000 });
  if (error) return null;
  if (!data) return <Card title="Stage tracking"><Loading rows={3} /></Card>;
  const t = data.tone;
  return (
    <Card
      title={`${data.name} queue`}
      sub={`${data.active} ${data.unit} in this stage · ${data.late} late · ${data.atRisk} at risk · click a record to follow it`}
    >
      <div className="stack" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 4, alignItems: 'stretch' }}>
          {data.steps.map((s, i) => (
            <div key={s.label} style={{ display: 'contents' }}>
              {i ? <span className="row muted" style={{ flex: 'none' }}><ChevronRight size={14} /></span> : null}
              <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-subtle)' }} title={`${s.label} · ${s.count} now · avg ${s.avg}${s.late ? ' · ' + s.late + ' late' : ''}`}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="h3 num" style={{ color: 'var(--text-primary)' }}>{s.count}</span>
                  {s.late ? <span className="badge s-danger" style={{ color: '#fff', height: 18, fontSize: 10 }}>{s.late} late</span> : null}
                </div>
                <div className="text-xs strong truncate">{s.label}</div>
                <div className="text-micro muted truncate">avg {s.avg}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ margin: '0 -18px -18px' }}>
          <DataTable
            rows={data.records}
            rowKey="ref"
            rowHref={(r) => hrefFor(r.link)}
            empty="Nothing in this stage right now"
            columns={[
              { key: 'ref', header: 'Record', render: (r) => <Two a={r.ref} b={r.detail} /> },
              { key: 'trail', header: 'Step trail', render: (r) => <Trail n={data.steps.length} current={r.step} tone={t} done={r.sla === 'Done' && r.step === data.steps.length - 1} /> },
              { key: 'step', header: 'Current step', render: (r) => <Two a={r.stepLabel} b={r.stepOf} /> },
              { key: 'owner', header: 'Owner', render: (r) => <span className="secondary">{r.owner || '—'}</span> },
              { key: 'age', header: 'In stage', align: 'right', render: (r) => r.age },
              { key: 'sla', header: 'SLA', render: (r) => <Badge tone={toneOf('sla', r.sla)}>{r.sla}</Badge> },
              { key: 'next', header: 'Next action', render: (r) => <span className="secondary">{r.next}</span> },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}
