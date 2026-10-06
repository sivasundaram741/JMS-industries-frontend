'use client';
// List of debit invoices (Purchase) or credit invoices (Finance): one invoice can return many products.
import { useState } from 'react';
import { Boxes, CircleCheck, FileMinus, FileX2, IndianRupee, Plus } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { date, inr, inrShort, num } from '@/lib/format';
import { ButtonLink, Card, Chip, DataTable, ErrorBox, Kpi, ListToolbar, Loading, PageHeader, Pagination, StatusBadge, Two } from '@/components/ui';
import { NOTES, type NoteKind } from './config';

const FILTERS = [
  { key: '', label: 'All' }, { key: 'Draft', label: 'Draft' }, { key: 'Pending approval', label: 'Pending approval' }, { key: 'Approved', label: 'Approved' },
  { key: 'Adjusted,Settled', label: 'Settled' }, { key: 'Cancelled', label: 'Cancelled' },
];
interface Summary { countMtd: number; valueMtd: number; pctOfBase: number; linesMtd: number; avgLines: number; pendingApproval: number; reasons: string[] }

export function NoteList({ kind }: { kind: NoteKind }) {
  const c = NOTES[kind];
  const { user, can } = useAuth();
  const L = useListState();
  const [reason, setReason] = useState('');
  const { data, error, isLoading } = useApi<Page<any>>(c.api + qs({ ...L.params, reason: reason || undefined }));
  const { data: sum } = useApi<Summary>(`${c.api}/summary`);
  const Icon = kind === 'debit' ? FileMinus : FileX2;

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: c.section }, { label: c.plural }]} title={c.plural}
        sub={kind === 'debit' ? 'Debit invoices to vendors · returns, shortages and rate differences · one debit invoice can return many products' : 'Credit invoices to customers · returns, damages and rate corrections · one credit invoice can return many products'}
        actions={can(c.module, 'create') ? <ButtonLink variant="primary" icon={Plus} href={`${c.href}/new`}>New {c.label.toLowerCase()}</ButtonLink> : null} />
      {sum ? (
        <div className="kpis">
          <Kpi label={`${c.plural} (MTD)`} value={num(sum.countMtd)} icon={Icon} tone={kind === 'debit' ? 'warning' : 'purple'} note="raised this month" />
          <Kpi label={kind === 'debit' ? 'Debit value' : 'Credit value'} value={inrShort(sum.valueMtd)} icon={IndianRupee} tone="info" note={`${sum.pctOfBase}% of ${c.base} this month`} />
          <Kpi label="Products returned" value={`${num(sum.linesMtd)} lines`} icon={Boxes} tone="teal" note={`avg ${sum.avgLines} per invoice`} />
          <Kpi label="Awaiting approval" value={num(sum.pendingApproval)} icon={CircleCheck} tone="danger" note="manager sign-off" />
        </div>
      ) : <Card><Loading rows={2} /></Card>}
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder={`Search ${c.label.toLowerCase()}, ${c.party.toLowerCase()} or ${kind === 'debit' ? 'bill' : 'invoice'}…`} chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }}
          right={<select className="select" style={{ width: 190, height: 36 }} value={reason} onChange={(e) => { setReason(e.target.value); L.setPage(1); }} aria-label="Reason">
            <option value="">Reason: All</option>
            {(sum?.reasons || []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>} />}
        rows={data?.rows}
        rowHref={(r) => `${c.href}/${r.id}`}
        empty={`No ${c.plural.toLowerCase()} match`}
        columns={[
          { key: 'number', header: c.label, render: (r) => <Two a={r.number} b={date(r.noteDate)} /> },
          { key: 'party', header: c.party, render: (r) => <Two a={r.partyName} b={r.partyCode} /> },
          { key: 'src', header: kind === 'debit' ? 'Against bill' : 'Against invoice', render: (r) => r.sourceNo || <span className="muted">—</span> },
          { key: 'products', header: 'Products', align: 'right', render: (r) => <Two a={num(r.products)} b={`${num(r.units)} units`} /> },
          { key: 'reason', header: 'Reason', render: (r) => <Chip>{r.reason}</Chip> },
          { key: 'settle', header: 'Settlement', render: (r) => <span className="secondary">{r.settlement}</span> },
          { key: 'total', header: 'Value', align: 'right', render: (r) => <span className="strong">{inr(r.total)}</span> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="note" status={r.status} /> },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="invoices" /> : null}
      />
    </>
  );
}
