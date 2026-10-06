'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, PackageX, Plus, SlidersHorizontal } from 'lucide-react';
import { qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useDebounced } from '@/lib/hooks';
import { inr, inrShort, num } from '@/lib/format';
import { Badge, Button, ButtonLink, Chip, DataTable, ErrorBox, Kpi, ListToolbar, PageHeader, ProgressBar, StatStrip, Toggle, Two } from '@/components/ui';
import { StageTracker } from '@/components/StageTracker';
import { AdjustModal } from './_components/AdjustModal';

const WAREHOUSE_CHIPS = [{ key: '', label: 'All' }, { key: 'RM', label: 'RM Store' }, { key: 'WIP', label: 'WIP' }, { key: 'QC', label: 'QC Hold' }, { key: 'FG', label: 'FG Store' }];
const TYPE_LABEL: Record<string, string> = { FG: 'Finished', RM: 'Raw material', BOUGHT: 'Bought-out', CONSUMABLE: 'Consumable', SERVICE: 'Service' };

export default function StockOverviewPage() {
  const { user, can } = useAuth();
  const sp = useSearchParams();
  const [wh, setWh] = useState('');
  const [search, setSearch] = useState('');
  const [low, setLow] = useState(sp.get('low') === '1');
  const [adjust, setAdjust] = useState(false);
  const q = useDebounced(search, 300);
  useEffect(() => { if (sp.get('low') === '1') setLow(true); }, [sp]);

  const { data: sum, mutate: mSum } = useApi<any>('/stock/summary');
  const { data: rows, error, isLoading, mutate: mRows } = useApi<any[]>('/stock/balances' + qs({ warehouse: wh, search: q }));
  const { data: lowItems, mutate: mLow } = useApi<any[]>('/stock/low');
  const shown = useMemo(() => (rows || []).filter((r) => !low || r.low).map((r) => ({ ...r, key: `${r.itemId}-${r.warehouse}` })), [rows, low]);
  const total = shown.reduce((a, r) => a + r.value, 0);
  const whPct = (k: string) => (sum?.stockValue ? Math.round((sum.byWarehouse[k] / sum.stockValue) * 100) + '%' : undefined);

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Warehouse' }, { label: 'Stock Overview' }]}
        title="Stock Overview"
        sub="Stock by item and warehouse · every figure comes from the stock ledger"
        actions={<>
          {can('stockentry', 'create') ? <ButtonLink href="/warehouse/grn" icon={ArrowDownToLine}>GRN & stock entry</ButtonLink> : null}
          {can('inventory', 'edit') ? <Button variant="primary" icon={SlidersHorizontal} onClick={() => setAdjust(true)}>Adjust stock</Button> : null}
        </>}
      />
      <StageTracker stage="store" />
      <div className="kpis">
        <Kpi label="Stock value" value={sum ? inrShort(sum.stockValue) : '—'} icon={Boxes} tone="info" note="at standard cost · all warehouses" />
        <Kpi label="Inward today" value={sum ? inrShort(sum.inwardToday) : '—'} icon={ArrowDownToLine} tone="success" note="GRNs, opening and adjustments" href="/warehouse/grn" />
        <Kpi label="Outward today" value={sum ? inrShort(sum.outwardToday) : '—'} icon={ArrowUpFromLine} tone="purple" note="dispatched to customers" />
        <Kpi label="Low stock alerts" value={sum ? `${num(sum.lowStockCount)} items` : '—'} icon={PackageX} tone={sum?.lowStockCount ? 'danger' : 'success'} note="below reorder level" href="/warehouse/stock?low=1" />
      </div>
      <StatStrip items={[
        { label: 'RM Store', value: sum ? inrShort(sum.byWarehouse.RM) : '—', tag: whPct('RM'), tone: 'info' },
        { label: 'WIP · shop floor', value: sum ? inrShort(sum.byWarehouse.WIP) : '—', tag: whPct('WIP'), tone: 'danger' },
        { label: 'QC Hold', value: sum ? inrShort(sum.byWarehouse.QC) : '—', tag: whPct('QC'), tone: 'warning' },
        { label: 'FG Store', value: sum ? inrShort(sum.byWarehouse.FG) : '—', tag: whPct('FG'), tone: 'success' },
      ]} />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={search} onSearch={setSearch} placeholder="Search item name or code…" chips={{ options: WAREHOUSE_CHIPS, value: wh, onChange: setWh }}
          right={<label className="row text-sm secondary" style={{ gap: 8, cursor: 'pointer' }}><Toggle on={low} onChange={setLow} label="Low stock only" />Low stock only</label>} />}
        rows={shown}
        rowKey="key"
        rowHref={(r) => `/tracking?itemId=${r.itemId}`}
        empty={low ? 'Nothing below its reorder level here' : 'No stock matches'}
        columns={[
          { key: 'item', header: 'Item', render: (r) => <Two a={r.itemName} b={r.itemCode} /> },
          { key: 'type', header: 'Type', render: (r) => <Chip>{TYPE_LABEL[r.itemType] || r.itemType}</Chip> },
          { key: 'wh', header: 'Warehouse', render: (r) => <span className="secondary nowrap">{r.warehouseName}</span> },
          { key: 'qty', header: 'Qty', align: 'right', render: (r) => <span className="nowrap"><span className="strong">{num(r.qty, 3)}</span> <span className="muted">{r.uom}</span></span> },
          { key: 'value', header: 'Value', align: 'right', render: (r) => inr(r.value) },
          { key: 'reorder', header: 'Reorder at', align: 'right', render: (r) => (r.reorderLevel ? num(r.reorderLevel) : <span className="muted">—</span>) },
          { key: 'status', header: 'Status', render: (r) => (r.low ? <Badge tone="danger">Low</Badge> : <Badge tone="success">OK</Badge>) },
        ]}
        footer={rows ? <div className="tfoot"><span>{num(shown.length)} stock lines · click a line for its stock ledger</span><span className="strong" style={{ color: 'var(--text-primary)' }}>{inr(total)}</span></div> : null}
      />
      <DataTable
        toolbar={<div className="toolbar"><div><div className="tt">Below reorder level</div><div className="ts">On hand in RM and FG stores vs the reorder level · raise a purchase order for bought items</div></div><div className="spacer" />{can('purchase', 'create') ? <ButtonLink href="/purchase/orders/new" size="sm" icon={Plus}>Raise purchase order</ButtonLink> : null}</div>}
        rows={lowItems}
        loading={!lowItems}
        empty="Every item is above its reorder level"
        rowHref={(i) => `/tracking?itemId=${i.id}`}
        columns={[
          { key: 'item', header: 'Item', render: (i) => <Two a={i.name} b={i.code} /> },
          { key: 'type', header: 'Type', render: (i) => <Chip>{TYPE_LABEL[i.type] || i.type}</Chip> },
          { key: 'onHand', header: 'On hand', align: 'right', render: (i) => <span className="nowrap"><span className={i.onHand <= 0 ? 'f-danger strong' : 'strong'}>{num(i.onHand, 3)}</span> <span className="muted">{i.uom}</span></span> },
          { key: 'reorder', header: 'Reorder at', align: 'right', render: (i) => num(i.reorderLevel) },
          { key: 'short', header: 'Short by', align: 'right', render: (i) => <Badge tone="danger" dot={false}>{num(i.shortBy, 3)}</Badge> },
          { key: 'fill', header: 'Cover', render: (i) => <ProgressBar pct={i.reorderLevel ? (i.onHand / i.reorderLevel) * 100 : 0} tone={i.onHand <= 0 ? 'danger' : 'warning'} width={160} label={Math.round(i.reorderLevel ? (i.onHand / i.reorderLevel) * 100 : 0) + '%'} /> },
          { key: 'act', header: '', align: 'right', render: (i) => (i.type === 'FG' || i.type === 'SERVICE'
            ? <span className="text-xs muted nowrap">Make on a work order</span>
            : can('purchase', 'create') ? <span onClick={(e) => e.stopPropagation()}><ButtonLink href={`/purchase/orders/new?item=${i.id}&qty=${Math.ceil(i.shortBy)}`} size="xs" icon={Plus}>Raise PO</ButtonLink></span> : null) },
        ]}
      />
      <AdjustModal open={adjust} onClose={() => setAdjust(false)} onDone={() => { setAdjust(false); mRows(); mSum(); mLow(); }} />
    </>
  );
}
