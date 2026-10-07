'use client';
// People · HR & Payroll: employees, weekly attendance and the monthly payroll run.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button, PageHeader, Tabs } from '@/components/ui';
import { EmployeesTab } from './_components/EmployeesTab';
import { AttendanceTab } from './_components/AttendanceTab';
import { PayrollTab } from './_components/PayrollTab';
import { EmployeeModal } from './_components/EmployeeModal';

type Tab = 'employees' | 'attendance' | 'payroll';

export default function HrPage() {
  const { user, can } = useAuth();
  const [tab, setTab] = useState<Tab>('employees');
  const [runId, setRunId] = useState<number | null>(null);
  const [edit, setEdit] = useState<null | { id?: number }>(null);
  const [version, setVersion] = useState(0);

  // ?tab=attendance|payroll, ?run=<payroll run id>, ?employee=<id>
  const sp = useSearchParams();
  useEffect(() => {
    const t = sp.get('tab');
    if (t === 'attendance' || t === 'payroll') setTab(t);
    if (sp.get('run')) { setTab('payroll'); setRunId(Number(sp.get('run'))); }
    if (sp.get('employee')) { setTab('employees'); setEdit({ id: Number(sp.get('employee')) }); }
  }, [sp]);
  const go = (t: Tab) => { setTab(t); window.history.replaceState(null, '', t === 'employees' ? '/hr' : `/hr?tab=${t}`); };
  const titles: Record<Tab, { title: string; sub: string }> = {
    employees: { title: 'Employees', sub: 'Everyone on the rolls · department, role, shift and pay profile' },
    attendance: { title: 'Attendance', sub: 'Weekly roster · mark present, late, on field, leave or absent · locked once payroll is approved' },
    payroll: { title: 'Payroll', sub: 'Monthly run from attendance · PF, ESI, professional tax and TDS · manager approval before the bank transfer' },
  };

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'HR & Payroll' }, { label: titles[tab].title }]} title={titles[tab].title} sub={titles[tab].sub}
        actions={tab === 'employees' && can('hr', 'create') ? <Button variant="primary" icon={Plus} onClick={() => setEdit({})}>Add employee</Button> : null} />
      <Tabs active={tab} items={[
        { key: 'employees', label: 'Employees', onClick: () => go('employees') },
        { key: 'attendance', label: 'Attendance', onClick: () => go('attendance') },
        { key: 'payroll', label: 'Payroll', onClick: () => go('payroll') },
      ]} />
      {tab === 'employees' ? <EmployeesTab key={version} onOpen={(id) => setEdit({ id })} /> : null}
      {tab === 'attendance' ? <AttendanceTab /> : null}
      {tab === 'payroll' ? <PayrollTab runId={runId} onRun={setRunId} /> : null}
      <EmployeeModal open={!!edit} id={edit?.id} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setVersion((v) => v + 1); }} />
    </>
  );
}
