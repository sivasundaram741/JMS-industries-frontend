'use client';
// Warehouse · Barcode Generator: Code 128 labels for items and heat / lot numbers — from stock, from a goods receipt,
// or any item — with price and lot under the barcode. Prints on label rolls or A4 sheets (Print → Save as PDF).
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Printer, RotateCcw, Search } from 'lucide-react';
import { api, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useDebounced } from '@/lib/hooks';
import { dateShort, inr, num } from '@/lib/format';
import { Code128, clean128 } from '@/lib/code128';
import { Alert, Button, Card, Checkbox, EmptyState, Loading, PageHeader, Segmented, SelectField, Tabs } from '@/components/ui';

interface Row { key: string; itemId: number; itemCode: string; itemName: string; lotNo: string | null; price: number | null; stock?: number; uom?: string; where?: string }
const SIZES = [{ value: '38x25', label: '38 × 25 mm' }, { value: '50x25', label: '50 × 25 mm' }, { value: '50x38', label: '50 × 38 mm' }, { value: '100x50', label: '100 × 50 mm' }];
type Source = 'Stock lots' | 'Goods receipt' | 'Items';

const PRINT_CSS = `@media print {
  @page { margin: 6mm; }
  body * { visibility: hidden !important; }
  .label-sheet, .label-sheet * { visibility: visible !important; }
  .label-sheet { position: absolute; left: 0; top: 0; padding: 0 !important; background: #fff !important; border: 0 !important; }
  .label-sheet .label { border: 0.2mm solid #d0d5dd !important; break-inside: avoid; }
}`;

export default function BarcodesPage() {
  const { user, can } = useAuth();
  const [source, setSource] = useState<Source>('Stock lots');
  const [q, setQ] = useState('');
  const term = useDebounced(q, 250);
  const [grnId, setGrnId] = useState('');
  const { data: lots, isLoading: lotsLoading } = useApi<any[]>(source === 'Stock lots' && can('batches') ? `/stock/lots${term ? '?search=' + encodeURIComponent(term) : ''}` : null);
  const { data: items, isLoading: itemsLoading } = useApi<Page<any>>(`/items?pageSize=200${term ? '&search=' + encodeURIComponent(term) : ''}`);
  const { data: grns } = useApi<Page<any>>(source === 'Goods receipt' && can('stockentry') ? '/grns?pageSize=30' : null);
  const [grnLines, setGrnLines] = useState<any[] | null>(null);
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [rowsCache, setRowsCache] = useState<Record<string, Row>>({});
  const [cfg, setCfg] = useState({ size: '38x25', perRow: 3, content: 'code+lot' as 'code' | 'code+lot', showPrice: true, showLot: true, showName: true });

  useEffect(() => {
    if (!grnId) { setGrnLines(null); return; }
    api<any>(`/grns/${grnId}`).then((g) => setGrnLines(g.lines.map((l: any) => ({ ...l, grnNumber: g.number })))).catch(() => setGrnLines([]));
  }, [grnId]);

  const priceOf = useMemo(() => Object.fromEntries((items?.rows || []).map((i: any) => [i.id, i.salePrice || null])), [items]);
  const rows: Row[] = useMemo(() => {
    if (source === 'Items') return (items?.rows || []).filter((i: any) => i.isStocked !== false).map((i: any) => ({ key: `${i.id}|`, itemId: i.id, itemCode: i.code, itemName: i.name, lotNo: null, price: i.salePrice || null, uom: i.uom }));
    if (source === 'Goods receipt') return (grnLines || []).map((l: any) => ({ key: `${l.itemId}|${l.lotNo || ''}`, itemId: l.itemId, itemCode: l.itemCode, itemName: l.itemName, lotNo: l.lotNo, price: priceOf[l.itemId] ?? null, stock: l.qty, uom: l.uom, where: l.grnNumber }));
    return (lots || []).map((l: any) => ({ key: `${l.itemId}|${l.lotNo || ''}`, itemId: l.itemId, itemCode: l.itemCode, itemName: l.itemName, lotNo: l.lotNo, price: priceOf[l.itemId] ?? null, stock: l.qty, uom: l.uom, where: `${l.warehouse} · since ${dateShort(l.firstAt)}` }));
  }, [source, items, lots, grnLines, priceOf]);

  // Keep every row that has copies, even after the search or source changes
  useEffect(() => { setRowsCache((c) => ({ ...c, ...Object.fromEntries(rows.map((r) => [r.key, r])) })); }, [rows]);
  const setCopy = (r: Row, n: number) => setCopies((c) => ({ ...c, [r.key]: Math.max(0, Math.min(500, Math.round(n) || 0)) }));

  const selected = Object.entries(copies).filter(([k, n]) => n > 0 && rowsCache[k]).map(([k, n]) => ({ row: rowsCache[k], n }));
  const labels = selected.flatMap(({ row, n }) => Array.from({ length: n }, () => row));
  const total = labels.length;
  const [w, h] = cfg.size.split('x').map(Number);
  const payload = (r: Row) => clean128(cfg.content === 'code+lot' && r.lotNo ? `${r.itemCode}/${r.lotNo}` : r.itemCode);
  const loading = source === 'Items' ? itemsLoading : source === 'Stock lots' ? lotsLoading : false;

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Warehouse' }, { label: 'Barcode Generator' }]} title="Barcode Generator"
        sub="Print item labels with barcode, price and heat / lot no — for new stock entries or any item"
        actions={<>
          <Button icon={RotateCcw} disabled={!total} onClick={() => setCopies({})}>Clear</Button>
          <Button variant="primary" icon={Printer} disabled={!total} onClick={() => window.print()}>Print {total || ''} label{total === 1 ? '' : 's'}</Button>
        </>} />

      <div className="grid main-side">
        <div className="card">
          <div className="toolbar">
            <div><div className="tt">Items to label</div><div className="ts">Set the number of copies · the barcode reads back as the item code{cfg.content === 'code+lot' ? ' / lot' : ''}</div></div>
            <div className="spacer" />
            <Segmented options={['Stock lots', 'Goods receipt', 'Items'] as const} value={source} onChange={(v) => { setSource(v); setQ(''); }} />
          </div>
          <div className="toolbar" style={{ borderTop: 0, paddingTop: 0 }}>
            {source === 'Goods receipt' ? (
              <select className="select" style={{ maxWidth: 360 }} value={grnId} onChange={(e) => setGrnId(e.target.value)} aria-label="Goods receipt">
                <option value="">Choose a goods receipt…</option>
                {(grns?.rows || []).map((g: any) => <option key={g.id} value={g.id}>{g.number} · {g.vendorName} · {dateShort(g.receivedDate)}</option>)}
              </select>
            ) : (
              <label className="tsearch"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item or batch…" aria-label="Search item or batch" /></label>
            )}
            {source === 'Goods receipt' && grnLines?.length ? <Button size="sm" onClick={() => grnLines.forEach((l: any) => setCopy({ key: `${l.itemId}|${l.lotNo || ''}` } as Row, 1))}>1 label per line</Button> : null}
          </div>
          {source === 'Stock lots' && !can('batches') ? <div className="card-body"><Alert tone="info" title="Your role cannot see lot stock">Use Items instead.</Alert></div> : null}
          {loading && !rows.length ? <div className="card-body"><Loading rows={5} /></div> : (
            <div className="table-wrap" style={{ maxHeight: 560, overflow: 'auto' }}>
              <table className="tbl">
                <thead><tr><th>Item</th><th>Heat / lot no</th><th className="r">Price</th><th className="r">{source === 'Items' ? 'Unit' : 'Qty'}</th><th className="r" style={{ width: 150 }}>Copies</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const n = copies[r.key] || 0;
                    return (
                      <tr key={r.key} style={{ background: n ? 'var(--bg-sidebar-active)' : undefined }}>
                        <td><div className="strong">{r.itemName}</div><div className="text-xs muted">{r.itemCode}{r.where ? ' · ' + r.where : ''}</div></td>
                        <td className="num">{r.lotNo || <span className="muted">—</span>}</td>
                        <td className="r num">{r.price ? inr(r.price) : <span className="muted">—</span>}</td>
                        <td className="r num">{r.stock !== undefined ? `${num(r.stock, 3)} ${r.uom || ''}` : r.uom}</td>
                        <td className="r">
                          <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} aria-label="One copy less" disabled={!n} onClick={() => setCopy(r, n - 1)}><Minus size={14} /></button>
                            <input className="input num" style={{ width: 56, height: 32, textAlign: 'center', padding: 0 }} type="number" min={0} max={500} value={n} onChange={(e) => setCopy(r, Number(e.target.value))} aria-label={`Copies of ${r.itemCode}`} />
                            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} aria-label="One copy more" onClick={() => setCopy(r, n + 1)}><Plus size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!rows.length && !loading ? <div className="empty text-sm">{source === 'Goods receipt' && !grnId ? 'Choose a goods receipt to label what came in' : 'Nothing matches'}</div> : null}
            </div>
          )}
        </div>

        <Card title="Label settings">
          <div className="form c2">
            <SelectField label="Barcode type" value="c128" onChange={() => undefined} options={[{ value: 'c128', label: 'Code 128' }]} />
            <SelectField label="Label size" value={cfg.size} onChange={(v) => setCfg({ ...cfg, size: v })} options={SIZES} />
            <SelectField label="Labels per row" value={cfg.perRow} onChange={(v) => setCfg({ ...cfg, perRow: Number(v) })} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
            <SelectField label="Barcode holds" value={cfg.content} onChange={(v) => setCfg({ ...cfg, content: v as 'code' | 'code+lot' })} options={[{ value: 'code+lot', label: 'Item code / lot' }, { value: 'code', label: 'Item code only' }]} />
          </div>
          <div className="stack tight" style={{ gap: 8, marginTop: 14 }}>
            <Checkbox label="Show item name" checked={cfg.showName} onChange={(v) => setCfg({ ...cfg, showName: v })} />
            <Checkbox label="Show price (printed under the barcode)" checked={cfg.showPrice} onChange={(v) => setCfg({ ...cfg, showPrice: v })} />
            <Checkbox label="Show heat / lot no (for batch tracking)" checked={cfg.showLot} onChange={(v) => setCfg({ ...cfg, showLot: v })} />
          </div>
          <div className="text-xs muted" style={{ marginTop: 14 }}>Print uses your browser&apos;s print dialog: choose the label printer, or &ldquo;Save as PDF&rdquo;. Set the paper to the label size and margins to none for label rolls.</div>
        </Card>
      </div>

      <Card title="Preview" sub={total ? `${total} label${total === 1 ? '' : 's'} · ${SIZES.find((s) => s.value === cfg.size)?.label}` : 'Set copies on the left to see the labels'}
        right={<Tabs active="c128" items={[{ key: 'c128', label: 'Code 128' }]} />}>
        {total ? (
          <div className="label-sheet" style={{ background: 'var(--bg-muted)', padding: 16, borderRadius: 8, overflow: 'auto' }}>
            <div className="labels" style={{ gridTemplateColumns: `repeat(${cfg.perRow}, ${w}mm)` }}>
              {labels.slice(0, 600).map((r, i) => (
                <div key={i} className="label" style={{ width: `${w}mm`, height: `${h}mm` }}>
                  {cfg.showName ? <div className="ln" title={r.itemName}>{r.itemName}</div> : null}
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '2px 0 1px' }}>
                    <Code128 fill value={payload(r)} height={Math.max(16, Math.round(h * 3.78 - 30 - (cfg.showName ? 12 : 0) - (cfg.showPrice || cfg.showLot ? 11 : 0)))} />
                  </div>
                  <div className="lc">{payload(r)}</div>
                  {cfg.showPrice || cfg.showLot ? <div className="lm">{[cfg.showPrice && r.price ? `Price ${inr(r.price)}` : null, cfg.showLot && r.lotNo ? r.lotNo : null].filter(Boolean).join(' · ') || ' '}</div> : null}
                </div>
              ))}
            </div>
            {labels.length > 600 ? <div className="text-xs muted" style={{ marginTop: 8 }}>Showing the first 600 labels · print in batches</div> : null}
          </div>
        ) : <EmptyState title="No labels yet">Pick items, lots or a goods receipt and set the copies.</EmptyState>}
      </Card>
    </>
  );
}
