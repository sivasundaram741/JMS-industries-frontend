'use client';
// Masters · Work centres & machines: machines used by work orders and the shop floor. Status comes from the shop floor.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { post, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { ago, dateTime } from '@/lib/format';
import { Button, DataTable, ErrorBox, ListToolbar, Modal, PageHeader, StatusBadge, TextField, Two, useToast } from '@/components/ui';
import { Attachments } from '@/components/docs/Attachments';

export default function MachinesPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const { data, error, mutate } = useApi<any[]>('/machines');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<null | { id?: number; code: string; name: string; workCentre: string }>(null);
  const [busy, setBusy] = useState(false);
  const rows = (data || []).filter((m) => !q || `${m.code} ${m.name} ${m.workCentre || ''}`.toLowerCase().includes(q.toLowerCase()));

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      const body = { code: edit.code.trim().toUpperCase(), name: edit.name.trim(), workCentre: edit.workCentre.trim() || null };
      const r = edit.id ? await put(`/machines/${edit.id}`, body) : await post('/machines', body);
      toast.ok(`${r.code} saved`);
      setEdit(null);
      mutate();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader back="/masters" crumbs={[{ label: user?.company.shortName || '' }, { label: 'Masters', href: '/masters' }, { label: 'Work centres & machines' }]} title="Work centres & machines"
        sub="Machines used by work orders and the shop floor · status is set from the shop floor"
        actions={can('masters', 'create') ? <Button variant="primary" icon={Plus} onClick={() => setEdit({ code: '', name: '', workCentre: '' })}>Add machine</Button> : null} />
      <ErrorBox error={error} />
      <DataTable
        loading={!data && !error}
        toolbar={<ListToolbar search={q} onSearch={setQ} placeholder="Search machine or work centre…" />}
        rows={rows}
        onRowClick={can('masters', 'edit') ? (m) => setEdit({ id: m.id, code: m.code, name: m.name, workCentre: m.workCentre || '' }) : undefined}
        empty="No machines set up"
        columns={[
          { key: 'code', header: 'Machine', render: (m) => <Two a={m.code} b={m.name} /> },
          { key: 'wc', header: 'Work centre', render: (m) => <span className="secondary">{m.workCentre || '—'}</span> },
          { key: 'op', header: 'Operator', render: (m) => <span className="secondary">{m.operator || '—'}</span> },
          { key: 'status', header: 'Status', render: (m) => <StatusBadge kind="machine" status={m.status} /> },
          { key: 'since', header: 'Since', render: (m) => <Two a={dateTime(m.statusSince)} b={ago(m.statusSince)} /> },
        ]}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.code}` : 'Add machine'} wide
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!edit || edit.code.trim().length < 2 || edit.name.trim().length < 2} onClick={save}>Save</Button></>}>
        {edit ? (
          <div className="stack">
            <div className="form c3">
              <TextField label="Machine code" value={edit.code} onChange={(v) => setEdit({ ...edit, code: v.toUpperCase() })} placeholder="CNC-05" />
              <TextField label="Name / model" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} placeholder="VMC 850" />
              <TextField label="Work centre" value={edit.workCentre} onChange={(v) => setEdit({ ...edit, workCentre: v })} placeholder="Machining · Cell 1" />
            </div>
            {edit.id ? <Attachments entityType="MACHINE" entityId={edit.id} entityNo={edit.code} title="Manuals, calibration & PM records" /> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
