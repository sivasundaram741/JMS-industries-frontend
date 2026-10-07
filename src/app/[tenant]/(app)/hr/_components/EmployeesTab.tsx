'use client';
import { useState } from 'react';
import { CalendarPlus, MapPin, UserCheck, Users } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, inr, num } from '@/lib/format';
import { Avatar, Card, DataTable, ErrorBox, ListItem, ListToolbar, Loading, Pagination, ProgressBar, StatusBadge, Two } from '@/components/ui';

export interface HrSummary {
  headcount: number; active: number; onLeave: number; upcomingJoiners: number; locations: string[]; byDepartment: Array<{ department: string; people: number }>;
  today: { marked: number; present: number; late: number; onField: number; leave: number; absent: number };
}
const FILTERS = [{ key: '', label: 'Current' }, { key: 'Active', label: 'Active' }, { key: 'On leave', label: 'On leave' }, { key: 'Exited', label: 'Exited' }];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const joined = (d?: string | null) => (d ? date(d).slice(3) : '—');

export function EmployeesTab({ onOpen }: { onOpen: (id: number) => void }) {
  const { can } = useAuth();
  const L = useListState();
  const [dept, setDept] = useState('');
  const [loc, setLoc] = useState('');
  const { data, error, isLoading } = useApi<Page<any>>('/hr/employees' + qs({ ...L.params, departmentId: dept || undefined, location: loc || undefined }));
  const { data: sum } = useApi<HrSummary>('/hr/summary');
  const { data: depts } = useApi<any[]>('/hr/departments');
  const canPay = can('hr', 'edit');
  const max = Math.max(1, ...(sum?.byDepartment || []).map((d) => d.people));

  return (
    <div className="grid main-side">
      <div className="stack">
        <ErrorBox error={error} />
        <DataTable
          loading={isLoading}
          toolbar={<ListToolbar title={sum ? `${num(sum.headcount)} people across ${sum.locations.length} location${sum.locations.length === 1 ? '' : 's'}` : 'Employees'} search={L.search} onSearch={L.setSearch} placeholder="Search name, ID, role…"
            chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }}
            right={<div className="row" style={{ gap: 6 }}>
              <select className="select" style={{ width: 170, height: 36 }} value={dept} onChange={(e) => { setDept(e.target.value); L.setPage(1); }} aria-label="Department">
                <option value="">Department: All</option>
                {(depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className="select" style={{ width: 160, height: 36 }} value={loc} onChange={(e) => { setLoc(e.target.value); L.setPage(1); }} aria-label="Location">
                <option value="">Location: All</option>
                {(sum?.locations || []).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>} />}
          rows={data?.rows}
          onRowClick={(r) => onOpen(r.id)}
          empty="No employees match"
          columns={[
            { key: 'name', header: 'Employee', render: (r) => <div className="row" style={{ gap: 10 }}><Avatar initials={initials(r.name)} size="sm" /><Two a={r.name} b={r.code} /></div> },
            { key: 'role', header: 'Role', render: (r) => <span className="secondary">{r.designation || '—'}</span> },
            { key: 'dept', header: 'Department', render: (r) => <Two a={r.department || '—'} b={r.location || undefined} /> },
            { key: 'shift', header: 'Shift', render: (r) => (r.shift ? <span className="chip">Shift {r.shift}</span> : <span className="muted">—</span>) },
            { key: 'joined', header: 'Joined', render: (r) => <span className="nowrap">{joined(r.dateOfJoining)}</span> },
            ...(canPay ? [{ key: 'gross', header: 'Monthly gross', align: 'right' as const, render: (r: any) => (r.monthlyGross ? inr(r.monthlyGross) : <span className="muted">—</span>) }] : []),
            { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="emp" status={r.status} /> },
          ]}
          footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="employees" /> : null}
        />
      </div>
      <div className="stack">
        <Card title="Headcount by department" sub={sum ? `${num(sum.headcount)} people` : undefined}>
          {!sum ? <Loading rows={4} /> : (
            <div className="stack tight" style={{ gap: 10 }}>
              {sum.byDepartment.map((d) => (
                <div key={d.department}>
                  <div className="row between text-sm"><span>{d.department}</span><span className="num strong">{d.people}</span></div>
                  <ProgressBar pct={(d.people / max) * 100} tone="info" />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Upcoming">
          {!sum ? <Loading rows={3} /> : (
            <div className="list">
              <ListItem icon={CalendarPlus} tone="teal" title={`${sum.upcomingJoiners} joiner${sum.upcomingJoiners === 1 ? '' : 's'} coming`} sub="Date of joining after today" />
              <ListItem icon={UserCheck} tone="warning" title={`${sum.onLeave} on long leave`} sub="Status set to On leave" />
              <ListItem icon={MapPin} tone="info" title={`${sum.locations.length} locations`} sub={sum.locations.slice(0, 4).join(' · ')} />
              <ListItem icon={Users} tone="purple" title={`${sum.today.marked} of ${sum.headcount} marked today`} sub={`${sum.today.present} present · ${sum.today.leave} leave · ${sum.today.absent} absent`} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
