'use client';
import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';
import { qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useDebounced } from '@/lib/hooks';
import { date, inr, inrShort, num } from '@/lib/format';
import { Alert, Badge, DataTable, ErrorBox, ListToolbar, PageHeader, StatStrip, Two } from '@/components/ui';

const WAREHOUSES = [{ key: '', label: 'All' }, { key: 'RM', label: 'RM Store' }, { key: 'WIP', label: 'WIP' }, { key: 'QC', label: 'QC Hold' }, { key: 'FG', label: 'FG Store' }];
const DAY = 86400000;

export default function LotStockPage() {
  const { user } = useAuth();
  const [wh, setWh] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const { data, error, isLoading } = useApi<any[]>('/stock/lots' + qs({ warehouse: wh, search: q }));
  const rows = useMemo(() => {
    const now = Date.now();
    return (data || []).map((r) => ({ ...r, key: `${r.itemId}-${r.warehouse}-${r.lotNo}`, age: Math.max(0, Math.floor((now - new Date(r.firstAt).getTime()) / DAY)) }));
  }, [data]);
  const value = rows.reduce((a, r) => a + r.value, 0);
  const oldest = rows.reduce((a, r) => Math.max(a, r.age), 0);
  const aged = rows.filter((r) => r.age > 30).length;

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Warehouse' }, { label: 'Batch & Lot Stock' }]}
        title="Batch & Lot Stock"
        sub="Stock by item, lot / heat number and warehouse · oldest first"
      />
      <StatStrip items={[
        { label: 'Lots in stock', value: num(rows.length) },
        { label: 'Items', value: num(new Set(rows.map((r) => r.itemId)).size) },
        { label: 'Value', value: inrShort(value) },
        { label: 'Oldest lot', value: rows.length ? `${num(oldest)} days` : '—', color: oldest > 30 ? 'warning' : undefined },
        { label: 'Older than 30 days', value: num(aged), tag: aged ? 'Use first' : undefined, tone: 'warning' },
      ]} />
      <Alert tone="info" title="Issued oldest first (FIFO)">Material issue to work orders and dispatch take stock from the oldest lot in the warehouse first, so the top of each item's list goes out next.</Alert>
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={search} onSearch={setSearch} placeholder="Search item, code or lot no…" chips={{ options: WAREHOUSES, value: wh, onChange: setWh }}
          right={<span className="row text-xs muted" style={{ gap: 6 }}><ArrowDownWideNarrow size={14} />Oldest first</span>} />}
        rows={rows}
        rowKey="key"
        empty="No lots match"
        columns={[
          { key: 'item', header: 'Item', render: (r) => <Two a={r.itemName} b={r.itemCode} /> },
          { key: 'lot', header: 'Lot / heat no', render: (r) => <span className="chip num">{r.lotNo || 'No lot'}</span> },
          { key: 'wh', header: 'Warehouse', render: (r) => <span className="secondary nowrap">{r.warehouseName}</span> },
          { key: 'qty', header: 'Qty', align: 'right', render: (r) => <span className="nowrap"><span className="strong">{num(r.qty, 3)}</span> <span className="muted">{r.uom}</span></span> },
          { key: 'value', header: 'Value', align: 'right', render: (r) => inr(r.value) },
          { key: 'first', header: 'First received', render: (r) => <span className="nowrap">{date(r.firstAt)}</span> },
          { key: 'age', header: 'Age', align: 'right', render: (r) => (r.age > 60 ? <Badge tone="danger">{r.age} d</Badge> : r.age > 30 ? <Badge tone="warning">{r.age} d</Badge> : <span>{r.age} d</span>) },
        ]}
        footer={data ? <div className="tfoot"><span>{num(rows.length)} lots</span><span className="strong" style={{ color: 'var(--text-primary)' }}>{inr(value)}</span></div> : null}
      />
    </>
  );
}
