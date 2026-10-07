'use client';
// Item lines for POs and SOs: item, qty, rate, GST, amount — with lazy item loading and inline add-new.
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inr, num } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Button } from './ui';
import { QuickItem, type QuickItemResult } from './QuickCreate';

export interface Line { itemId: string; qty: string; rate: string; taxPct: string }
export interface ItemOption { id: number; code: string; name: string; uom: string; salePrice: number; stdCost: number; taxPct: number }

export const emptyLine = (): Line => ({ itemId: '', qty: '', rate: '', taxPct: '18' });

export function totals(lines: Line[]) {
  let sub = 0, tax = 0;
  for (const l of lines) {
    const a = (Number(l.qty) || 0) * (Number(l.rate) || 0);
    sub += a; tax += (a * (Number(l.taxPct) || 0)) / 100;
  }
  return { sub, tax, total: sub + tax };
}

interface LinesEditorProps {
  lines: Line[];
  onChange: (l: Line[]) => void;
  items?: ItemOption[];
  itemApiPath?: string;
  itemFilter?: string;
  canAddItem?: boolean;
  priceField?: 'salePrice' | 'stdCost';
}

export function LinesEditor({ lines, onChange, items, itemApiPath, itemFilter, canAddItem, priceField = 'salePrice' }: LinesEditorProps) {
  const [wantItems, setWantItems] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [freshItems, setFreshItems] = useState<ItemOption[]>([]);

  // Lazy: only load when user first focuses an item cell (no bulk load on mount)
  const apiKey = wantItems && itemApiPath
    ? `${itemApiPath}?pageSize=200${itemFilter ? '&' + itemFilter : ''}`
    : null;
  const { data: loadedItems } = useApi<any>(apiKey);

  const allItems: ItemOption[] = useMemo(() => {
    const base: ItemOption[] = items || loadedItems?.rows || [];
    if (!freshItems.length) return base;
    const ids = new Set(base.map(x => x.id));
    return [...freshItems.filter(x => !ids.has(x.id)), ...base];
  }, [items, loadedItems, freshItems]);

  const set = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => j === i ? { ...l, ...patch } : l));

  const pick = (i: number, id: string, item?: ItemOption) => {
    const it = item || allItems.find(x => String(x.id) === id);
    set(i, { itemId: id, rate: it ? String(it[priceField] || '') : '', taxPct: it ? String(it.taxPct) : '18' });
  };

  const onItemCreated = (r: QuickItemResult) => {
    const fresh: ItemOption = { id: Number(r.id), code: String(r.label).split(' · ')[0], name: String(r.label).split(' · ')[1] || '', uom: r.uom, stdCost: r.stdCost, salePrice: r.salePrice, taxPct: r.taxPct };
    setFreshItems(prev => [fresh, ...prev]);
    const firstEmpty = lines.findIndex(l => !l.itemId);
    if (firstEmpty >= 0) pick(firstEmpty, String(r.id), fresh);
  };

  const t = totals(lines);

  return (
    <>
      <div className="card lines-table">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Item</th>
                <th className="r">Qty</th>
                <th>Unit</th>
                <th className="r">Rate (₹)</th>
                <th className="r">GST %</th>
                <th className="r">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const it = allItems.find(x => String(x.id) === l.itemId);
                return (
                  <tr key={i}>
                    <td>
                      <select
                        className="select"
                        aria-label={`Item for line ${i + 1}`}
                        value={l.itemId}
                        onFocus={() => { if (!items) setWantItems(true); }}
                        onChange={e => pick(i, e.target.value)}
                      >
                        <option value="">Choose an item…</option>
                        {allItems.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
                      </select>
                    </td>
                    <td className="r">
                      <input className="input num" style={{ width: 110, textAlign: 'right' }} aria-label="Quantity"
                        type="number" min={0} step="any" value={l.qty}
                        onChange={e => set(i, { qty: e.target.value })} />
                    </td>
                    <td className="muted">{it?.uom || '—'}</td>
                    <td className="r">
                      <input className="input num" style={{ width: 120, textAlign: 'right' }} aria-label="Rate"
                        type="number" min={0} step="any" value={l.rate}
                        onChange={e => set(i, { rate: e.target.value })} />
                    </td>
                    <td className="r">
                      <input className="input num" style={{ width: 80, textAlign: 'right' }} aria-label="GST percent"
                        type="number" min={0} max={40} step="any" value={l.taxPct}
                        onChange={e => set(i, { taxPct: e.target.value })} />
                    </td>
                    <td className="r num strong">{inr((Number(l.qty) || 0) * (Number(l.rate) || 0))}</td>
                    <td className="r">
                      <button type="button" className="icon-btn" aria-label="Remove line"
                        disabled={lines.length === 1}
                        onClick={() => onChange(lines.filter((_, j) => j !== i))}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tfoot" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="button" size="sm" icon={Plus} onClick={() => onChange([...lines, emptyLine()])}>Add line</Button>
            {canAddItem && (
              <Button type="button" size="sm" icon={Plus} onClick={() => setShowAddItem(true)}>New item</Button>
            )}
          </div>
          <div style={{ minWidth: 260 }}>
            <div className="row between"><span>Subtotal</span><span className="num">{inr(t.sub, 2)}</span></div>
            <div className="row between"><span>GST</span><span className="num">{inr(t.tax, 2)}</span></div>
            <div className="row between strong" style={{ color: 'var(--text-primary)', fontSize: 15, marginTop: 4 }}>
              <span>Total</span><span className="num">{inr(t.total, 2)}</span>
            </div>
            <div className="text-xs">{num(lines.filter(l => l.itemId).length)} item lines</div>
          </div>
        </div>
      </div>
      {canAddItem && (
        <QuickItem open={showAddItem} defaultType={itemFilter?.includes('FG') ? 'FG' : itemFilter?.includes('SERVICE') ? 'SERVICE' : 'RM'} onClose={() => setShowAddItem(false)} onCreated={onItemCreated} />
      )}
    </>
  );
}
