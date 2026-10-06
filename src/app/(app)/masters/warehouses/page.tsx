'use client';
// Masters · Warehouses & locations: stock locations and what they hold. RM, WIP, QC, FG and In transit are built in.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { post, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { inr } from '@/lib/format';
import { Badge, Button, DataTable, ErrorBox, Modal, PageHeader, TextField, Two, useToast } from '@/components/ui';

const ROLE: Record<string, string> = { RM: 'Raw material and bought-out store', WIP: 'Issued to the shop floor', QC: 'Waiting for inspection or quarantined', FG: 'Finished goods ready to dispatch', TRN: 'Stock returns on the way' };

export default function WarehousesPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const { data, error, mutate } = useApi<any[]>('/warehouses/details');
  const [edit, setEdit] = useState<null | { id?: number; code: string; name: string }>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      const r = edit.id ? await put(`/warehouses/${edit.id}`, { name: edit.name.trim() }) : await post('/warehouses', { code: edit.code.trim().toUpperCase(), name: edit.name.trim() });
      toast.ok(`${r.name} saved`);
      setEdit(null);
      mutate();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader back="/masters" crumbs={[{ label: user?.company.shortName || '' }, { label: 'Masters', href: '/masters' }, { label: 'Warehouses & locations' }]} title="Warehouses & locations"
        sub="Stock locations and what they hold · the five built-in locations drive GRN, QC, production and dispatch"
        actions={can('masters', 'create') ? <Button variant="primary" icon={Plus} onClick={() => setEdit({ code: '', name: '' })}>Add location</Button> : null} />
      <ErrorBox error={error} />
      <DataTable
        loading={!data && !error}
        rows={data}
        onRowClick={can('masters', 'edit') ? (w) => setEdit({ id: w.id, code: w.code, name: w.name }) : undefined}
        columns={[
          { key: 'name', header: 'Location', render: (w) => <Two a={w.name} b={w.code} /> },
          { key: 'role', header: 'Used for', render: (w) => <span className="secondary">{ROLE[w.code] || 'Extra location'}</span> },
          { key: 'type', header: 'Type', render: (w) => (w.system ? <Badge tone="info" dot={false}>Built in</Badge> : <Badge tone="neutral" dot={false}>Custom</Badge>) },
          { key: 'lots', header: 'Lots', align: 'right', render: (w) => w.lots },
          { key: 'value', header: 'Stock value', align: 'right', render: (w) => <span className="strong">{inr(w.stockValue)}</span> },
        ]}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Rename ${edit.code}` : 'Add location'} sub={edit?.id ? 'The code cannot change once stock has moved' : 'e.g. a branch store or a bonded area'}
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!edit || edit.name.trim().length < 2 || (!edit.id && edit.code.trim().length < 2)} onClick={save}>Save</Button></>}>
        {edit ? (
          <div className="form c2">
            <TextField label="Code" value={edit.code} disabled={!!edit.id} onChange={(v) => setEdit({ ...edit, code: v.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} placeholder="PLT2" hint="Capital letters, digits and -" />
            <TextField label="Name" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} placeholder="Plant 2 · Store" />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
