'use client';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { post, put, qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { Button, Checkbox, Chip, DataTable, ErrorBox, ListToolbar, Modal, PageHeader, Pagination, TextField, Two, useToast } from '@/components/ui';

const EMPTY = { code: '', name: '', gstin: '', phone: '', email: '', city: '', paymentTermsDays: '45', isSubcontractor: false };
const KINDS = [{ key: '', label: 'All vendors' }, { key: '1', label: 'Subcontractors' }];

export default function VendorsPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const L = useListState();
  const [kind, setKind] = useState('');
  const { data, error, isLoading, mutate } = useApi<Page<any>>('/vendors' + qs({ ...L.params, status: undefined, subcontractor: kind || undefined }));
  const [edit, setEdit] = useState<null | { id?: number }>(null);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (v: string) => setF({ ...f, [k]: v });

  // Open a vendor when arriving from search (?focus=id)
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (focus && data?.rows) { const v = data.rows.find((r: any) => String(r.id) === focus); if (v) open(v); }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  function open(v?: any) {
    setF(v ? { code: v.code, name: v.name, gstin: v.gstin || '', phone: v.phone || '', email: v.email || '', city: v.city || '', paymentTermsDays: String(v.paymentTermsDays), isSubcontractor: !!v.isSubcontractor } : EMPTY);
    setEdit(v ? { id: v.id } : {});
  }
  async function save() {
    setBusy(true);
    try {
      const body = { ...f, code: f.code || undefined, phone: f.phone || null, paymentTermsDays: Number(f.paymentTermsDays) };
      const r = edit?.id ? await put(`/vendors/${edit.id}`, body) : await post('/vendors', body);
      toast.ok(`${r.name} saved`);
      setEdit(null);
      mutate();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Purchase' }, { label: 'Vendors' }]} title="Vendors" sub="Suppliers and job-work subcontractors · GSTIN, phone with area code and payment terms"
        actions={can('vendors', 'create') ? <Button variant="primary" icon={Plus} onClick={() => open()}>New vendor</Button> : null} />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search name, code, city, GSTIN…" chips={{ options: KINDS, value: kind, onChange: (v) => { setKind(v); L.setPage(1); } }} />}
        rows={data?.rows}
        onRowClick={can('vendors', 'edit') ? (r) => open(r) : undefined}
        empty="No vendors match"
        columns={[
          { key: 'name', header: 'Vendor', render: (r) => <Two a={r.name} b={r.code} /> },
          { key: 'city', header: 'City', render: (r) => r.city || '—' },
          { key: 'gstin', header: 'GSTIN', render: (r) => <span className="num">{r.gstin || '—'}</span> },
          { key: 'phone', header: 'Phone', render: (r) => <Two a={<span className="num" style={{ fontWeight: 500 }}>{r.phone || '—'}</span>} b={r.email} /> },
          { key: 'kind', header: 'Type', render: (r) => (r.isSubcontractor ? <Chip tone="purple">Subcontractor</Chip> : <Chip>Supplier</Chip>) },
          { key: 'terms', header: 'Terms', render: (r) => `Net ${r.paymentTermsDays}` },
          { key: 'open', header: 'Open orders', align: 'right', render: (r) => (r.openOrders ? <span className="strong">{r.openOrders}</span> : <span className="muted">0</span>) },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="vendors" /> : null}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit vendor' : 'New vendor'} sub="Code is created automatically when left blank" wide
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save} disabled={f.name.trim().length < 2}>Save vendor</Button></>}>
        <div className="form c3">
          <TextField label="Vendor code" value={f.code} onChange={set('code')} placeholder="Auto" />
          <TextField className="span2" label="Name" value={f.name} onChange={set('name')} required />
          <TextField label="GSTIN" value={f.gstin} onChange={(v) => set('gstin')(v.toUpperCase())} placeholder="15 characters" />
          <TextField label="Phone (with area code)" value={f.phone} onChange={set('phone')} placeholder="+91 44 4000 0000" />
          <TextField label="Email" type="email" value={f.email} onChange={set('email')} />
          <TextField label="City" value={f.city} onChange={set('city')} />
          <TextField label="Payment terms (days)" type="number" value={f.paymentTermsDays} onChange={set('paymentTermsDays')} />
          <div className="field" style={{ alignSelf: 'end', paddingBottom: 10 }}>
            <Checkbox label="Subcontractor (job work)" checked={f.isSubcontractor} onChange={(v) => setF({ ...f, isSubcontractor: v })} />
          </div>
        </div>
      </Modal>
    </>
  );
}
