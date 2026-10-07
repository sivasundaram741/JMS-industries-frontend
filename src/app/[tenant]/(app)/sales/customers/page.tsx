'use client';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { post, put, qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { inr, inrShort } from '@/lib/format';
import { Button, DataTable, ErrorBox, ListToolbar, Modal, PageHeader, Pagination, TextField, Two, useToast } from '@/components/ui';

const EMPTY = { code: '', name: '', gstin: '', phone: '', email: '', city: '', address: '', creditLimit: '0', paymentTermsDays: '30' };

export default function CustomersPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const L = useListState();
  const { data, error, isLoading, mutate } = useApi<Page<any>>('/customers' + qs(L.params));
  const [edit, setEdit] = useState<null | { id?: number }>(null);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (v: string) => setF({ ...f, [k]: v });

  // Open a customer when arriving from search (?focus=id)
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (focus && data?.rows) { const c = data.rows.find((r: any) => String(r.id) === focus); if (c) open(c); }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  function open(c?: any) {
    setF(c ? { code: c.code, name: c.name, gstin: c.gstin || '', phone: c.phone || '', email: c.email || '', city: c.city || '', address: c.address || '', creditLimit: String(c.creditLimit), paymentTermsDays: String(c.paymentTermsDays) } : EMPTY);
    setEdit(c ? { id: c.id } : {});
  }
  async function save() {
    setBusy(true);
    try {
      const body = { ...f, code: f.code || undefined, creditLimit: Number(f.creditLimit), paymentTermsDays: Number(f.paymentTermsDays) };
      const r = edit?.id ? await put(`/customers/${edit.id}`, body) : await post('/customers', body);
      toast.ok(`${r.name} saved`);
      setEdit(null);
      mutate();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Sales' }, { label: 'Customers' }]} title="Customers" sub="Unique code, GSTIN, phone with area code, credit limit and payment terms"
        actions={can('customers', 'create') ? <Button variant="primary" icon={Plus} onClick={() => open()}>New customer</Button> : null} />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search name, code, city, GSTIN…" />}
        rows={data?.rows}
        onRowClick={can('customers', 'edit') ? (r) => open(r) : undefined}
        columns={[
          { key: 'name', header: 'Customer', render: (r) => <Two a={r.name} b={r.code} /> },
          { key: 'city', header: 'City' },
          { key: 'gstin', header: 'GSTIN', render: (r) => <span className="num">{r.gstin || '—'}</span> },
          { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
          { key: 'terms', header: 'Terms', render: (r) => `Net ${r.paymentTermsDays}` },
          { key: 'limit', header: 'Credit limit', align: 'right', render: (r) => inrShort(r.creditLimit) },
          { key: 'out', header: 'Outstanding', align: 'right', render: (r) => <span className={r.outstanding > r.creditLimit && r.creditLimit ? 'f-danger strong' : ''}>{inr(r.outstanding)}</span> },
          { key: 'open', header: 'Open orders', align: 'right', render: (r) => r.openOrders },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="customers" /> : null}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit customer' : 'New customer'} sub="Code is created automatically when left blank" wide
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save} disabled={f.name.trim().length < 2}>Save customer</Button></>}>
        <div className="form c3">
          <TextField label="Customer code" value={f.code} onChange={set('code')} placeholder="Auto" />
          <TextField className="span2" label="Name" value={f.name} onChange={set('name')} required />
          <TextField label="GSTIN" value={f.gstin} onChange={(v) => set('gstin')(v.toUpperCase())} placeholder="15 characters" />
          <TextField label="Phone (with area code)" value={f.phone} onChange={set('phone')} placeholder="+91 44 4000 0000" />
          <TextField label="Email" type="email" value={f.email} onChange={set('email')} />
          <TextField label="City" value={f.city} onChange={set('city')} />
          <TextField label="Credit limit (₹)" type="number" value={f.creditLimit} onChange={set('creditLimit')} hint="0 = no limit" />
          <TextField label="Payment terms (days)" type="number" value={f.paymentTermsDays} onChange={set('paymentTermsDays')} />
          <TextField className="full" label="Address" value={f.address} onChange={set('address')} />
        </div>
      </Modal>
    </>
  );
}
