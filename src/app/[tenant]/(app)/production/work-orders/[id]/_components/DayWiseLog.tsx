'use client';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { dateShort, num } from '@/lib/format';
import { Badge, Button, Chip, DataTable, StatStrip } from '@/components/ui';

export type { Day } from '../../../_components/ProductionLogView';
export { buildDays } from '../../../_components/ProductionLogView';
import { buildDays, type Day } from '../../../_components/ProductionLogView';

const n = (v: any) => Number(v) || 0;

export function DayWiseLog({ wo, canRecord, onAdd }: { wo: any; canRecord: boolean; onAdd: () => void }) {
  const { days, truncated } = useMemo(() => buildDays(wo), [wo]);

  const planned = n(wo.qtyPlanned);
  const worked = days.filter((d) => d.entries.length > 0);
  const totalGood = days.reduce((a, d) => a + d.qtyGood, 0);
  const totalFinal = days.reduce((a, d) => a + d.qtyFinal, 0);
  const totalScrap = days.reduce((a, d) => a + d.qtyScrap, 0);
  const totalDown = days.reduce((a, d) => a + d.downtimeMin, 0);
  const totalRun = days.reduce((a, d) => a + d.runHours, 0);
  const best = worked.reduce<Day | null>((a, d) => (!a || d.qtyGood > a.qtyGood ? d : a), null);
  const avg = worked.length ? totalGood / worked.length : 0;

  if (!days.length) {
    return (
      <DataTable
        toolbar={
          <div className="toolbar">
            <div><div className="tt">Day-wise Production</div><div className="ts">One row per day between the start and due dates</div></div>
            <div className="spacer" />
            {canRecord ? <Button size="sm" variant="primary" icon={Plus} onClick={onAdd}>Add Entry</Button> : null}
          </div>
        }
        rows={[]}
        columns={[{ key: 'x', header: 'Date', render: () => null }]}
        empty="This work order has no start or due date yet, and nothing has been logged — set the dates to lay out the day-by-day plan."
      />
    );
  }

  return (
    <>
      <StatStrip items={[
        { label: 'Days in span', value: String(days.length), tag: `${worked.length} with output`, tone: 'info' },
        { label: 'Finished', value: `${num(totalFinal)} ${wo.uom}`, tag: planned ? `${Math.round((totalFinal / planned) * 100)}% of plan` : undefined, tone: 'success' },
        { label: 'Scrap', value: `${num(totalScrap)} ${wo.uom}`, tone: totalScrap ? 'danger' : 'success' },
        { label: 'Avg per working day', value: worked.length ? `${num(avg, 1)} ${wo.uom}` : '—', tag: best ? `best ${num(best.qtyGood)} on ${dateShort(best.iso)}` : undefined, tone: 'purple' },
      ]} />

      <DataTable
        toolbar={
          <div className="toolbar">
            <div>
              <div className="tt">Day-wise Production</div>
              <div className="ts">
                Every day from {dateShort(days[0].iso)} to {dateShort(days[days.length - 1].iso)} · days with no output are shown too
              </div>
            </div>
            <div className="spacer" />
            {canRecord ? <Button size="sm" variant="primary" icon={Plus} onClick={onAdd}>Add Entry</Button> : null}
          </div>
        }
        rows={days}
        rowKey="key"
        columns={[
          {
            key: 'date',
            header: 'Date',
            render: (d: Day) => (
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <span className={d.entries.length ? 'strong nowrap' : 'nowrap secondary'}>{dateShort(d.iso)}</span>
                  {d.isToday ? <Badge tone="info">Today</Badge> : null}
                  {d.outsidePlan ? <Badge tone="warning">Outside plan</Badge> : null}
                </div>
                <div className="text-xs muted">{d.weekday}{d.entries.length ? ` · ${d.entries.length} entr${d.entries.length === 1 ? 'y' : 'ies'}` : ''}</div>
              </div>
            ),
          },
          {
            key: 'ops',
            header: 'Operations · Operators',
            render: (d: Day) => (d.entries.length ? (
              <div>
                <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>{d.operations.map((o) => <Chip key={o}>{o}</Chip>)}</div>
                <div className="text-xs muted truncate">{d.operators.length ? d.operators.join(', ') : 'operator not recorded'}</div>
              </div>
            ) : <span className="muted">No production</span>),
          },
          {
            key: 'good',
            header: 'Good',
            align: 'right',
            render: (d: Day) => (d.qtyGood ? <span className="strong num f-success">{num(d.qtyGood)}</span> : <span className="muted">—</span>),
          },
          {
            key: 'scrap',
            header: 'Scrap',
            align: 'right',
            render: (d: Day) => (d.qtyScrap ? <span className="num f-danger">{num(d.qtyScrap)}</span> : <span className="muted">—</span>),
          },
          {
            key: 'down',
            header: 'Downtime',
            align: 'right',
            render: (d: Day) => (d.downtimeMin ? <span className="nowrap f-warning">{num(d.downtimeMin)} min</span> : <span className="muted">—</span>),
          },
          {
            key: 'run',
            header: 'Run h',
            align: 'right',
            render: (d: Day) => (d.runHours ? <span className="num secondary">{num(d.runHours, 1)}</span> : <span className="muted">—</span>),
          },
          {
            key: 'cum',
            header: 'Cumulative',
            align: 'right',
            render: (d: Day) => (
              <div>
                <div className="num strong nowrap">{num(d.cumulative)} {wo.uom}</div>
                {planned ? <div className="text-xs muted">{Math.round((d.cumulative / planned) * 100)}% of {num(planned)}</div> : null}
              </div>
            ),
          },
        ]}
        footer={
          <div className="tfoot">
            <span>
              {num(days.length)} day{days.length === 1 ? '' : 's'} · {num(worked.length)} with output
              {truncated ? ` · ${num(truncated)} further day(s) not shown` : ''}
            </span>
            <span className="strong" style={{ color: 'var(--text-primary)' }}>
              {num(totalGood)} good · {num(totalScrap)} scrap · {num(totalRun, 1)} h run · {num(totalDown)} min down
            </span>
          </div>
        }
      />
    </>
  );
}
