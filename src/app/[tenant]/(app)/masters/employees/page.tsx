'use client';
// Masters · Employees: the people who run the machines. Their names are what the
// Production Log records against each day's work.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button, PageHeader } from '@/components/ui';
import { EmployeesTab } from './_components/EmployeesTab';
import { EmployeeModal } from './_components/EmployeeModal';

export default function EmployeesPage() {
  const { user, can } = useAuth();
  const [edit, setEdit] = useState<null | { id?: number }>(null);
  const [version, setVersion] = useState(0);

  // ?employee=<id> opens one straight away, e.g. from a search result
  const sp = useSearchParams();
  useEffect(() => { if (sp.get('employee')) setEdit({ id: Number(sp.get('employee')) }); }, [sp]);

  return (
    <>
      <PageHeader
        back="/masters"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Masters' }, { label: 'Employees' }]}
        title="Employees"
        sub="Everyone on the rolls · department, designation and shift"
        actions={can('hr', 'create') ? <Button variant="primary" icon={Plus} onClick={() => setEdit({})}>Add employee</Button> : null}
      />
      <EmployeesTab key={version} onOpen={(id) => setEdit({ id })} />
      <EmployeeModal open={!!edit} id={edit?.id} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setVersion((v) => v + 1); }} />
    </>
  );
}
