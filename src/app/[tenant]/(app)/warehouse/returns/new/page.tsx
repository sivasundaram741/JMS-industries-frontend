'use client';
// New stock return: choose where stock comes back from and goes to, tick the lots being returned with quantity and
// condition, then save a draft or send it (stock leaves the source and waits In transit).
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Save, Send, Search } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useDebounced, useTenantHref } from '@/lib/hooks';
import { date, inr, num, todayIso } from '@/lib/format';
import { Alert, Button, Card, KeyValue, Loading, PageHeader, SelectField, TextAreaField, TextField, useToast } from '@/components/ui';

const LOCATIONS = [{ value: 'WIP', label: 'WIP · Shop floor' }, { value: 'FG', label: 'FG Store · Main Hub' }, { value: 'RM', label: 'RM Store · Main Hub' }, { value: 'QC', label: 'QC Hold' }];
const CONDITIONS = ['Resaleable', 'Damaged', 'Expired'];
interface Lot { itemId: number; itemCode: string; itemName: string; uom: string; stdCost: number; warehouse: string; lotNo: string | null; qty: number; firstAt: string }
type Pick = { qty: string; reason: string; condition: string };

export default function NewStockReturnPage() {
  const { user } = useAuth();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const toast = useToast();
  const { data: sum } = useApi<{ reasons: string[] }>('/stock-returns/summary');
  const reasons = sum?.reasons || [];
  const [f, setF] = useState({ fromWarehouse: 'WIP', toWarehouse: 'RM', returnDate: todayIso(), reason: '', requestedBy: user?.name || '', vehicleNo: '', challanNo: '', notes: '' });
  const [q, setQ] = useState('');
  const term = useDebounced(q, 250);
  const { data: lots, isLoading } = useApi<Lot[]>(`/stock/lots?warehouse=${f.fromWarehouse}${term ? '&search=' + encodeURIComponent(term) : ''}`);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [busy, setBusy] = useState<'' | 'draft' | 'send'>('');
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { if (reasons.length && !f.reason) setF((x) => ({ ...x, reason: reasons[0] })); }, [reasons]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (user && !f.requestedBy) setF((x) => ({ ...x, requestedBy: user.name })); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const key = (l: Lot) => `${l.itemId}|${l.lotNo || ''}`;
  const lotByKey = useMemo(() => Object.fromEntries((lots || []).map((l) => [key(l), l])), [lots]);
  const chosen = Object.entries(picks).filter(([k, p]) => lotByKey[k] && Number(p.qty) > 0);
  const over = chosen.filter(([k, p]) => Number(p.qty) > lotByKey[k].qty + 0.0005);
  const units = chosen.reduce((a, [, p]) => a + Number(p.qty), 0);
  const value = chosen.reduce((a, [k, p]) => a + Number(p.qty) * lotByKey[k].stdCost, 0);

  function changeFrom(v: string) {
    setPicks({});
    setF((x) => ({ ...x, fromWarehouse: v, toWarehouse: x.toWarehouse === v ? (v === 'RM' ? 'QC' : 'RM') : x.toWarehouse }));
  }
  const toggle = (l: Lot, on: boolean) => setPicks((p) => {
    const next = { ...p };
    if (on) next[key(l)] = { qty: String(l.qty), reason: '', condition: 'Resaleable' }; else delete next[key(l)];
    return next;
  });
  const upd = (k: string, patch: Partial<Pick>) => setPicks((p) => ({ ...p, [k]: { ...p[k], ...patch } }));

  async function save(send: boolean) {
    setBusy(send ? 'send' : 'draft');
    try {
      const r = await post('/stock-returns', {
        fromWarehouse: f.fromWarehouse, toWarehouse: f.toWarehouse, returnDate: f.returnDate || undefined, reason: f.reason, requestedBy: f.requestedBy.trim() || null,
        vehicleNo: f.vehicleNo.trim() || null, challanNo: f.challanNo.trim() || null, notes: f.notes.trim() || null, send,
        lines: chosen.map(([k, p]) => ({ itemId: lotByKey[k].itemId, lotNo: lotByKey[k].lotNo, qty: Number(p.qty), reason: p.reason || null, condition: p.condition })),
      });
      toast.ok(send ? `${r.number} sent · stock is in transit` : `${r.number} saved as draft`);
      router.push(tenantHref(`/warehouse/returns/${r.id}`));
    } catch (e) { toast.err(e); setBusy(''); }
  }
  const ready = !!f.reason && f.fromWarehouse !== f.toWarehouse && chosen.length > 0 && !over.length && !busy;

  return (
    <>
      <PageHeader back="/warehouse/returns"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Warehouse' }, { label: 'Stock Returns', href: '/warehouse/returns' }, { label: 'New' }]}
        title="New stock return" sub="Tick the lots going back · damaged or expired goods land in QC Hold when received"
        actions={<>
          <Button onClick={() => router.push(tenantHref('/warehouse/returns'))}>Cancel</Button>
          <Button icon={Save} loading={busy === 'draft'} disabled={!ready} onClick={() => save(false)}>Save draft</Button>
          <Button variant="primary" icon={Send} loading={busy === 'send'} disabled={!ready} onClick={() => save(true)}>Send now</Button>
        </>} />

      <div className="grid main-side">
        <Card title="Return details">
          <div className="form c3">
            <SelectField label="From" value={f.fromWarehouse} onChange={changeFrom} options={LOCATIONS} />
            <SelectField label="To" value={f.toWarehouse} onChange={set('toWarehouse')} options={LOCATIONS.filter((l) => l.value !== f.fromWarehouse)} />
            <TextField label="Return date" type="date" value={f.returnDate} onChange={set('returnDate')} />
            <SelectField label="Reason" value={f.reason} onChange={set('reason')} options={reasons.map((r) => ({ value: r, label: r }))} />
            <TextField label="Requested by" value={f.requestedBy} onChange={set('requestedBy')} />
            <div />
            <TextField label="Vehicle no (optional)" value={f.vehicleNo} onChange={(v) => set('vehicleNo')(v.toUpperCase())} placeholder="TN 70 C 8812" />
            <TextField label="Challan no (optional)" value={f.challanNo} onChange={set('challanNo')} />
            <div />
            <TextAreaField className="full" label="Notes" value={f.notes} onChange={set('notes')} rows={2} placeholder="e.g. excess issued to WO-7731, returned after the run" />
          </div>
        </Card>
        <Card title="Return summary">
          <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="chip">{LOCATIONS.find((l) => l.value === f.fromWarehouse)?.label}</span><ArrowRight size={14} className="muted" /><span className="chip">In transit</span><ArrowRight size={14} className="muted" /><span className="chip">{LOCATIONS.find((l) => l.value === f.toWarehouse)?.label}</span>
          </div>
          <KeyValue cols={1} items={[
            ['Lots selected', `${chosen.length}${lots ? ` of ${lots.length}` : ''}`],
            ['Units', num(units, 3)],
            ['Value at standard cost', inr(value)],
            ['Damaged / expired to QC', num(chosen.filter(([, p]) => p.condition !== 'Resaleable').reduce((a, [, p]) => a + Number(p.qty), 0), 3)],
          ]} />
        </Card>
      </div>

      {over.length ? <Alert tone="danger" title="More than is in the lot">{over.map(([k, p]) => `${lotByKey[k].itemCode} ${lotByKey[k].lotNo || ''}: ${num(Number(p.qty))} entered, ${num(lotByKey[k].qty)} in stock`).join(' · ')}</Alert> : null}

      <div className="card lines-table">
        <div className="toolbar">
          <div><div className="tt">Stock in {LOCATIONS.find((l) => l.value === f.fromWarehouse)?.label}</div><div className="ts">Oldest lot first · tick every lot being returned</div></div>
          <label className="tsearch"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item or lot…" aria-label="Search item or lot" /></label>
          <div className="spacer" /><span className="text-sm muted">{chosen.length} selected</span>
        </div>
        {isLoading && !lots ? <div className="card-body"><Loading rows={4} /></div> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th style={{ width: 36 }} /><th>Item</th><th>Lot</th><th>Since</th><th className="r">In stock</th><th className="r">Return qty</th><th>Condition</th><th>Line reason</th></tr></thead>
              <tbody>
                {(lots || []).map((l) => {
                  const p = picks[key(l)];
                  return (
                    <tr key={key(l)} style={{ opacity: p ? 1 : 0.8 }}>
                      <td><input type="checkbox" checked={!!p} onChange={(e) => toggle(l, e.target.checked)} aria-label={`Return ${l.itemCode} ${l.lotNo || ''}`} style={{ width: 16, height: 16 }} /></td>
                      <td><div className="strong">{l.itemName}</div><div className="text-xs muted">{l.itemCode}</div></td>
                      <td className="num">{l.lotNo || <span className="muted">No lot</span>}</td>
                      <td className="secondary nowrap">{date(l.firstAt)}</td>
                      <td className="r num">{num(l.qty, 3)} {l.uom}</td>
                      <td className="r"><input className="input num" style={{ width: 100, textAlign: 'right' }} type="number" min={0} step="any" disabled={!p} value={p?.qty || ''} onChange={(e) => upd(key(l), { qty: e.target.value })} aria-label="Return quantity" /></td>
                      <td>
                        <select className="select" style={{ width: 130 }} disabled={!p} value={p?.condition || 'Resaleable'} onChange={(e) => upd(key(l), { condition: e.target.value })} aria-label="Condition">
                          {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="select" style={{ width: 170 }} disabled={!p} value={p?.reason || ''} onChange={(e) => upd(key(l), { reason: e.target.value })} aria-label="Line reason">
                          <option value="">Same as the return</option>
                          {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lots && !lots.length ? <div className="empty text-sm">No stock in this location{term ? ' matches' : ''}</div> : null}
          </div>
        )}
      </div>
    </>
  );
}
