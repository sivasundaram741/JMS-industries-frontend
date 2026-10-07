'use client';
// Monthly payroll: calculate from attendance, review exceptions, send for approval, approve, mark paid. The bank
// transfer file and payslip register download as CSV.
import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { Calculator, Check, Download, HandCoins, Send, TriangleAlert } from 'lucide-react';
import { post, saveBlob, toCsv } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, dateTime, inr, inrShort, monthLabel, num, todayIso } from '@/lib/format';
import { Alert, Badge, Button, Card, DataTable, ErrorBox, KeyValue, ListItem, Loading, Modal, StatStrip, StatusBadge, Stepper, TextField, Two, useToast } from '@/components/ui';

interface Run { id: number; period: string; payDate: string; workingDays: number; employees: number; status: string; gross: number; pf: number; esi: number; pt: number; tds: number; deductions: number; net: number; approvedAt: string | null; paidAt: string | null; approvedByName?: string | null; createdAt: string }
interface RunDetail extends Run {
  payslips: Array<{ id: number; employeeId: number; employeeCode: string; employeeName: string; designation: string | null; department: string | null; paidDays: number; lopDays: number; gross: number; basic: number; hra: number; special: number; pf: number; esi: number; pt: number; tds: number; deductions: number; net: number; monthlyGross: number; bankAccount: string | null }>;
  byDepartment: Array<{ department: string; people: number; gross: number; deductions: number; net: number; exceptions: number }>;
  exceptions: Array<{ employeeCode: string; employeeName: string; note: string }>;
}
const STEP: Record<string, number> = { Calculated: 2, 'Pending approval': 3, Approved: 4, Paid: 6 };

export function PayrollTab({ runId, onRun }: { runId: number | null; onRun: (id: number) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const { mutate: mutateAll } = useSWRConfig();
  const { data: runs, error, mutate: mutateRuns } = useApi<Run[]>('/hr/payroll/runs');
  const canSee = can('hr', 'edit') || can('hr', 'approve');
  const sel = runId ?? runs?.[0]?.id ?? null;
  const { data: run, error: runErr, mutate } = useApi<RunDetail>(canSee && sel ? `/hr/payroll/runs/${sel}` : null);
  const [calc, setCalc] = useState<null | { period: string; payDate: string }>(null);
  const [approve, setApprove] = useState(false);
  const [busy, setBusy] = useState('');
  const thisMonth = todayIso().slice(0, 7);

  useEffect(() => { if (runs?.length && runId === null) onRun(runs[0].id); }, [runs, runId, onRun]);

  async function calculate(period: string, payDate?: string) {
    setBusy('calc');
    try {
      const r = await post<RunDetail>('/hr/payroll/runs', { period, payDate: payDate || undefined });
      toast.ok(`Payroll ${monthLabel(period)} calculated · ${r.employees} employees · net ${inrShort(r.net)}`);
      setCalc(null);
      await mutateRuns();
      onRun(r.id);
      mutate(r, { revalidate: false });
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  async function act(action: 'submit' | 'approve' | 'pay') {
    if (!run) return;
    setBusy(action);
    try {
      const r = await post<RunDetail>(`/hr/payroll/runs/${run.id}/${action}`);
      await mutate(r, { revalidate: false });
      mutateRuns();
      mutateAll((k) => typeof k === 'string' && k.startsWith('/approvals'));
      setApprove(false);
      toast.ok(action === 'pay' ? 'Marked paid · payslips released' : r.status === 'Approved' ? 'Payroll approved · attendance is locked' : 'Sent to the manager for approval');
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  function bankFile() {
    if (!run) return;
    const rows = run.payslips.map((p) => ({ code: p.employeeCode, name: p.employeeName, account: p.bankAccount || 'MISSING', amount: p.net.toFixed(2), narration: `Salary ${monthLabel(run.period)}` }));
    saveBlob(new Blob([toCsv([{ key: 'code', label: 'Employee ID' }, { key: 'name', label: 'Name' }, { key: 'account', label: 'Bank account' }, { key: 'amount', label: 'Amount' }, { key: 'narration', label: 'Narration' }], rows)], { type: 'text/csv;charset=utf-8' }), `salary-transfer-${run.period}.csv`);
  }
  function register() {
    if (!run) return;
    saveBlob(new Blob([toCsv([
      { key: 'employeeCode', label: 'Employee ID' }, { key: 'employeeName', label: 'Name' }, { key: 'department', label: 'Department' }, { key: 'paidDays', label: 'Paid days' }, { key: 'lopDays', label: 'LOP days' },
      { key: 'basic', label: 'Basic' }, { key: 'hra', label: 'HRA' }, { key: 'special', label: 'Special' }, { key: 'gross', label: 'Gross' }, { key: 'pf', label: 'PF' }, { key: 'esi', label: 'ESI' }, { key: 'pt', label: 'Prof. tax' }, { key: 'tds', label: 'TDS' }, { key: 'deductions', label: 'Deductions' }, { key: 'net', label: 'Net pay' },
    ], run.payslips)], { type: 'text/csv;charset=utf-8' }), `payroll-register-${run.period}.csv`);
  }

  if (error) return <ErrorBox error={error} />;
  if (!runs) return <Card><Loading rows={4} /></Card>;
  if (!canSee) return <Alert tone="info" title="Salaries are hidden for your role">Your role can see headcount and attendance. Payroll is open to HR editors and approvers.</Alert>;

  const hasThisMonth = runs.some((r) => r.period === thisMonth);
  const canCalc = can('hr', 'edit');
  return (
    <>
      <div className="card">
        <div className="toolbar">
          <div><div className="tt">Payroll runs</div><div className="ts">Pick a month</div></div>
          <div className="chips">
            {runs.map((r) => <button key={r.id} type="button" className={r.id === sel ? 'on' : ''} onClick={() => onRun(r.id)}>{monthLabel(r.period)} · {r.status}</button>)}
          </div>
          <div className="spacer" />
          {canCalc ? <Button size="sm" icon={Calculator} onClick={() => setCalc({ period: thisMonth, payDate: "" })}>{hasThisMonth ? 'Run or recalculate' : `Run ${monthLabel(thisMonth)}`}</Button> : null}
        </div>
      </div>

      {!runs.length ? <Alert tone="info" title="No payroll run yet">Mark attendance for the month, then run payroll.</Alert> : null}
      <ErrorBox error={runErr} />
      {sel && !run && !runErr ? <Card><Loading rows={6} /></Card> : null}
      {run ? (
        <>
          <Card title={`Payroll · ${monthLabel(run.period)}`} sub={`Pay date ${date(run.payDate)} · ${run.employees} employees · ${run.workingDays} working days`}
            right={<div className="row" style={{ gap: 8 }}>
              <StatusBadge kind="payroll" status={run.status} />
              <Button size="sm" icon={Download} onClick={register}>Payslip register</Button>
              {['Approved', 'Paid'].includes(run.status) ? <Button size="sm" icon={Download} onClick={bankFile}>Bank transfer file</Button> : null}
              {run.status === 'Calculated' && canCalc ? <Button size="sm" icon={Calculator} loading={busy === 'calc'} onClick={() => calculate(run.period, run.payDate)}>Recalculate</Button> : null}
              {run.status === 'Calculated' && canCalc ? <Button size="sm" variant="primary" icon={Send} loading={busy === 'submit'} onClick={() => act('submit')}>{can('hr', 'approve') ? 'Approve payroll' : 'Send for approval'}</Button> : null}
              {run.status === 'Pending approval' && can('hr', 'approve') ? <Button size="sm" variant="success" icon={Check} onClick={() => setApprove(true)}>Approve payroll</Button> : null}
              {run.status === 'Approved' && canCalc ? <Button size="sm" variant="primary" icon={HandCoins} loading={busy === 'pay'} onClick={() => act('pay')}>Mark paid</Button> : null}
            </div>}>
            <Stepper current={STEP[run.status] ?? 1} steps={[
              { label: 'Attendance', sub: run.status === 'Calculated' ? 'Open for changes' : 'Locked' },
              { label: 'Calculated', sub: dateTime(run.createdAt) },
              { label: 'Review', sub: `${run.exceptions.length} exception${run.exceptions.length === 1 ? '' : 's'}` },
              { label: 'Manager approval', sub: run.approvedByName ? `${run.approvedByName} · ${dateTime(run.approvedAt)}` : 'Waiting' },
              { label: 'Bank transfer', sub: run.status === 'Approved' ? 'Download the file' : run.paidAt ? 'Done' : '—' },
              { label: 'Paid', sub: run.paidAt ? dateTime(run.paidAt) : '—' },
            ]} />
          </Card>
          <StatStrip items={[
            { label: 'Employees', value: num(run.employees) },
            { label: 'Gross pay', value: inr(run.gross) },
            { label: 'Deductions', value: inr(run.deductions) },
            { label: 'Net pay', value: inr(run.net), color: 'success' },
          ]} />
          <div className="grid main-side" style={{ alignItems: 'start' }}>
            <DataTable
              toolbar={<div className="toolbar"><div><div className="tt">By department</div><div className="ts">Gross, deductions and net pay</div></div></div>}
              rows={run.byDepartment} rowKey="department"
              columns={[
                { key: 'department', header: 'Department', render: (d) => <span className="strong">{d.department}</span> },
                { key: 'people', header: 'People', align: 'right', render: (d) => d.people },
                { key: 'gross', header: 'Gross', align: 'right', render: (d) => inrShort(d.gross) },
                { key: 'ded', header: 'Deductions', align: 'right', render: (d) => inrShort(d.deductions) },
                { key: 'net', header: 'Net pay', align: 'right', render: (d) => <span className="strong">{inrShort(d.net)}</span> },
                { key: 'st', header: 'Status', render: (d) => (d.exceptions ? <Badge tone="warning">{d.exceptions} exception{d.exceptions === 1 ? '' : 's'}</Badge> : <Badge tone="success">Ready</Badge>) },
              ]} />
            <div className="stack">
              <Card title="Statutory" sub={`Auto-computed for ${monthLabel(run.period)}`}>
                <KeyValue cols={1} items={[['Provident Fund (PF)', inr(run.pf)], ['ESI', inr(run.esi)], ['Professional tax', inr(run.pt)], ['TDS on salary', inr(run.tds)]]} />
              </Card>
              <Card title="Exceptions" sub="Check before approving">
                <div className="list">
                  {run.exceptions.length ? run.exceptions.slice(0, 8).map((x) => <ListItem key={x.employeeCode + x.note} icon={TriangleAlert} tone={x.note.includes('bank') ? 'danger' : 'warning'} title={x.employeeName} sub={`${x.employeeCode} · ${x.note}`} />) : <div className="empty text-sm">None</div>}
                  {run.exceptions.length > 8 ? <div className="text-xs muted" style={{ paddingTop: 8 }}>+ {run.exceptions.length - 8} more in the payslips below</div> : null}
                </div>
              </Card>
            </div>
          </div>
          <DataTable
            toolbar={<div className="toolbar"><div><div className="tt">Payslips</div><div className="ts">Basic 50% · HRA 20% · special allowance the rest · loss of pay for days marked Absent</div></div></div>}
            rows={run.payslips}
            columns={[
              { key: 'emp', header: 'Employee', render: (p) => <Two a={p.employeeName} b={`${p.employeeCode} · ${p.department || '—'}`} /> },
              { key: 'days', header: 'Paid days', align: 'right', render: (p) => <Two a={num(p.paidDays, 1)} b={p.lopDays ? <span className="f-danger">{num(p.lopDays, 1)} LOP</span> : undefined} /> },
              { key: 'gross', header: 'Gross', align: 'right', render: (p) => inr(p.gross) },
              { key: 'pf', header: 'PF', align: 'right', render: (p) => inr(p.pf) },
              { key: 'esi', header: 'ESI', align: 'right', render: (p) => (p.esi ? inr(p.esi) : '—') },
              { key: 'pt', header: 'Prof. tax', align: 'right', render: (p) => inr(p.pt) },
              { key: 'tds', header: 'TDS', align: 'right', render: (p) => (p.tds ? inr(p.tds) : '—') },
              { key: 'net', header: 'Net pay', align: 'right', render: (p) => <span className="strong">{inr(p.net)}</span> },
              { key: 'bank', header: 'Bank', render: (p) => (p.bankAccount ? <span className="num secondary">{p.bankAccount}</span> : <Badge tone="danger">Missing</Badge>) },
            ]} />
        </>
      ) : null}

      <Modal open={!!calc} onClose={() => setCalc(null)} title="Run payroll" sub="Calculates every active employee from the month's attendance · a calculated run can be recalculated until it is approved"
        footer={<><Button onClick={() => setCalc(null)}>Cancel</Button><Button variant="primary" icon={Calculator} loading={busy === 'calc'} disabled={!calc?.period || calc.period > thisMonth} onClick={() => calc && calculate(calc.period, calc.payDate)}>Calculate</Button></>}>
        {calc ? (
          <div className="form c2">
            <TextField label="Month" type="month" value={calc.period} onChange={(v) => setCalc({ ...calc, period: v })} hint={calc.period > thisMonth ? 'Future months cannot be run' : undefined} />
            <TextField label="Pay date (optional)" type="date" value={calc.payDate} onChange={(v) => setCalc({ ...calc, payDate: v })} hint="Defaults to the last day of the month" />
          </div>
        ) : null}
      </Modal>
      <Modal open={approve} onClose={() => setApprove(false)} title={`Approve payroll · ${run ? monthLabel(run.period) : ''}`} sub="Releases the bank transfer file and locks the month's attendance"
        footer={<><Button onClick={() => setApprove(false)}>Cancel</Button><Button variant="success" icon={Check} loading={busy === 'approve'} onClick={() => act('approve')}>Approve payroll</Button></>}>
        {run ? <KeyValue cols={2} items={[['Employees', num(run.employees)], ['Gross pay', inr(run.gross)], ['Deductions', inr(run.deductions)], ['Net pay', inr(run.net)]]} /> : null}
        {run?.exceptions.length ? <div style={{ marginTop: 14 }}><Alert tone="warning" title={`${run.exceptions.length} exception${run.exceptions.length === 1 ? '' : 's'}`}>{run.exceptions.slice(0, 3).map((x) => `${x.employeeName}: ${x.note}`).join(' · ')}{run.exceptions.length > 3 ? ' …' : ''}</Alert></div> : null}
      </Modal>
    </>
  );
}
