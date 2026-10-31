'use client';
// Stock Ledger: every movement of stock traced to the document, lot and person behind it.
// An opening balance or a stock adjustment shows up here the moment it is posted.
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, BellRing, Boxes, ChevronRight, Factory, PackageCheck, ShieldCheck, Warehouse, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState, useTenantHref } from '@/lib/hooks';
import { dateTime, inr, inrShort, num } from '@/lib/format';
import { hrefFor } from '@/lib/links';
import type { Tone } from '@/lib/status';
import { Card, DataTable, ErrorBox, IconTile, Kpi, ListToolbar, Loading, PageHeader, Pagination, Two } from '@/components/ui';

const REF_FILTERS = [
  { key: '', label: 'All' }, { key: 'GRN', label: 'Goods receipt' }, { key: 'QC_ACCEPT', label: 'QC accepted' }, { key: 'ISSUE', label: 'Issued to WO' },
  { key: 'PRODUCTION', label: 'Production' }, { key: 'FG_RECEIPT', label: 'FG receipt' },
  { key: 'OPENING', label: 'Opening balance' }, { key: 'ADJUST', label: 'Adjustments' }, { key: 'SCRAP,RETURN,CONSUME', label: 'Consumed & scrap' },
];

const REF_LABEL: Record<string, string> = {
  OPENING: 'Opening balance', GRN: 'Goods receipt', QC_ACCEPT: 'QC accepted', ISSUE: 'Issued to work order', PRODUCTION: 'Production to QC',
  FG_RECEIPT: 'FG receipt', ADJUST: 'Stock adjustment', SCRAP: 'Scrapped', RETURN: 'Returned to vendor', CONSUME: 'Consumed in WIP',
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

export default function StockLedgerPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const sp = useSearchParams();
  const itemId = sp.get('itemId') || '';
  const L = useListState({ pageSize: 25 });
  const [refType, setRefType] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const { data: sum } = useApi<Summary>('/stock/summary');
  const { data, error, isLoading } = useApi<Page<any>>('/stock/ledger' + qs({ search: L.params.search, page: L.params.page, pageSize: L.params.pageSize, refType, warehouse, itemId }));
  const canItems = ['masters', 'inventory', 'purchase', 'wo'].some((m) => can(m));
  const { data: item } = useApi<any>(itemId && canItems ? `/items/${itemId}` : null, { shouldRetryOnError: false });
  const itemName = item?.name || data?.rows?.[0]?.itemName || 'Item ' + itemId;

  const pickRef = (v: string) => { setRefType(v); L.setPage(1); };
  const pickWh = (v: string) => { setWarehouse((w) => (w === v ? '' : v)); L.setPage(1); };

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Store' }, { label: 'Stock Ledger' }]}
        title="Stock Ledger"
        sub="Every movement of stock and where it came from — opening balances, goods received, issues to work orders and adjustments"
      />
      {sum ? (
        <>
          <div className="row" style={{ gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
            <span><span className="muted">Stock value</span> <span className="strong">{inrShort(sum.stockValue)}</span></span>
            {FLOW.map((f) => (
              <button key={f.code} type="button" onClick={() => pickWh(f.code)} aria-pressed={warehouse === f.code}
                className={warehouse === f.code ? 'chip t-info' : 'chip'} style={{ cursor: 'pointer', border: 0 }}>
                {f.label} {inrShort(sum.byWarehouse[f.code] || 0)}
              </button>
            ))}
          </div>
        </>
      ) : <Card><Loading rows={3} /></Card>}

      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar title="Stock ledger" search={L.search} onSearch={L.setSearch} placeholder="Search item, document, lot…" chips={{ options: REF_FILTERS, value: refType, onChange: pickRef }}
          right={(itemId || warehouse) ? (
            <div className="row" style={{ gap: 6 }}>
              {itemId ? <button type="button" className="chip t-info" style={{ border: 0, cursor: 'pointer', gap: 4, height: 28 }} onClick={() => router.replace(tenantHref('/warehouse/ledger'))} aria-label={`Remove filter ${itemName}`}>{itemName}<X size={13} /></button> : null}
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
