'use client';
// Tracking Center · Stock Tracking: every stock movement traced to its document, lot and user.
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, BellRing, Boxes, ChevronRight, Factory, PackageCheck, ShieldCheck, Warehouse, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { dateTime, inr, inrShort, num } from '@/lib/format';
import { hrefFor } from '@/lib/links';
import type { Tone } from '@/lib/status';
import { Card, DataTable, ErrorBox, IconTile, Kpi, ListToolbar, Loading, PageHeader, Pagination, Two } from '@/components/ui';
import { TrackingTabs } from './_components/TrackingTabs';

const REF_FILTERS = [
  { key: '', label: 'All' }, { key: 'GRN', label: 'Goods receipt' }, { key: 'QC_ACCEPT', label: 'QC accepted' }, { key: 'ISSUE', label: 'Issued to WO' },
  { key: 'PRODUCTION', label: 'Production' }, { key: 'FG_RECEIPT', label: 'FG receipt' }, { key: 'DISPATCH', label: 'Dispatch' },
  { key: 'ADJUST,OPENING', label: 'Adjustments' }, { key: 'SCRAP,RETURN,CONSUME', label: 'Consumed & scrap' },
];

const REF_LABEL: Record<string, string> = {
  OPENING: 'Opening balance', GRN: 'Goods receipt', QC_ACCEPT: 'QC accepted', ISSUE: 'Issued to work order', PRODUCTION: 'Production to QC',
  FG_RECEIPT: 'FG receipt', DISPATCH: 'Dispatched', ADJUST: 'Stock adjustment', SCRAP: 'Scrapped', RETURN: 'Returned to vendor', CONSUME: 'Consumed in WIP',
};

// The document a movement came from, by its number
function docLink(r: { refNo?: string | null; refId?: number | null }) {
  if (!r.refId || !r.refNo) return null;
  const type = r.refNo.startsWith('GRN') ? 'GRN' : r.refNo.startsWith('WO') ? 'WO' : r.refNo.startsWith('IL') ? 'IL' : r.refNo.startsWith('DC') ? 'DC' : r.refNo.startsWith('NCR') ? 'NCR' : null;
  return type ? hrefFor({ type, id: r.refId }) : null;
}

const FLOW: Array<{ code: string; label: string; icon: LucideIcon; tone: Tone }> = [
  { code: 'RM', label: 'Raw material', icon: Warehouse, tone: 'neutral' },
  { code: 'WIP', label: 'Work in progress', icon: Factory, tone: 'warning' },
  { code: 'QC', label: 'QC hold', icon: ShieldCheck, tone: 'purple' },
  { code: 'FG', label: 'Finished goods', icon: PackageCheck, tone: 'info' },
];

interface Summary { stockValue: number; byWarehouse: Record<string, number>; inwardToday: number; outwardToday: number; lowStockCount: number }

export default function StockTrackingPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const itemId = sp.get('itemId') || '';
  const L = useListState({ pageSize: 25 });
  const [refType, setRefType] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const { data: sum } = useApi<Summary>('/stock/summary');
  const { data, error, isLoading } = useApi<Page<any>>('/stock/ledger' + qs({ search: L.params.search, page: L.params.page, pageSize: L.params.pageSize, refType, warehouse, itemId }));
  const canItems = ['masters', 'inventory', 'sales', 'purchase', 'wo'].some((m) => can(m));
  const { data: item } = useApi<any>(itemId && canItems ? `/items/${itemId}` : null, { shouldRetryOnError: false });
  const itemName = item?.name || data?.rows?.[0]?.itemName || 'Item ' + itemId;

  const pickRef = (v: string) => { setRefType(v); L.setPage(1); };
  const pickWh = (v: string) => { setWarehouse((w) => (w === v ? '' : v)); L.setPage(1); };

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Tracking Center' }, { label: 'Stock Tracking' }]}
        title="Tracking Center"
        sub="Every stock movement traced to its document, lot and user"
      />
      <TrackingTabs active="stock" />
      {sum ? (
        <>
          <div className="kpis">
            <Kpi label="Stock value" value={inrShort(sum.stockValue)} icon={Boxes} tone="info" note="at standard cost · all stores" />
            <Kpi label="Inward today" value={inrShort(sum.inwardToday)} icon={ArrowDownLeft} tone="success" note="goods receipts and adjustments" />
            <Kpi label="Outward today" value={inrShort(sum.outwardToday)} icon={ArrowUpRight} tone="purple" note="dispatched from FG Store" />
            <Kpi label="Low stock alerts" value={`${sum.lowStockCount} items`} icon={BellRing} tone="danger" note="below reorder level" href="/warehouse/stock?low=1" />
          </div>
          <Card title="Material flow" sub="Raw material → work in progress → QC hold → finished goods, valued at standard cost · click a store to filter the ledger">
            <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
              {FLOW.map((s, i) => (
                <div key={s.code} style={{ display: 'contents' }}>
                  {i ? <span className="row muted" style={{ flex: 'none' }}><ChevronRight size={16} /></span> : null}
                  <button type="button" onClick={() => pickWh(s.code)} aria-pressed={warehouse === s.code}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: warehouse === s.code ? 'var(--brand-subtle)' : 'var(--bg-surface)', border: `1px solid ${warehouse === s.code ? 'var(--brand)' : 'var(--border-default)'}`, color: 'var(--text-primary)' }}>
                    <IconTile icon={s.icon} tone={s.tone} size={36} />
                    <span style={{ minWidth: 0 }}>
                      <span className="h3 num" style={{ display: 'block' }}>{inrShort(sum.byWarehouse[s.code] || 0)}</span>
                      <span className="text-sm secondary">{s.label}</span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : <Card><Loading rows={3} /></Card>}

      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar title="Stock ledger" search={L.search} onSearch={L.setSearch} placeholder="Search item, document, lot…" chips={{ options: REF_FILTERS, value: refType, onChange: pickRef }}
          right={(itemId || warehouse) ? (
            <div className="row" style={{ gap: 6 }}>
              {itemId ? <button type="button" className="chip t-info" style={{ border: 0, cursor: 'pointer', gap: 4, height: 28 }} onClick={() => router.replace('/tracking')} aria-label={`Remove filter ${itemName}`}>{itemName}<X size={13} /></button> : null}
              {warehouse ? <button type="button" className="chip t-info" style={{ border: 0, cursor: 'pointer', gap: 4, height: 28 }} onClick={() => pickWh(warehouse)} aria-label="Remove store filter">{FLOW.find((f) => f.code === warehouse)?.label}<X size={13} /></button> : null}
            </div>
          ) : null} />}
        rows={data?.rows}
        rowHref={(r) => docLink(r)}
        empty="No stock movements match"
        columns={[
          { key: 'when', header: 'When', render: (r) => <span className="nowrap secondary">{dateTime(r.createdAt)}</span> },
          { key: 'doc', header: 'Document', render: (r) => <Two a={r.refNo || '—'} b={REF_LABEL[r.refType] || r.refType} /> },
          { key: 'item', header: 'Item', render: (r) => <Two a={r.itemName} b={r.itemCode} /> },
          { key: 'wh', header: 'Warehouse', render: (r) => <span className="secondary nowrap">{r.warehouseName}</span> },
          { key: 'lot', header: 'Lot', render: (r) => (r.lotNo ? <span className="chip">{r.lotNo}</span> : <span className="muted">—</span>) },
          { key: 'qty', header: 'Qty', align: 'right', render: (r) => <span className={'strong nowrap ' + (r.qty >= 0 ? 'f-success' : 'f-danger')}>{r.qty >= 0 ? '+' : '−'}{num(Math.abs(r.qty), 3)} {r.uom}</span> },
          { key: 'value', header: 'Value', align: 'right', render: (r) => <span className="nowrap">{r.value < 0 ? '−' : ''}{inr(Math.abs(r.value))}</span> },
          { key: 'user', header: 'User', render: (r) => <span className="secondary nowrap">{r.userName || '—'}</span> },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="movements" /> : null}
      />
    </>
  );
}
