'use client';
// Who supplies each line of a product's plan or a job: the right-click / ⋯ menu choices, the chip on the row, and a
// "suppliers for this" summary grouped by supplier — so it reads as "welding to A, grinding to B, O-rings from C".
import { Factory, ExternalLink, ShoppingCart, Trash2, Truck, Warehouse } from 'lucide-react';
import type { MenuSection } from './ui/ContextMenu';
import { TenantLink as Link } from './ui/TenantLink';

export interface Vendor { id: number; name: string; city?: string | null; isSubcontractor?: boolean }

const vendorOptions = (vendors: Vendor[], jobWorkersFirst: boolean) =>
  [...vendors]
    .sort((a, b) => (jobWorkersFirst ? Number(!!b.isSubcontractor) - Number(!!a.isSubcontractor) : 0) || a.name.localeCompare(b.name))
    .map((v) => ({ value: v.id, label: v.name, sub: [v.isSubcontractor ? 'Job worker' : 'Supplier', v.city].filter(Boolean).join(' · ') }));

/** Menu for a material / component line. */
export function materialMenu(o: {
  source: string; vendorId?: number | null; vendorName?: string | null; vendors: Vendor[]; editable: boolean;
  orderNo?: string | null; orderHref?: string | null; onStore: () => void; onBuy: (vendorId: number) => void; onRemove?: () => void; onOpenOrder?: () => void;
}): MenuSection[] {
  const locked = !o.editable || !!o.orderNo;
  return [
    {
      title: 'Where it comes from',
      items: [
        { key: 'stock', label: 'Issue from our store', icon: Warehouse, checked: o.source !== 'buy', disabled: locked, onSelect: o.onStore },
        {
          key: 'buy', label: o.source === 'buy' ? 'Bought from' : 'Buy from a supplier…', icon: ShoppingCart, checked: o.source === 'buy', hint: o.source === 'buy' ? o.vendorName || undefined : undefined, disabled: locked,
          pick: { title: 'Buy it from', placeholder: 'Search suppliers…', options: vendorOptions(o.vendors, false), current: o.vendorId ?? null, empty: 'No suppliers yet · add them under Masters → Vendors', onPick: (v) => o.onBuy(Number(v)) },
        },
      ],
    },
    { items: [
      ...(o.orderNo && o.onOpenOrder ? [{ key: 'order', label: `Open ${o.orderNo}`, icon: ExternalLink, onSelect: o.onOpenOrder }] : []),
      ...(o.onRemove && o.editable ? [{ key: 'remove', label: 'Remove from the plan', icon: Trash2, danger: true, onSelect: o.onRemove }] : []),
    ] },
  ];
}

/** Menu for an operation line. */
export function operationMenu(o: {
  doneBy: string; vendorId?: number | null; vendorName?: string | null; vendors: Vendor[]; editable: boolean;
  orderNo?: string | null; onInhouse: () => void; onOutside: (vendorId: number) => void; onRemove?: () => void; onOpenOrder?: () => void;
}): MenuSection[] {
  const locked = !o.editable || !!o.orderNo;
  return [
    {
      title: 'Who does it',
      items: [
        { key: 'inhouse', label: 'Do it in our shop', icon: Factory, checked: o.doneBy !== 'outside', disabled: locked, onSelect: o.onInhouse },
        {
          key: 'outside', label: o.doneBy === 'outside' ? 'Sent outside to' : 'Send outside to a supplier…', icon: Truck, checked: o.doneBy === 'outside', hint: o.doneBy === 'outside' ? o.vendorName || undefined : undefined, disabled: locked,
          pick: { title: 'Send it to', placeholder: 'Search job workers and suppliers…', options: vendorOptions(o.vendors, true), current: o.vendorId ?? null, empty: 'No suppliers yet · add them under Masters → Vendors', onPick: (v) => o.onOutside(Number(v)) },
        },
      ],
    },
    { items: [
      ...(o.orderNo && o.onOpenOrder ? [{ key: 'order', label: `Open ${o.orderNo}`, icon: ExternalLink, onSelect: o.onOpenOrder }] : []),
      ...(o.onRemove && o.editable ? [{ key: 'remove', label: 'Remove from the plan', icon: Trash2, danger: true, onSelect: o.onRemove }] : []),
    ] },
  ];
}

/** The chip on a row: "Our store" / "Buy · Parker Seals" / "Outside · Sri Durga". Clicking it opens the menu. */
export function SupplierChip({ kind, name, orderNo, orderHref, onClick }: { kind: 'stock' | 'buy' | 'inhouse' | 'outside'; name?: string | null; orderNo?: string | null; orderHref?: string | null; onClick?: (e: React.MouseEvent) => void }) {
  const ours = kind === 'stock' || kind === 'inhouse';
  const chip = (
    <span role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} className={'supplier ' + (ours ? 'ours' : kind === 'buy' ? 'buy' : 'out')} onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(e as any); } }}
      title={ours ? undefined : `${kind === 'buy' ? 'Bought from' : 'Done by'} ${name || 'a supplier'}`}>
      {ours ? (kind === 'stock' ? <Warehouse size={13} /> : <Factory size={13} />) : kind === 'buy' ? <ShoppingCart size={13} /> : <Truck size={13} />}
      <span className="truncate">{ours ? (kind === 'stock' ? 'Our store' : 'Our shop') : name || 'Choose a supplier'}</span>
    </span>
  );
  return (
    <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      {chip}
      {orderNo ? (orderHref ? <Link href={orderHref} className="text-xs strong" onClick={(e) => e.stopPropagation()}>{orderNo}</Link> : <span className="text-xs strong">{orderNo}</span>) : null}
    </span>
  );
}

/** Lines grouped by supplier: who supplies what for this product or job. */
export function SuppliersSummary({ lines, empty }: { lines: Array<{ vendorName?: string | null; kind: 'buy' | 'outside'; what: string; orderNo?: string | null; orderHref?: string | null; orderStatus?: string | null }>; empty?: React.ReactNode }) {
  const groups = new Map<string, typeof lines>();
  for (const l of lines) { const k = l.vendorName || 'Supplier not chosen'; groups.set(k, [...(groups.get(k) || []), l]); }
  if (!groups.size) return <div className="text-sm muted">{empty || 'Everything is made in our shop from our own store.'}</div>;
  return (
    <div className="supplier-groups">
      {[...groups.entries()].map(([name, ls]) => (
        <div key={name} className="supplier-group">
          <div className="sg-name">{name}</div>
          {ls.map((l, i) => (
            <div key={i} className="sg-line">
              {l.kind === 'buy' ? <ShoppingCart size={14} className="f-info" /> : <Truck size={14} className="f-teal" />}
              <span className="truncate" style={{ flex: 1 }}>{l.kind === 'buy' ? 'Buys' : 'Does'} {l.what}</span>
              {l.orderNo ? (l.orderHref ? <Link href={l.orderHref} className="text-xs strong">{l.orderNo}{l.orderStatus ? ` · ${l.orderStatus.toLowerCase()}` : ''}</Link> : <span className="text-xs">{l.orderNo}</span>) : <span className="text-xs muted">not ordered yet</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
