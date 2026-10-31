'use client';
import { useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { post, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { Alert, Button, DataTable, Modal, PageHeader, SelectField, TextField, useToast } from '@/components/ui';

const TYPES = [
  { value: 'Plant', label: 'Plant' },
  { value: 'Office', label: 'Office' },
  { value: 'Warehouse', label: 'Warehouse' },
  { value: 'Workshop', label: 'Workshop' },
  { value: 'Site', label: 'Site' },
];

const blank = () => ({ code: '', name: '', type: '', address: '', isActive: true });

export default function UnitLocationsPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const { data, isLoading, mutate } = useApi<any[]>('/unit-locations');
  const rows = data || [];

  const [edit, setEdit] = useState<null | { id?: number } & ReturnType<typeof blank>>(null);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const set = (k: string) => (v: string | boolean) => setEdit((x: any) => x ? { ...x, [k]: v } : x);

  const validationMsg = tried && (!edit?.code?.trim() ? 'Enter a code.' : !edit?.name?.trim() ? 'Enter a name.' : null);

  async function save() {
    if (!edit) return;
    setTried(true);
    if (!edit.code.trim() || !edit.name.trim()) return;
    setBusy(true);
    try {
      const body = { code: edit.code.trim().toUpperCase(), name: edit.name.trim(), type: edit.type || null, address: edit.address || null, isActive: edit.isActive };
      edit.id ? await put(`/unit-locations/${edit.id}`, body) : await post('/unit-locations', body);
      toast.ok(`${body.name} saved`);
      setEdit(null);
      setTried(false);
      mutate();
    } catch (e) { toast.err(e); }
    finally { setBusy(false); }
  }

  function openAdd() { setEdit(blank()); setTried(false); }
  function openEdit(r: any) {
    if (!can('masters', 'edit')) return;
    setEdit({ id: r.id, code: r.code, name: r.name, type: r.type || '', address: r.address || '', isActive: r.isActive !== false });
    setTried(false);
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Masters' }, { label: 'Unit Locations' }]}
        title="Unit Locations"
        sub="Physical production locations — plants, workshops and sites tracked per work order entry"
        actions={can('masters', 'create') ? <Button variant="primary" icon={Plus} onClick={openAdd}>Add Location</Button> : null}
      />

      <DataTable
        loading={isLoading}
        rows={rows}
        empty="No unit locations yet — add your first plant or workshop"
        onRowClick={openEdit}
        columns={[
          { key: 'code', header: 'Code', render: (r) => <span className="strong chip">{r.code}</span> },
          { key: 'name', header: 'Name', render: (r) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={13} className="muted" />
              <span className="strong">{r.name}</span>
            </div>
          ) },
          { key: 'type', header: 'Type', render: (r) => r.type ? <span className="chip">{r.type}</span> : <span className="muted">—</span> },
          { key: 'address', header: 'Address', render: (r) => <span className="secondary text-sm">{r.address || '—'}</span> },
          { key: 'status', header: 'Status', render: (r) => (
            <span className={r.isActive !== false ? 'chip f-success' : 'chip muted'}>
              {r.isActive !== false ? 'Active' : 'Inactive'}
            </span>
          ) },
        ]}
      />

      {edit && (
        <Modal open title={edit.id ? 'Edit Unit Location' : 'Add Unit Location'} onClose={() => setEdit(null)}
          footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}
        >
          <div className="stack gap-12">
            {validationMsg ? <Alert tone="warning">{validationMsg}</Alert> : null}
            <div className="form c2">
              <TextField label="Code" value={edit.code} onChange={(v) => set('code')(String(v).toUpperCase())} placeholder="e.g. HP1" required disabled={!!edit.id} />
              <SelectField label="Type" value={edit.type} onChange={set('type') as any} options={TYPES} placeholder="Select type…" />
              <TextField label="Name" value={edit.name} onChange={set('name') as any} placeholder="e.g. Hosur Plant 1" required className="span2" />
              <TextField label="Address" value={edit.address} onChange={set('address') as any} placeholder="Street, City" className="span2" />
            </div>
            <SelectField label="Status" value={edit.isActive ? 'active' : 'inactive'}
              onChange={(v) => set('isActive')(v === 'active')}
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
