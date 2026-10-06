'use client';
// Item lines for customer orders and purchase orders: item, quantity, rate, GST and amount, with totals
import { Plus, Trash2 } from 'lucide-react';
import { inr, num } from '@/lib/format';
import { Button } from './ui';

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

export function LinesEditor({ lines, onChange, items, priceField = 'salePrice' }: { lines: Line[]; onChange: (l: Line[]) => void; items: ItemOption[]; priceField?: 'salePrice' | 'stdCost' }) {
  const set = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pick = (i: number, id: string) => {
    const it = items.find((x) => String(x.id) === id);
    set(i, { itemId: id, rate: it ? String(it[priceField] || '') : '', taxPct: it ? String(it.taxPct) : '18' });
  };
  const t = totals(lines);
  return (
    <div className="card lines-table">
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th style={{ width: '40%' }}>Item</th><th className="r">Qty</th><th>Unit</th><th className="r">Rate (₹)</th><th className="r">GST %</th><th className="r">Amount</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const it = items.find((x) => String(x.id) === l.itemId);
              return (
                <tr key={i}>
                  <td>
                    <select className="select" aria-label={`Item for line ${i + 1}`} value={l.itemId} onChange={(e) => pick(i, e.target.value)}>
                      <option value="">Choose an item…</option>
                      {items.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
                    </select>
                  </td>
                  <td className="r"><input className="input num" style={{ width: 110, textAlign: 'right' }} aria-label="Quantity" type="number" min={0} step="any" value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} /></td>
                  <td className="muted">{it?.uom || '—'}</td>
                  <td className="r"><input className="input num" style={{ width: 120, textAlign: 'right' }} aria-label="Rate" type="number" min={0} step="any" value={l.rate} onChange={(e) => set(i, { rate: e.target.value })} /></td>
                  <td className="r"><input className="input num" style={{ width: 80, textAlign: 'right' }} aria-label="GST percent" type="number" min={0} max={40} step="any" value={l.taxPct} onChange={(e) => set(i, { taxPct: e.target.value })} /></td>
                  <td className="r num strong">{inr((Number(l.qty) || 0) * (Number(l.rate) || 0))}</td>
                  <td className="r"><button type="button" className="icon-btn" aria-label="Remove line" disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, j) => j !== i))}><Trash2 size={16} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tfoot" style={{ alignItems: 'flex-start' }}>
        <Button type="button" size="sm" icon={Plus} onClick={() => onChange([...lines, emptyLine()])}>Add line</Button>
        <div style={{ minWidth: 260 }}>
          <div className="row between"><span>Subtotal</span><span className="num">{inr(t.sub, 2)}</span></div>
          <div className="row between"><span>GST</span><span className="num">{inr(t.tax, 2)}</span></div>
          <div className="row between strong" style={{ color: 'var(--text-primary)', fontSize: 15, marginTop: 4 }}><span>Total</span><span className="num">{inr(t.total, 2)}</span></div>
          <div className="text-xs">{num(lines.filter((l) => l.itemId).length)} item lines</div>
        </div>
      </div>
    </div>
  );
}
