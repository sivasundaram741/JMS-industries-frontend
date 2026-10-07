'use client';
// Weekly attendance roster. People who edit HR mark each day from the cell; a day can be filled in one go.
import { useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Clock, MapPinned, Plane, Search } from 'lucide-react';
import { put, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { addDaysIso, dateShort, num, todayIso } from '@/lib/format';
import { toneOf } from '@/lib/status';
import { Avatar, Button, Card, ErrorBox, Kpi, Loading, Modal, TextField, Two, useToast } from '@/components/ui';
import type { HrSummary } from './EmployeesTab';

const STATUSES = ['Present', 'Late', 'On field', 'Leave', 'Absent', 'Holiday', 'Week off'] as const;
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
interface Cell { status: string; lateMin: number; hours: number; note: string | null }
interface Week { days: string[]; rows: Array<{ id: number; code: string; name: string; designation: string | null; shift: string | null; department: string | null; cells: Record<string, Cell>; hours: number }> }
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const mondayOf = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return addDaysIso(iso, -((d.getDay() + 6) % 7)); };
const cellStyle = (status?: string) => {
  if (!status) return undefined;
  const t = toneOf('att', status);
  return { background: `var(--${t}-bg)`, color: `var(--${t}-fg)`, borderColor: `color-mix(in srgb, var(--${t}-solid) 30%, transparent)` };
};

export function AttendanceTab() {
  const { can } = useAuth();
  const toast = useToast();
  const today = todayIso();
  const [week, setWeek] = useState(mondayOf(today));
  const [dept, setDept] = useState('');
  const [shift, setShift] = useState('');
  const [q, setQ] = useState('');
  const { data, error, isLoading, mutate } = useApi<Week>('/hr/attendance' + qs({ weekStart: week, departmentId: dept || undefined, shift: shift || undefined }));
  const { data: sum, mutate: mutateSum } = useApi<HrSummary>('/hr/summary');
  const { data: depts } = useApi<any[]>('/hr/departments');
  const { data: shifts } = useApi<any[]>('/master-data/shift?status=active');
  const [saving, setSaving] = useState<string>('');
  const [late, setLate] = useState<null | { empId: number; date: string; name: string; min: string }>(null);
  const canEdit = can('hr', 'edit');

  async function mark(date: string, entries: Array<{ employeeId: number; status: string | null; lateMin?: number }>) {
    setSaving(date);
    try {
      await put('/hr/attendance', { date, entries });
      await mutate();
      if (date === today) mutateSum();
    } catch (e) { toast.err(e); mutate(); } finally { setSaving(''); }
  }
  function setCell(empId: number, date: string, status: string, lateMin = 0) {
    if (!data) return;
    if (status === 'Late' && !lateMin) { setLate({ empId, date, name: data.rows.find((x) => x.id === empId)?.name || '', min: '15' }); return; }
    mutate({ ...data, rows: data.rows.map((r) => (r.id === empId ? { ...r, cells: { ...r.cells, [date]: { status, lateMin, hours: 0, note: null } } } : r)) }, { revalidate: false });
    mark(date, [{ employeeId: empId, status: status || null, lateMin }]);
  }
  function fillDay(date: string) {
    if (!data) return;
    const entries = data.rows.filter((r) => !r.cells[date]).map((r) => ({ employeeId: r.id, status: 'Present' }));
    if (!entries.length) { toast.ok('Everyone is already marked'); return; }
    mark(date, entries).then(() => toast.ok(`${entries.length} marked present`));
  }

  const rows = (data?.rows || []).filter((r) => !q || (r.name + ' ' + r.code + ' ' + (r.designation || '')).toLowerCase().includes(q.toLowerCase()));
  const t = sum?.today;
  const pct = sum && sum.headcount ? Math.round(((t?.present || 0) / sum.headcount) * 100) : 0;

  return (
    <>
      {sum && t ? (
        <div className="kpis">
          <Kpi label="Present today" value={`${num(t.present)} / ${num(sum.headcount)}`} icon={CalendarCheck} tone="success" delta={`${pct}%`} trend="flat" note={`${t.marked} marked so far`} />
          <Kpi label="On field" value={num(t.onField)} icon={MapPinned} tone="info" note="customer sites, vendors" />
          <Kpi label="Late arrivals" value={num(t.late)} icon={Clock} tone="warning" note="after the shift grace time" />
          <Kpi label="On leave" value={num(t.leave)} icon={Plane} tone="purple" note={`${t.absent} absent`} />
        </div>
      ) : <Card><Loading rows={2} /></Card>}
      <ErrorBox error={error} />
      <div className="card">
        <div className="toolbar">
          <div><div className="tt">Week of {data ? dateShort(data.days[0]) : '—'}</div><div className="ts">{canEdit ? 'Click a cell to mark · future days are locked' : 'View only · your role cannot mark attendance'}</div></div>
          <div className="row" style={{ gap: 4 }}>
            <button className="btn xs" aria-label="Previous week" onClick={() => setWeek(addDaysIso(week, -7))}><ChevronLeft size={14} /></button>
            <button className="btn xs" disabled={week === mondayOf(today)} onClick={() => setWeek(mondayOf(today))}>This week</button>
            <button className="btn xs" aria-label="Next week" onClick={() => setWeek(addDaysIso(week, 7))}><ChevronRight size={14} /></button>
          </div>
          <label className="tsearch"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee…" aria-label="Search employee" /></label>
          <div className="spacer" />
          <select className="select" style={{ width: 170, height: 36 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
            <option value="">Department: All</option>
            {(depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="select" style={{ width: 130, height: 36 }} value={shift} onChange={(e) => setShift(e.target.value)} aria-label="Shift">
            <option value="">Shift: All</option>
            {(shifts || []).map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        {isLoading && !data ? <div className="card-body"><Loading rows={6} /></div> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Employee</th>
                  {(data?.days || []).map((d) => {
                    const x = new Date(d + 'T00:00:00');
                    return (
                      <th key={d} style={{ textAlign: 'center', color: d === today ? 'var(--text-link)' : undefined }}>
                        {DAY[x.getDay()]} {x.getDate()}
                        {canEdit && d <= today ? <div><button type="button" className="btn xs" style={{ marginTop: 4, height: 22, fontSize: 10, textTransform: 'none', letterSpacing: 0 }} disabled={!!saving} onClick={() => fillDay(d)} title="Mark everyone not yet marked as present">Rest present</button></div> : null}
                      </th>
                    );
                  })}
                  <th className="r">Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><div className="row" style={{ gap: 10 }}><Avatar initials={initials(r.name)} size="sm" /><Two a={r.name} b={`${r.designation || r.code}${r.shift ? ' · Shift ' + r.shift : ''}`} /></div></td>
                    {(data?.days || []).map((d) => {
                      const c = r.cells[d];
                      const label = c ? (c.status === 'Late' && c.lateMin ? `Late ${c.lateMin}m` : c.status) : '—';
                      return (
                        <td key={d} style={{ textAlign: 'center', padding: '8px 6px' }}>
                          {canEdit && d <= today ? (
                            <select className={'att-cell' + (c ? '' : ' empty')} style={cellStyle(c?.status)} value={c?.status || ''} disabled={saving === d} onChange={(e) => setCell(r.id, d, e.target.value)} aria-label={`${r.name} on ${d}`} title={label}>
                              <option value="">—</option>
                              {STATUSES.map((s) => <option key={s} value={s}>{s === 'Late' && c?.status === 'Late' && c.lateMin ? `Late ${c.lateMin}m` : s}</option>)}
                            </select>
                          ) : <span className={'att-cell' + (c ? '' : ' empty')} style={{ ...cellStyle(c?.status), display: 'inline-grid', placeItems: 'center' }}>{label}</span>}
                        </td>
                      );
                    })}
                    <td className="r num strong">{num(r.hours, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && !rows.length ? <div className="empty text-sm">No employees match</div> : null}
          </div>
        )}
        <Modal open={!!late} onClose={() => setLate(null)} title={`Late · ${late?.name || ''}`} sub={late ? dateShort(late.date) : undefined}
          footer={<><Button onClick={() => setLate(null)}>Cancel</Button><Button variant="primary" disabled={!late || !(Number(late.min) > 0)} onClick={() => { if (late) { setCell(late.empId, late.date, 'Late', Math.round(Number(late.min))); setLate(null); } }}>Mark late</Button></>}>
          <TextField label="Minutes late" type="number" min={1} value={late?.min || ''} onChange={(v) => late && setLate({ ...late, min: v })} hint="Hours worked are reduced by the time lost" />
        </Modal>
        <div className="tfoot">
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {STATUSES.map((s) => <span key={s} className="row text-xs" style={{ gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, display: 'inline-block', background: `var(--${toneOf('att', s)}-solid)` }} />{s}</span>)}
          </div>
          <Button size="xs" variant="ghost" onClick={() => mutate()}>Refresh</Button>
        </div>
      </div>
    </>
  );
}
