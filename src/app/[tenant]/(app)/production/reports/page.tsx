'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, ClipboardCheck, Printer, ShieldCheck } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { qs } from '@/lib/api';
import { date, dateShort, num } from '@/lib/format';
import { Alert, Badge, ButtonLink, Card, ErrorBox, PageHeader, Two } from '@/components/ui';
import { ProductionTabs } from '../_components/shared';

// ── helpers ────────────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}
function shiftLabel(s: string | null) {
  if (!s) return '—';
  return s === 'A' ? 'A (6AM–2PM)' : s === 'B' ? 'B (2PM–10PM)' : s === 'C' ? 'C (10PM–6AM)' : s;
}

// ── Report selector cards ──────────────────────────────────────────────────────
const REPORTS = [
  { key: 'daily', icon: CalendarDays, label: 'Daily Production Report', sub: 'All entries for a selected date · per WO, per operation breakdown' },
  { key: 'qc', icon: ShieldCheck, label: 'QC Certificate', sub: 'Material inspection results · inspector sign-off · printable' },
  { key: 'wo-summary', icon: ClipboardCheck, label: 'Work Order Summary', sub: 'Plan vs actual · materials issued vs consumed · scrap rate · full progress' },
];

export default function ProductionReportsPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<string>('daily');
  const [selectedDate, setSelectedDate] = useState(today());
  const [woNumber, setWoNumber] = useState('');

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Production' }, { label: 'Reports' }]}
        title="Production Reports"
        sub="Daily logs · quality certificates · work order summaries"
      />
      <ProductionTabs active="reports" />

      {/* Report selector */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {REPORTS.map((r) => {
          const I = r.icon;
          const on = report === r.key;
          return (
            <button
              key={r.key}
              type="button"
              className="card link"
              aria-pressed={on}
              onClick={() => setReport(r.key)}
              style={{
                textAlign: 'left', padding: '14px 16px', cursor: 'pointer', font: 'inherit', color: 'inherit',
                borderColor: on ? 'var(--brand)' : undefined,
                boxShadow: on ? '0 0 0 3px var(--brand-bg)' : undefined,
              }}
            >
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <I size={18} style={{ color: on ? 'var(--brand)' : undefined }} />
                <span className="strong text-sm">{r.label}</span>
              </div>
              <div className="text-xs secondary">{r.sub}</div>
            </button>
          );
        })}
      </div>

      {report === 'daily' && <DailyReport selectedDate={selectedDate} onDateChange={setSelectedDate} />}
      {report === 'qc' && <QcCertReport woNumber={woNumber} onWoChange={setWoNumber} />}
      {report === 'wo-summary' && <WoSummaryReport woNumber={woNumber} onWoChange={setWoNumber} />}
    </>
  );
}

// ── Daily Production Report ────────────────────────────────────────────────────
function DailyReport({ selectedDate, onDateChange }: { selectedDate: string; onDateChange: (d: string) => void }) {
  const { data, error, isLoading } = useApi<any>('/production-entries' + qs({ date: selectedDate, pageSize: 200 }));
  const entries: any[] = data?.rows || [];

  // Group by WO
  const byWo = new Map<string, { woId: number; woNo: string; itemName: string; itemCode: string; uom: string; entries: any[] }>();
  for (const e of entries) {
    if (!byWo.has(e.workOrderNo)) {
      byWo.set(e.workOrderNo, { woId: e.workOrderId, woNo: e.workOrderNo, itemName: e.itemName, itemCode: e.itemCode, uom: e.uom, entries: [] });
    }
    byWo.get(e.workOrderNo)!.entries.push(e);
  }
  const woGroups = [...byWo.values()];

  const totalGood = entries.reduce((a, e) => a + e.qtyGood, 0);
  const totalScrap = entries.reduce((a, e) => a + e.qtyScrap, 0);
  const totalDown = entries.reduce((a, e) => a + e.downtimeMin, 0);

  return (
    <>
      <Card title="Daily Production Report" sub="All production entries logged for the selected date"
        right={
          <div className="row" style={{ gap: 8 }}>
            <input type="date" className="input" style={{ width: 160 }} value={selectedDate} onChange={(e) => onDateChange(e.target.value)} />
            <button type="button" className="btn" onClick={() => window.print()} title="Print this report">
              <Printer size={15} /> Print
            </button>
          </div>
        }>

        {/* Summary tiles */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Good Units', value: num(totalGood), tone: 'success' },
            { label: 'Scrap', value: num(totalScrap), tone: totalScrap > 0 ? 'danger' : 'neutral' },
            { label: 'Downtime', value: `${totalDown} min`, tone: totalDown > 60 ? 'warning' : 'neutral' },
            { label: 'WOs Active', value: num(woGroups.length), tone: 'info' },
            { label: 'Shift Entries', value: num(entries.length), tone: 'neutral' },
          ].map((t) => (
            <div key={t.label} className="card" style={{ padding: '10px 14px' }}>
              <div className="text-xs secondary">{t.label}</div>
              <div className={`h3 num strong f-${t.tone}`} style={{ marginTop: 4 }}>{t.value}</div>
            </div>
          ))}
        </div>

        <ErrorBox error={error} />

        {!isLoading && entries.length === 0 && (
          <Alert tone="info" title="No entries for this date">No production was logged on {date(selectedDate)}. Select a different date.</Alert>
        )}

        {woGroups.map((g) => {
          const good = g.entries.reduce((a, e) => a + e.qtyGood, 0);
          const scrap = g.entries.reduce((a, e) => a + e.qtyScrap, 0);
          const down = g.entries.reduce((a, e) => a + e.downtimeMin, 0);
          const scrapPct = (good + scrap) > 0 ? ((scrap / (good + scrap)) * 100).toFixed(1) : '0.0';
          return (
            <div key={g.woNo} style={{ marginBottom: 24 }}>
              {/* WO header */}
              <div className="row" style={{ gap: 10, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-default)' }}>
                <div style={{ flex: 1 }}>
                  <span className="strong">{g.woNo}</span>
                  <span className="secondary" style={{ marginLeft: 10 }}>{g.itemName} · {g.itemCode}</span>
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <span className="text-sm"><span className="f-success strong">{num(good)}</span> <span className="muted">{g.uom} good</span></span>
                  {scrap > 0 && <span className="text-sm f-danger">{num(scrap)} scrap ({scrapPct}%)</span>}
                  {down > 0 && <span className="text-sm f-warning">{down} min down</span>}
                  <ButtonLink href={`/production/work-orders/${g.woId}`} size="xs" variant="ghost">View WO</ButtonLink>
                </div>
              </div>
              {/* Entries table */}
              <div className="table-wrap">
                <table className="tbl" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Operation</th><th>Shift</th><th>Operator</th><th>Machine</th>
                      <th className="r">Good</th><th className="r">Scrap</th><th className="r">Downtime</th><th className="r">Run h</th><th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.entries.map((e: any) => (
                      <tr key={e.id}>
                        <td><div className="strong text-xs">Op {e.operationSeq}</div><div className="secondary text-xs truncate" style={{ maxWidth: 150 }}>{e.operationName}</div></td>
                        <td className="secondary nowrap text-xs">{shiftLabel(e.shift)}</td>
                        <td className="secondary text-xs">{e.operator || '—'}</td>
                        <td className="text-xs">{e.machineCode ? <span className="chip">{e.machineCode}</span> : <span className="muted">—</span>}</td>
                        <td className="r num f-success strong">{num(e.qtyGood)}</td>
                        <td className="r num">{e.qtyScrap > 0 ? <span className="f-danger">{num(e.qtyScrap)}</span> : <span className="muted">—</span>}</td>
                        <td className="r num">{e.downtimeMin > 0 ? <span className="f-warning">{e.downtimeMin} min</span> : <span className="muted">—</span>}</td>
                        <td className="r num secondary text-xs">{num(e.runHours, 1)}</td>
                        <td className="secondary text-xs" style={{ maxWidth: 180 }}>{e.notes || <span className="muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}

// ── QC Certificate ─────────────────────────────────────────────────────────────
function QcCertReport({ woNumber, onWoChange }: { woNumber: string; onWoChange: (s: string) => void }) {
  const [woId, setWoId] = useState<number | null>(null);
  const [inputVal, setInputVal] = useState(woNumber);
  // Fetch WO list to find ID by number
  const { data: woList } = useApi<any>('/work-orders?pageSize=200&search=' + encodeURIComponent(inputVal));
  const { data: cert, error, isLoading } = useApi<any>(woId ? `/work-orders/${woId}/qc-certificate` : null);

  function handleSearch() {
    const match = woList?.rows?.find((r: any) => r.number.toLowerCase() === inputVal.toLowerCase() || String(r.id) === inputVal);
    if (match) { setWoId(match.id); onWoChange(inputVal); }
  }

  const allPass = cert && cert.materials.every((m: any) => m.qcStatus === 'Pass');
  const hasFail = cert && cert.materials.some((m: any) => m.qcStatus === 'Fail');
  const inspectors = cert ? [...new Set(cert.materials.filter((m: any) => m.qcInspector).map((m: any) => m.qcInspector as string))] : [];

  return (
    <Card title="Material QC Certificate" sub="Inspection results per raw material · inspector sign-off"
      right={
        <div className="row" style={{ gap: 8 }}>
          <input
            type="text" className="input" style={{ width: 180 }} placeholder="WO number or ID"
            value={inputVal} onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button type="button" className="btn primary" onClick={handleSearch}>Load</button>
          {cert && (
            <button type="button" className="btn" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
          )}
        </div>
      }>

      <ErrorBox error={error} />

      {!cert && !isLoading && (
        <Alert tone="info" title="Enter a work order number">Type a WO number (e.g. WO-0042) and click Load to view the QC certificate.</Alert>
      )}

      {cert && (
        <div className="print-area">
          {/* Certificate header */}
          <div style={{ borderBottom: '2px solid var(--border-default)', paddingBottom: 16, marginBottom: 20 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div className="h3 strong">Material Inspection Certificate</div>
                <div className="text-sm secondary">JMS Industries · Work Order {cert.wo.number}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 14, padding: '4px 12px', borderRadius: 4, fontWeight: 700, background: hasFail ? 'var(--danger-bg)' : allPass ? 'var(--success-bg)' : 'var(--warning-bg)', color: hasFail ? 'var(--danger-solid)' : allPass ? 'var(--success-solid)' : 'var(--warning-solid)' }}>
                  {hasFail ? 'FAILED' : allPass ? 'PASSED' : 'PENDING'}
                </span>
                <div className="text-xs muted" style={{ marginTop: 4 }}>Printed {dateShort(cert.printedAt)}</div>
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 14 }}>
              {[
                ['Item', `${cert.wo.itemName} (${cert.wo.itemCode})`],
                ['Planned Qty', `${num(cert.wo.qtyPlanned)} ${cert.wo.uom}`],
                ['Completed', `${num(cert.wo.qtyCompleted)} ${cert.wo.uom}`],
                ['Inspector(s)', inspectors.join(', ') || 'Not assigned'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs muted">{k}</div>
                  <div className="text-sm strong">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Materials table */}
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="r">Required</th>
                  <th className="r">Issued</th>
                  <th className="r">Qty OK</th>
                  <th className="r">Qty Fail</th>
                  <th>Inspector</th>
                  <th>Date</th>
                  <th>Result</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {cert.materials.map((m: any) => (
                  <tr key={m.id}>
                    <td><Two a={m.itemName} b={m.itemCode} /></td>
                    <td className="r num">{num(m.qtyRequired, 3)} {m.uom}</td>
                    <td className="r num">{num(m.qtyIssued, 3)}</td>
                    <td className="r num">{m.qcQtyOk > 0 ? <span className="f-success">{num(m.qcQtyOk, 3)}</span> : <span className="muted">—</span>}</td>
                    <td className="r num">{m.qcQtyFail > 0 ? <span className="f-danger">{num(m.qcQtyFail, 3)}</span> : <span className="muted">—</span>}</td>
                    <td className="secondary text-sm">{m.qcInspector || <span className="muted">—</span>}</td>
                    <td className="secondary text-sm nowrap">{m.qcDate ? dateShort(m.qcDate) : <span className="muted">—</span>}</td>
                    <td>
                      <Badge tone={m.qcStatus === 'Pass' ? 'success' : m.qcStatus === 'Fail' ? 'danger' : 'neutral'}>{m.qcStatus}</Badge>
                    </td>
                    <td className="secondary text-sm" style={{ maxWidth: 180 }}>{m.qcNote || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signature block */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 32, marginTop: 40 }}>
            {['Inspected by', 'Reviewed by', 'Approved by'].map((role) => (
              <div key={role} style={{ borderTop: '1px solid var(--border-default)', paddingTop: 8 }}>
                <div className="text-xs muted">{role}</div>
                <div className="text-xs secondary" style={{ marginTop: 24 }}>Name / Signature / Date</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Work Order Summary Report ──────────────────────────────────────────────────
function WoSummaryReport({ woNumber, onWoChange }: { woNumber: string; onWoChange: (s: string) => void }) {
  const [woId, setWoId] = useState<number | null>(null);
  const [inputVal, setInputVal] = useState(woNumber);
  const { data: woList } = useApi<any>('/work-orders?pageSize=200&search=' + encodeURIComponent(inputVal));
  const { data: wo, error, isLoading } = useApi<any>(woId ? `/work-orders/${woId}` : null);

  function handleSearch() {
    const match = woList?.rows?.find((r: any) => r.number.toLowerCase() === inputVal.toLowerCase() || String(r.id) === inputVal);
    if (match) { setWoId(match.id); onWoChange(inputVal); }
  }

  if (!wo) return (
    <Card title="Work Order Summary" sub="Plan vs actual · materials · scrap rate · operation progress"
      right={
        <div className="row" style={{ gap: 8 }}>
          <input type="text" className="input" style={{ width: 180 }} placeholder="WO number or ID"
            value={inputVal} onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <button type="button" className="btn primary" onClick={handleSearch}>Load</button>
        </div>
      }>
      <ErrorBox error={error} />
      {!isLoading && <Alert tone="info" title="Enter a work order number">Type a WO number and click Load.</Alert>}
    </Card>
  );

  const ops: any[] = wo.operations || [];
  const mats: any[] = wo.materials || [];
  const entries: any[] = wo.entries || [];
  const totalGood = entries.reduce((a: number, e: any) => a + e.qtyGood, 0);
  const totalScrap = entries.reduce((a: number, e: any) => a + e.qtyScrap, 0);
  const totalDown = entries.reduce((a: number, e: any) => a + e.downtimeMin, 0);
  const scrapPct = (totalGood + totalScrap) > 0 ? ((totalScrap / (totalGood + totalScrap)) * 100).toFixed(1) : '0.0';
  const completionPct = wo.qtyPlanned > 0 ? Math.min(100, Math.round((totalGood / wo.qtyPlanned) * 100)) : 0;

  return (
    <Card title={`Work Order Summary — ${wo.number}`}
      sub={`${wo.itemName} · ${wo.itemCode} · ${wo.status}`}
      right={
        <div className="row" style={{ gap: 8 }}>
          <input type="text" className="input" style={{ width: 180 }} placeholder="WO number or ID"
            value={inputVal} onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <button type="button" className="btn primary" onClick={handleSearch}>Load</button>
          <button type="button" className="btn" onClick={() => window.print()}><Printer size={15} /> Print</button>
        </div>
      }>

      {/* KPI tiles */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Planned', value: `${num(wo.qtyPlanned)} ${wo.uom}`, tone: 'neutral' },
          { label: 'Good Produced', value: `${num(totalGood)} ${wo.uom}`, tone: 'success' },
          { label: 'Completion', value: `${completionPct}%`, tone: completionPct >= 100 ? 'success' : completionPct > 50 ? 'warning' : 'danger' },
          { label: 'Scrap', value: `${num(totalScrap)} (${scrapPct}%)`, tone: totalScrap > 0 ? 'danger' : 'neutral' },
          { label: 'Downtime', value: `${totalDown} min`, tone: totalDown > 120 ? 'warning' : 'neutral' },
          { label: 'Entries', value: num(entries.length), tone: 'neutral' },
        ].map((t) => (
          <div key={t.label} className="card" style={{ padding: '10px 14px' }}>
            <div className="text-xs secondary">{t.label}</div>
            <div className={`h3 num strong f-${t.tone}`} style={{ marginTop: 4 }}>{t.value}</div>
          </div>
        ))}
      </div>

      {/* Operations progress */}
      {ops.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="strong text-sm" style={{ marginBottom: 8 }}>Operation Progress</div>
          <div className="table-wrap">
            <table className="tbl" style={{ fontSize: 13 }}>
              <thead>
                <tr><th>#</th><th>Operation</th><th>Machine</th><th className="r">Planned</th><th className="r">Done</th><th className="r">Scrap</th><th className="r">Progress</th></tr>
              </thead>
              <tbody>
                {ops.map((o: any) => {
                  const pct = wo.qtyPlanned > 0 ? Math.min(100, Math.round((o.qtyDone / wo.qtyPlanned) * 100)) : 0;
                  const done = o.qtyDone >= wo.qtyPlanned;
                  return (
                    <tr key={o.id}>
                      <td className="num secondary">{o.seq}</td>
                      <td className="strong">{o.name}</td>
                      <td>{o.machineCode ? <span className="chip">{o.machineCode}</span> : <span className="muted">—</span>}</td>
                      <td className="r num">{num(wo.qtyPlanned)}</td>
                      <td className="r num">{num(o.qtyDone)}</td>
                      <td className="r num">{o.qtyScrap > 0 ? <span className="f-danger">{num(o.qtyScrap)}</span> : <span className="muted">—</span>}</td>
                      <td className="r" style={{ minWidth: 100 }}>
                        <div style={{ background: 'var(--bg-muted)', borderRadius: 2, height: 5, overflow: 'hidden', width: 80, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: done ? 'var(--success-solid)' : 'var(--brand)' }} />
                        </div>
                        <span className="num text-xs">{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Materials summary */}
      {mats.length > 0 && (
        <div>
          <div className="strong text-sm" style={{ marginBottom: 8 }}>Material Consumption Summary</div>
          <div className="table-wrap">
            <table className="tbl" style={{ fontSize: 13 }}>
              <thead>
                <tr><th>Material</th><th className="r">Required</th><th className="r">Issued</th><th className="r">Est. Consumed</th><th className="r">Balance</th><th>QC</th></tr>
              </thead>
              <tbody>
                {mats.map((m: any) => {
                  const consumed = wo.qtyPlanned > 0 ? Math.round(((m.qtyRequired / wo.qtyPlanned) * totalGood) * 1000) / 1000 : 0;
                  const balance = Math.max(0, Math.round((m.qtyIssued - consumed) * 1000) / 1000);
                  const qcTone = m.qcStatus === 'Pass' ? 'success' : m.qcStatus === 'Fail' ? 'danger' : 'neutral';
                  return (
                    <tr key={m.id}>
                      <td><Two a={m.itemName} b={m.itemCode} /></td>
                      <td className="r num">{num(m.qtyRequired, 3)} {m.uom}</td>
                      <td className="r num">{num(m.qtyIssued, 3)}</td>
                      <td className="r num secondary">{consumed > 0 ? num(consumed, 3) : '—'}</td>
                      <td className="r num">{balance > 0 ? <span className="f-warning">{num(balance, 3)}</span> : <span className="muted">—</span>}</td>
                      <td><Badge tone={qcTone}>{m.qcStatus || 'Pending'}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
