'use client';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { addDaysIso, dateShort, num } from '@/lib/format';
import { Badge, Button, Card, Chip, DataTable, StatStrip, Two } from '@/components/ui';
import { WorkOrderNote } from './shared';

/** One day of a work order, whether or not anything was produced on it. */
export interface Day {
  key: string;
  iso: string;
  weekday: string;
  isToday: boolean;
  outsidePlan: boolean;
  entries: any[];
  /** Output across every operation that ran - a piece counts once per op. */
  qtyGood: number;
  /** Output of the last operation in the routing: actual finished pieces. */
  qtyFinal: number;
  qtyScrap: number;
  downtimeMin: number;
  runHours: number;
  operators: string[];
  operations: string[];
  cumulative: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const n = (v: any) => Number(v) || 0;
const isoOf = (v: any) => String(v ?? '').slice(0, 10);

/**
 * Builds one entry per calendar day between the work order's start and due
 * dates. The span is widened to cover any entry logged outside that window, so
 * production recorded early or late is never hidden; those days are flagged.
 */
export function buildDays(wo: any, today = new Date().toISOString().slice(0, 10)): { days: Day[]; truncated: number } {
  const entries: any[] = wo?.entries || [];
  const entryDates = entries.map((e) => isoOf(e.entryDate)).filter(Boolean).sort();

  const candidatesFrom = [isoOf(wo?.startDate), entryDates[0]].filter(Boolean) as string[];
  const candidatesTo = [isoOf(wo?.dueDate), entryDates[entryDates.length - 1]].filter(Boolean) as string[];
  if (!candidatesFrom.length || !candidatesTo.length) return { days: [], truncated: 0 };

  const planFrom = isoOf(wo?.startDate);
  const planTo = isoOf(wo?.dueDate);
  let from = candidatesFrom.reduce((a, b) => (a < b ? a : b));
  let to = candidatesTo.reduce((a, b) => (a > b ? a : b));
  if (to < from) [from, to] = [to, from];

  // Finished pieces are the output of the last operation in the routing;
  // summing every operation would count one piece once per operation.
  const lastSeq = (wo?.operations || []).reduce((a: number, o: any) => Math.max(a, n(o.seq)), 0);

  const byDay = new Map<string, any[]>();
  for (const e of entries) {
    const d = isoOf(e.entryDate);
    if (!d) continue;
    const list = byDay.get(d);
    if (list) list.push(e); else byDay.set(d, [e]);
  }

  // A runaway date would otherwise render thousands of cells.
  const MAX_DAYS = 400;
  const days: Day[] = [];
  let cumulative = 0;
  let truncated = 0;
  for (let iso = from; iso <= to; iso = addDaysIso(iso, 1)) {
    if (days.length >= MAX_DAYS) { truncated++; continue; }
    const rows = byDay.get(iso) || [];
    const qtyGood = rows.reduce((a, e) => a + n(e.qtyGood), 0);
    const qtyFinal = lastSeq
      ? rows.filter((e) => n(e.seq) === lastSeq).reduce((a, e) => a + n(e.qtyGood), 0)
      : qtyGood;
    cumulative += qtyFinal;
    days.push({
      key: iso,
      iso,
      weekday: WEEKDAYS[new Date(iso + 'T00:00:00').getDay()],
      isToday: iso === today,
      outsidePlan: (!!planFrom && iso < planFrom) || (!!planTo && iso > planTo),
      entries: rows,
      qtyGood,
      qtyFinal,
      qtyScrap: rows.reduce((a, e) => a + n(e.qtyScrap), 0),
      downtimeMin: rows.reduce((a, e) => a + n(e.downtimeMin), 0),
      runHours: rows.reduce((a, e) => a + n(e.runHours), 0),
      operators: [...new Set(rows.map((e) => e.operator).filter(Boolean))] as string[],
      operations: [...new Set(rows.map((e) => (e.seq != null ? `Op ${e.seq}` : null)).filter(Boolean))] as string[],
      cumulative,
    });
  }
  return { days, truncated };
}

/**
 * The production log for one work order: every entry that was posted against
 * it, oldest first, plus the run hours each operation took day by day.
 * Shared by the work order's own log screen and the Production Log menu.
 */
export function ProductionLogView({
  wo, canRecord = false, onAdd, showStats = true,
}: {
  wo: any;
  canRecord?: boolean;
  /** Receives the day the user had selected, so the entry opens on it. */
  onAdd?: (isoDate?: string) => void;
  showStats?: boolean;
}) {
  const { days, truncated } = useMemo(() => buildDays(wo), [wo]);

  const planned = n(wo?.qtyPlanned);
  const worked = days.filter((d) => d.entries.length > 0);
  const totalGood = days.reduce((a, d) => a + d.qtyGood, 0);
  const totalFinal = days.reduce((a, d) => a + d.qtyFinal, 0);
  const totalScrap = days.reduce((a, d) => a + d.qtyScrap, 0);
  const totalDown = days.reduce((a, d) => a + d.downtimeMin, 0);
  const ops: any[] = wo?.operations || [];

  /* One row per posting, oldest first, each carrying the day it belongs to. */
  const entries = days.flatMap((d) => d.entries.map((e: any) => ({
    ...e, _iso: d.iso, _weekday: d.weekday, _isToday: d.isToday, _outsidePlan: d.outsidePlan,
  })));

  if (!entries.length) {
    return (
      <Card title="Production log">
        <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
          Nothing has been logged against this work order yet.
          {canRecord && onAdd ? <div style={{ marginTop: 12 }}><Button size="sm" variant="primary" icon={Plus} onClick={() => onAdd()}>Record Production</Button></div> : null}
        </div>
      </Card>
    );
  }

  return (
    <>
      <WorkOrderNote notes={wo?.notes} />

      {showStats ? (
        <StatStrip items={[
          { label: 'Entries logged', value: String(entries.length), tag: `on ${worked.length} day${worked.length === 1 ? '' : 's'}`, tone: 'info' },
          { label: 'Finished', value: `${num(totalFinal)} ${wo.uom}`, tag: planned ? `${Math.round((totalFinal / planned) * 100)}% of plan` : undefined, tone: 'success' },
          { label: 'Operation output', value: `${num(totalGood)} ${wo.uom}`, tag: 'across all operations', tone: 'info' },
          { label: 'Scrap', value: `${num(totalScrap)} ${wo.uom}`, tone: totalScrap ? 'danger' : 'success' },
          { label: 'Downtime', value: `${num(totalDown)} min`, tone: totalDown ? 'warning' : 'success' },
        ]} />
      ) : null}

      <DataTable
        toolbar={
          <div className="toolbar">
            <div>
              <div className="tt">Production log</div>
              <div className="ts">Every entry posted against this work order, oldest first</div>
            </div>
            <div className="spacer" />
            <Chip>{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</Chip>
            {canRecord && onAdd ? <Button size="sm" variant="primary" icon={Plus} onClick={() => onAdd()}>Record Production</Button> : null}
          </div>
        }
        rows={entries}
        rowKey="id"
        empty="Nothing logged yet"
        columns={[
          {
            key: 'date',
            header: 'Date',
            render: (e: any) => (
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <span className="strong nowrap">{dateShort(e._iso)}</span>
                  {e._isToday ? <Badge tone="info">Today</Badge> : null}
                  {e._outsidePlan ? <Badge tone="warning">Outside plan</Badge> : null}
                </div>
                <div className="text-xs muted">{e._weekday}{e.shift ? ` · Shift ${e.shift}` : ''}</div>
              </div>
            ),
          },
          { key: 'op', header: 'Operation · Machine', render: (e: any) => <Two a={`Op ${e.seq} · ${e.operationName}`} b={e.machineCode || 'no machine'} /> },
          { key: 'operator', header: 'Operator', render: (e: any) => <span className="secondary">{e.operator || '—'}</span> },
          { key: 'good', header: 'Good', align: 'right', render: (e: any) => <span className="strong num f-success">{num(e.qtyGood)} {wo.uom}</span> },
          { key: 'scrap', header: 'Scrap', align: 'right', render: (e: any) => <span className={e.qtyScrap ? 'num f-danger' : 'muted'}>{num(e.qtyScrap)}</span> },
          { key: 'down', header: 'Downtime', align: 'right', render: (e: any) => <span className={e.downtimeMin ? 'nowrap f-warning' : 'muted'}>{num(e.downtimeMin)} min</span> },
          { key: 'run', header: 'Run h', align: 'right', render: (e: any) => <span className="num secondary">{num(e.runHours, 1)}</span> },
          { key: 'why', header: 'What was done', render: (e: any) => <span className="secondary">{e.notes || <span className="muted">—</span>}</span> },
          { key: 'by', header: 'Logged by', render: (e: any) => <span className="secondary text-xs">{e.loggedBy || '—'}</span> },
        ]}
        footer={
          <div className="tfoot">
            <span>
              {num(entries.length)} entr{entries.length === 1 ? 'y' : 'ies'} on {num(worked.length)} day{worked.length === 1 ? '' : 's'}
              {truncated ? ` · ${num(truncated)} further day(s) not shown` : ''}
            </span>
            <span className="strong" style={{ color: 'var(--text-primary)' }}>
              {num(totalGood)} good · {num(totalScrap)} scrap · {num(totalDown)} min down
            </span>
          </div>
        }
      />

      {ops.length ? (
        <Card title="Hours by day and operation" sub="Run hours against each operation, for the days something was logged">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  {ops.map((o: any) => <th key={o.id} className="r" title={o.name}>Op {o.seq}</th>)}
                  <th className="r">Total h</th>
                  <th className="r">Good</th>
                </tr>
              </thead>
              <tbody>
                {worked.map((d) => {
                  const perOp = ops.map((o: any) => d.entries
                    .filter((e: any) => e.operationId === o.id || e.seq === o.seq)
                    .reduce((a: number, e: any) => a + n(e.runHours), 0));
                  const rowTotal = perOp.reduce((a, v) => a + v, 0);
                  return (
                    <tr key={d.key}>
                      <td>
                        <span className="strong nowrap">{dateShort(d.iso)}</span>
                        <span className="text-xs muted"> {d.weekday}</span>
                        {d.isToday ? <Badge tone="info">Today</Badge> : null}
                      </td>
                      {perOp.map((h, i) => (
                        <td key={ops[i].id} className="r">
                          {h ? <span className="num strong">{num(h, 1)}</span> : <span className="muted">—</span>}
                        </td>
                      ))}
                      <td className="r">{rowTotal ? <span className="num strong">{num(rowTotal, 1)}</span> : <span className="muted">—</span>}</td>
                      <td className="r">{d.qtyGood ? <span className="num f-success">{num(d.qtyGood)}</span> : <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="strong">Total</td>
                  {ops.map((o: any) => {
                    const t = worked.reduce((a, d) => a + d.entries
                      .filter((e: any) => e.operationId === o.id || e.seq === o.seq)
                      .reduce((b: number, e: any) => b + n(e.runHours), 0), 0);
                    return <td key={o.id} className="r strong num">{t ? num(t, 1) : '—'}</td>;
                  })}
                  <td className="r strong num">{num(worked.reduce((a, d) => a + d.runHours, 0), 1)}</td>
                  <td className="r strong num f-success">{num(totalGood)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="text-xs muted" style={{ padding: '0 14px 12px' }}>
            {ops.map((o: any) => `Op ${o.seq} · ${o.name}`).join('  ·  ')}
          </div>
        </Card>
      ) : null}
    </>
  );
}
