'use client';
// Insights · Reports & Analytics: the Industrial report pack and the core registers, for any date range, as a chart or
// a table, with totals and CSV export (opens in Excel).
import { useEffect, useState } from 'react';
import { ChartColumn, Download, FileSpreadsheet, Table2 } from 'lucide-react';
import { saveBlob, toCsv } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { addDaysIso, date, dateShort, inr, inrShort, num, todayIso } from '@/lib/format';
import { Alert, Button, Card, ErrorBox, Loading, PageHeader, Segmented } from '@/components/ui';
import { BarChart, Legend } from '@/components/charts/BarChart';

interface Entry { key: string; title: string; group: string; description: string }
interface Col { key: string; label: string; type?: 'number' | 'money' | 'pct' | 'date' | 'text' }
interface Report extends Entry { from: string; to: string; columns: Col[]; rows: Array<Record<string, any>>; chart?: { x: string; series: Array<{ key: string; label: string }> }; totals?: Record<string, number>; note?: string }

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const PRESETS = [
  { key: '30', label: 'Last 30 days', from: () => addDaysIso(todayIso(), -30) },
  { key: 'mtd', label: 'This month', from: () => todayIso().slice(0, 8) + '01' },
  { key: 'fy', label: 'This financial year', from: () => { const t = todayIso(); const y = Number(t.slice(5, 7)) >= 4 ? Number(t.slice(0, 4)) : Number(t.slice(0, 4)) - 1; return `${y}-04-01`; } },
  { key: '180', label: 'Last 6 months', from: () => addDaysIso(todayIso(), -180) },
];
const fmt = (c: Col, v: any) => {
  if (v === null || v === undefined || v === '') return '—';
  if (c.type === 'money') return inr(v);
  if (c.type === 'number') return num(v, 2);
  if (c.type === 'pct') return `${num(v, 1)}%`;
  if (c.type === 'date') return date(v);
  return String(v);
};
const right = (c: Col) => c.type === 'money' || c.type === 'number' || c.type === 'pct';

export default function ReportsPage() {
  const { user } = useAuth();
  const { data: catalogue, error: catErr } = useApi<Entry[]>('/reports');
  const [key, setKey] = useState<string>('');
  const [range, setRange] = useState({ preset: '180', from: addDaysIso(todayIso(), -180), to: todayIso() });
  const [view, setView] = useState<'Chart' | 'Table'>('Chart');
  const { data: rep, error, isLoading } = useApi<Report>(key ? `/reports/${key}?from=${range.from}&to=${range.to}` : null);

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get('report');
    if (catalogue?.length && !key) setKey(k && catalogue.some((c) => c.key === k) ? k : catalogue[0].key);
  }, [catalogue, key]);
  useEffect(() => { if (rep && !rep.chart && view === 'Chart') setView('Table'); }, [rep]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = (catalogue || []).reduce<Record<string, Entry[]>>((a, e) => { (a[e.group] ||= []).push(e); return a; }, {});
  const pick = (k: string) => { setKey(k); setView('Chart'); window.history.replaceState(null, '', `/reports?report=${k}`); };
  function exportCsv() {
    if (!rep) return;
    const rows = rep.totals ? [...rep.rows, { ...rep.totals, [rep.columns[0].key]: 'Total' }] : rep.rows;
    saveBlob(new Blob([toCsv(rep.columns, rows)], { type: 'text/csv;charset=utf-8' }), `${rep.key}_${rep.from}_${rep.to}.csv`);
  }
  const moneyChart = !!rep?.chart && rep.chart.series.every((s) => rep.columns.find((c) => c.key === s.key)?.type === 'money');

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Reports & Analytics' }]} title="Reports & Analytics"
        sub="Industrial report pack and core registers · pick a report, a period, then chart, table or export" />
      <ErrorBox error={catErr} />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(240px, 280px) minmax(0, 1fr)', alignItems: 'start' }}>
        <Card title="Report library">
          {!catalogue ? <Loading rows={8} /> : (
            <div className="stack" style={{ gap: 14 }}>
              {Object.entries(groups).map(([g, list]) => (
                <div key={g}>
                  <div className="text-xs muted strong" style={{ textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{g}</div>
                  <div className="stack tight" style={{ gap: 2 }}>
                    {list.map((e) => (
                      <button key={e.key} type="button" onClick={() => pick(e.key)} className={'nav-item' + (e.key === key ? ' active' : '')} style={{ border: 0, width: '100%', background: e.key === key ? undefined : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                        <FileSpreadsheet size={16} /><span className="truncate">{e.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title={rep?.title || catalogue?.find((c) => c.key === key)?.title || 'Report'} sub={rep ? `${date(rep.from)} – ${date(rep.to)} · ${rep.description}` : catalogue?.find((c) => c.key === key)?.description}
            right={<div className="row" style={{ gap: 8 }}>
              {rep?.chart ? <Segmented options={['Chart', 'Table'] as const} value={view} onChange={setView} /> : null}
              <Button size="sm" icon={Download} disabled={!rep?.rows.length} onClick={exportCsv}>Export</Button>
            </div>}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <div className="chips">
                {PRESETS.map((p) => <button key={p.key} type="button" className={range.preset === p.key ? 'on' : ''} onClick={() => setRange({ preset: p.key, from: p.from(), to: todayIso() })}>{p.label}</button>)}
              </div>
              <div className="spacer" />
              <input className="input" type="date" style={{ width: 150, height: 36 }} value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, preset: '', from: e.target.value })} aria-label="From date" />
              <span className="muted">–</span>
              <input className="input" type="date" style={{ width: 150, height: 36 }} value={range.to} min={range.from} max={todayIso()} onChange={(e) => e.target.value && setRange({ ...range, preset: '', to: e.target.value })} aria-label="To date" />
            </div>
            <ErrorBox error={error} />
            {isLoading && !rep ? <Loading rows={6} /> : !rep ? null : !rep.rows.length ? <Alert tone="info" title="Nothing in this period">Try a longer date range.</Alert> : view === 'Chart' && rep.chart ? (
              <div className="stack tight">
                <Legend items={rep.chart.series.map((s, i) => ({ name: s.label, color: COLORS[i % COLORS.length] }))} />
                <BarChart labels={rep.rows.slice(0, 24).map((r) => { const v = r[rep.chart!.x]; return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? dateShort(v) : String(v ?? '—').slice(0, 14); })}
                  series={rep.chart.series.map((s, i) => ({ name: s.label, color: COLORS[i % COLORS.length], values: rep.rows.slice(0, 24).map((r) => Number(r[s.key]) || 0) }))}
                  format={moneyChart ? (v) => inrShort(v) : (v) => num(v)} height={280} />
                {rep.rows.length > 24 ? <div className="text-xs muted">Chart shows the first 24 rows · the table has all {rep.rows.length}</div> : null}
              </div>
            ) : null}
            {rep?.note ? <div className="text-xs muted" style={{ marginTop: 10 }}>{rep.note}</div> : null}
          </Card>

          {rep && rep.rows.length && (view === 'Table' || rep.chart) ? (
            <div className="card">
              <div className="toolbar"><div><div className="tt">{view === 'Table' ? 'Table' : 'Data'}</div><div className="ts">{rep.rows.length} row{rep.rows.length === 1 ? '' : 's'}</div></div><div className="spacer" /><Table2 size={16} className="muted" /></div>
              <div className="table-wrap" style={{ maxHeight: view === 'Table' ? undefined : 420, overflow: 'auto' }}>
                <table className="tbl">
                  <thead><tr>{rep.columns.map((c) => <th key={c.key} className={right(c) ? 'r' : undefined}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {rep.rows.map((r, i) => <tr key={i}>{rep.columns.map((c) => <td key={c.key} className={right(c) ? 'r num' : undefined}>{fmt(c, r[c.key])}</td>)}</tr>)}
                    {rep.totals ? (
                      <tr style={{ background: 'var(--bg-subtle)' }}>
                        {rep.columns.map((c, i) => <td key={c.key} className={(right(c) ? 'r num ' : '') + 'strong'}>{i === 0 ? 'Total' : rep.totals![c.key] !== undefined ? fmt(c, rep.totals![c.key]) : ''}</td>)}
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {!rep && !isLoading && key ? <Card><div className="empty"><ChartColumn size={24} /><div>Pick a report</div></div></Card> : null}
        </div>
      </div>
    </>
  );
}
