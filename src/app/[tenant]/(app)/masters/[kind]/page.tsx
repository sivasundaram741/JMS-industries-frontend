'use client';
// One small master list (categories, units, payment terms, tax codes, banks, cost centres, designations, shifts,
// holidays, inspection plans, tools): the list on the left, the selected record's form on the right.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, Plus } from 'lucide-react';
import { post, put, saveBlob, toCsv } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, dateTime, num } from '@/lib/format';
import { Alert, Badge, Button, Card, Checkbox, DataTable, ErrorBox, ListToolbar, Loading, PageHeader, TextField, Toggle, Two, useToast } from '@/components/ui';

type FieldType = 'text' | 'number' | 'bool' | 'date';
interface Kind { key: string; label: string; group: string; fields: Record<string, FieldType> }
interface Rec { id: number; code: string; name: string; isActive: boolean; data: Record<string, any>; updatedAt: string | null; updatedByName: string | null }

// Friendly labels and hints for each field
const FIELD_LABEL: Record<string, string> = {
  parent: 'Parent category', brand: 'Brand(s)', hsn: 'Default HSN', gstPct: 'GST %', type: 'Type', decimals: 'Decimals', note: 'Note', days: 'Days', earlyDiscount: 'Early-payment discount',
  lateFee: 'Late fee', cessPct: 'Cess %', reverseCharge: 'Reverse charge', einvoice: 'e-Invoice applies', accountNo: 'Account no', ifsc: 'IFSC', glAccount: 'Ledger account', owner: 'Owner',
  monthlyBudget: 'Monthly budget (₹)', alertPct: 'Alert at % of budget', department: 'Department', grade: 'Grade', start: 'Starts (HH:MM)', end: 'Ends (HH:MM)', graceMin: 'Grace minutes',
  appliesTo: 'Applies to', weekDays: 'Working days / week', date: 'Date', item: 'Item', stage: 'Stage', characteristics: 'Characteristics', sampling: 'Sampling plan', gauge: 'Gauge / instrument',
  lifeTotal: 'Tool life', lifeUsedPct: 'Life used %', location: 'Location', checkEvery: 'Check every',
};
const SUBTITLE: Record<string, string> = {
  category: 'Group items for reporting, pricing and tax defaults', uom: 'Units used on items, orders and stock', payment_term: 'Credit days offered to customers and given by vendors',
  tax_code: 'GST rates with HSN / SAC codes used on bills and invoices', bank: 'Bank accounts and cash books payments are made from', cost_centre: 'Where costs are booked, with a monthly budget',
  designation: 'Job titles used by HR and approvals', shift: 'Shift timings used by attendance and the shop floor', holiday: 'Paid holidays for attendance and payroll',
  inspection_plan: 'What quality checks at each stage, how many and with which gauge', tool: 'Cutting tools, fixtures and gauges with their life',
};
const blank = (k?: Kind) => ({ id: 0, code: '', name: '', isActive: true, data: Object.fromEntries(Object.keys(k?.fields || {}).map((f) => [f, k?.fields[f] === 'bool' ? false : ''])) });

export default function MasterKindPage() {
  const { kind } = useParams<{ kind: string }>();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: kinds } = useApi<Kind[]>('/master-data/kinds');
  const k = kinds?.find((x) => x.key === kind);
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('all');
  const [q, setQ] = useState('');
  const { data: rows, error, isLoading, mutate } = useApi<Rec[]>(`/master-data/${kind}?status=${status}`);
  const [sel, setSel] = useState<{ id: number; code: string; name: string; isActive: boolean; data: Record<string, any> } | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = can('masters', sel?.id ? 'edit' : 'create');

  useEffect(() => { if (rows && !sel && rows.length) setSel({ ...rows[0], data: { ...blank(k).data, ...rows[0].data } }); }, [rows, k]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => (rows || []).filter((r) => !q || `${r.code} ${r.name} ${Object.values(r.data).join(' ')}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const fields = Object.entries(k?.fields || {});
  const cols = fields.filter(([, t]) => t !== 'bool').slice(0, 3);
  const current = rows?.find((r) => r.id === sel?.id);

  async function save() {
    if (!sel) return;
    setBusy(true);
    try {
      const body = { code: sel.code.trim(), name: sel.name.trim(), isActive: sel.isActive, data: sel.data };
      const r = sel.id ? await put(`/master-data/${kind}/${sel.id}`, body) : await post(`/master-data/${kind}`, body);
      toast.ok(`${r.name} saved`);
      await mutate();
      setSel({ ...r, data: { ...blank(k).data, ...r.data } });
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }
  function exportCsv() {
    if (!rows) return;
    saveBlob(new Blob([toCsv([{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, ...fields.map(([f]) => ({ key: f, label: FIELD_LABEL[f] || f })), { key: 'active', label: 'Active' }],
      rows.map((r) => ({ ...r.data, code: r.code, name: r.name, active: r.isActive ? 'Yes' : 'No' })))], { type: 'text/csv;charset=utf-8' }), `${kind}.csv`);
  }
  const fmt = (t: FieldType, v: any) => (v === undefined || v === null || v === '' ? '—' : t === 'date' ? date(v) : t === 'number' ? num(v, 2) : String(v));

  if (kinds && !k) return <Alert tone="danger" title="Unknown master list">There is no master called “{kind}”.</Alert>;
  return (
    <>
      <PageHeader back="/masters" crumbs={[{ label: user?.company.shortName || '' }, { label: 'Masters', href: '/masters' }, { label: k?.label || '…' }]} title={k?.label || 'Masters'} sub={SUBTITLE[kind]}
        actions={<>
          <Button icon={Download} onClick={exportCsv} disabled={!rows?.length}>Export</Button>
          {can('masters', 'create') ? <Button variant="primary" icon={Plus} onClick={() => setSel(blank(k))}>Add record</Button> : null}
        </>} />
      <ErrorBox error={error} />
      <div className="grid main-side" style={{ alignItems: 'start' }}>
        <DataTable
          loading={isLoading}
          toolbar={<ListToolbar search={q} onSearch={setQ} placeholder={`Search ${k?.label.toLowerCase() || ''}…`}
            chips={{ options: [{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Inactive' }], value: status, onChange: (v) => setStatus(v as typeof status) }} />}
          rows={shown}
          onRowClick={(r) => setSel({ ...r, data: { ...blank(k).data, ...r.data } })}
          empty="No records"
          columns={[
            { key: 'name', header: 'Name', render: (r) => <Two a={<span style={{ color: r.id === sel?.id ? 'var(--text-link)' : undefined }}>{r.name}</span>} b={r.code} /> },
            ...cols.map(([f, t]) => ({ key: f, header: FIELD_LABEL[f] || f, align: t === 'number' ? ('right' as const) : undefined, render: (r: Rec) => <span className="secondary">{fmt(t, r.data[f])}</span> })),
            { key: 'status', header: 'Status', render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
          ]}
          footer={rows ? <div className="tfoot"><span>{shown.length} of {rows.length} records</span></div> : null}
        />
        <Card title={sel?.id ? 'Edit record' : 'New record'} sub={sel?.id ? `Selected: ${sel.name}` : 'Fill in and save'}>
          {!k || !sel ? <Loading rows={5} /> : (
            <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="form c2">
                <TextField label="Code" value={sel.code} onChange={(v) => setSel({ ...sel, code: v })} required />
                <TextField label="Name" value={sel.name} onChange={(v) => setSel({ ...sel, name: v })} required />
                {fields.map(([f, t]) => t === 'bool'
                  ? <div key={f} className="field" style={{ alignSelf: 'end', paddingBottom: 10 }}><Checkbox label={FIELD_LABEL[f] || f} checked={!!sel.data[f]} onChange={(v) => setSel({ ...sel, data: { ...sel.data, [f]: v } })} /></div>
                  : <TextField key={f} label={FIELD_LABEL[f] || f} type={t === 'number' ? 'number' : t === 'date' ? 'date' : 'text'} value={sel.data[f] ?? ''} onChange={(v) => setSel({ ...sel, data: { ...sel.data, [f]: v } })} className={f === 'characteristics' || f === 'note' ? 'full' : undefined} />)}
                <div className="full row" style={{ gap: 10 }}>
                  <Toggle on={sel.isActive} onChange={(v) => setSel({ ...sel, isActive: v })} label="Active" />
                  <div><div className="strong text-sm">{sel.isActive ? 'Active' : 'Inactive'}</div><div className="text-xs muted">Inactive records are hidden from new transactions</div></div>
                </div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 16 }}>
                <Button onClick={() => (current ? setSel({ ...current, data: { ...blank(k).data, ...current.data } }) : setSel(rows?.[0] ? { ...rows[0], data: { ...blank(k).data, ...rows[0].data } } : blank(k)))}>Cancel</Button>
                <Button variant="primary" loading={busy} disabled={!canEdit || !sel.code.trim() || !sel.name.trim()} onClick={save}>Save</Button>
              </div>
              {current?.updatedAt ? <div className="text-xs muted" style={{ marginTop: 12 }}>Last changed by {current.updatedByName || '—'} · {dateTime(current.updatedAt)}</div> : null}
            </fieldset>
          )}
        </Card>
      </div>
    </>
  );
}
