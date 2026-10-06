'use client';
// Masters · Departments: org structure used by HR, approvals and cost centres.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { post, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { Badge, Button, DataTable, ErrorBox, Modal, PageHeader, SelectField, TextField, Toggle, useToast } from '@/components/ui';

export default function DepartmentsPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const { data, error, mutate } = useApi<any[]>('/hr/departments');
  const { data: ccs } = useApi<any[]>('/master-data/cost_centre?status=active');
  const [edit, setEdit] = useState<null | { id?: number; name: string; head: string; costCentre: string; isActive: boolean }>(null);
  const [busy, setBusy] = useState(false);
  const allowed = can('hr') || can('masters');

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      const body = { name: edit.name.trim(), head: edit.head.trim() || null, costCentre: edit.costCentre || null, isActive: edit.isActive };
      const r = edit.id ? await put(`/hr/departments/${edit.id}`, body) : await post('/hr/departments', body);
      toast.ok(`${r.name} saved`);
      setEdit(null);
      mutate();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader back="/masters" crumbs={[{ label: user?.company.shortName || '' }, { label: 'Masters', href: '/masters' }, { label: 'Departments' }]} title="Departments"
        sub="Org structure used by HR, approvals and cost centres"
        actions={can('masters', 'create') || can('hr', 'create') ? <Button variant="primary" icon={Plus} onClick={() => setEdit({ name: '', head: '', costCentre: '', isActive: true })}>Add department</Button> : null} />
      <ErrorBox error={allowed ? error : null} />
      <DataTable
        loading={!data && !error}
        rows={data}
        onRowClick={can('masters', 'edit') || can('hr', 'edit') ? (d) => setEdit({ id: d.id, name: d.name, head: d.head || '', costCentre: d.costCentre || '', isActive: d.isActive }) : undefined}
        empty="No departments yet"
        columns={[
          { key: 'name', header: 'Department', render: (d) => <span className="strong">{d.name}</span> },
          { key: 'head', header: 'Head', render: (d) => <span className="secondary">{d.head || '—'}</span> },
          { key: 'people', header: 'People', align: 'right', render: (d) => d.people },
          { key: 'cc', header: 'Cost centre', render: (d) => <span className="num secondary">{d.costCentre || '—'}</span> },
          { key: 'status', header: 'Status', render: (d) => <Badge tone={d.isActive ? 'success' : 'neutral'}>{d.isActive ? 'Active' : 'Inactive'}</Badge> },
        ]}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : 'Add department'}
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!edit || edit.name.trim().length < 2} onClick={save}>Save</Button></>}>
        {edit ? (
          <div className="form c2">
            <TextField label="Department" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} />
            <TextField label="Head" value={edit.head} onChange={(v) => setEdit({ ...edit, head: v })} hint="Approver for leave and expenses" />
            <SelectField label="Cost centre" value={edit.costCentre} onChange={(v) => setEdit({ ...edit, costCentre: v })} placeholder="None" options={(ccs || []).map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))} />
            <div className="row" style={{ gap: 10, alignSelf: 'end', paddingBottom: 10 }}><Toggle on={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active" /><span className="text-sm">{edit.isActive ? 'Active' : 'Inactive'}</span></div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
