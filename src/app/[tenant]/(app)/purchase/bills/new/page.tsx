'use client';
// New purchase bill: pick the vendor and the PO / GRN it is against (lines load from what was received and not yet
// billed), enter the vendor's invoice line by line, then save a draft or post it through the 3-way match.
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleAlert, CircleCheck, Plus, Save, Send, Trash2 } from 'lucide-react';
import { api, post, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useTenantHref } from '@/lib/hooks';
import { addDaysIso, date, inr, num, todayIso } from '@/lib/format';
import { Alert, Button, Card, KeyValue, Loading, PageHeader, SelectField, TextAreaField, TextField, useToast } from '@/components/ui';

interface Line { poLineId: number | null; itemId: string; itemCode?: string; itemName?: string; hsn?: string | null; uom?: string; lotNo: string; qty: string; rate: string; discPct: string; taxPct: string; poRate?: number; open?: number; received?: number }
interface Prefill {
  purchaseOrder: { id: number; number: string; type: string; status: string }; vendor: { id: number; name: string; code: string; gstin: string | null; paymentTermsDays: number };
  grn: { id: number; number: string; vendorInvoiceNo: string | null } | null; grns: Array<{ id: number; number: string; receivedDate: string; vendorInvoiceNo: string | null }>;
  lines: Array<{ poLineId: number; itemId: number; itemCode: string; itemName: string; hsn: string | null; uom: string; lotNo: string | null; qtyOrdered: number; qtyReceived: number; qtyBilled: number; qty: number; rate: number; discPct: number; taxPct: number }>;
}
const blank = (): Line => ({ poLineId: null, itemId: '', lotNo: '', qty: '', rate: '', discPct: '0', taxPct: '18' });
const lineAmt = (l: Line) => {
  const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0);
  const disc = (gross * (Number(l.discPct) || 0)) / 100;
  const taxable = gross - disc;
  return { gross, disc, taxable, tax: (taxable * (Number(l.taxPct) || 0)) / 100 };
};

export default function NewPurchaseBillPage() {
  const { user } = useAuth();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const sp = useSearchParams();
  const toast = useToast();
  const { data: vendors } = useApi<Page<any>>('/vendors?pageSize=200');
  const { data: items } = useApi<Page<any>>('/items?pageSize=200');
  const [f, setF] = useState({ vendorId: '', purchaseOrderId: '', grnId: '', vendorInvoiceNo: '', vendorInvoiceDate: todayIso(), billDate: todayIso(), tdsPct: '0.1', notes: '' });
  const { data: orders } = useApi<any[]>(f.vendorId ? `/purchase-bills/billable-orders?vendorId=${f.vendorId}` : null);
  const [pre, setPre] = useState<Prefill | null>(null);
  const [loadingPre, setLoadingPre] = useState(false);
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [busy, setBusy] = useState<'' | 'draft' | 'post'>('');
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  // Start from ?po= or ?grn= (e.g. "Book bill" on a PO or GRN)
  useEffect(() => {
    const po = sp.get('po'), grn = sp.get('grn');
    if (po || grn) load({ purchaseOrderId: po || undefined, grnId: grn || undefined });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(p: { purchaseOrderId?: string; grnId?: string }) {
    if (!p.purchaseOrderId && !p.grnId) { setPre(null); setLines([blank()]); setF((x) => ({ ...x, purchaseOrderId: '', grnId: '' })); return; }
    setLoadingPre(true);
    try {
      const r = await api<Prefill>(`/purchase-bills/prefill?${p.grnId ? 'grnId=' + p.grnId : 'purchaseOrderId=' + p.purchaseOrderId}`);
      setPre(r);
      setF((x) => ({ ...x, vendorId: String(r.vendor.id), purchaseOrderId: String(r.purchaseOrder.id), grnId: r.grn ? String(r.grn.id) : '', vendorInvoiceNo: x.vendorInvoiceNo || r.grn?.vendorInvoiceNo || '' }));
      setLines(r.lines.length ? r.lines.map((l) => ({
        poLineId: l.poLineId, itemId: String(l.itemId), itemCode: l.itemCode, itemName: l.itemName, hsn: l.hsn, uom: l.uom, lotNo: l.lotNo || '',
        qty: String(l.qty), rate: String(l.rate), discPct: String(l.discPct || 0), taxPct: String(l.taxPct), poRate: l.rate, open: Math.max(0, l.qtyReceived - l.qtyBilled), received: l.qtyReceived,
      })) : [blank()]);
      if (!r.lines.length) toast.err(`Everything received on ${r.purchaseOrder.number} is already billed`);
    } catch (e) { toast.err(e); } finally { setLoadingPre(false); }
  }

  const vendor = (vendors?.rows || []).find((v: any) => String(v.id) === f.vendorId);
  const vendorGstin: string = pre?.vendor.gstin || vendor?.gstin || '';
  const companyGstin = user?.company.gstin || '';
  const inter = !!vendorGstin && !!companyGstin && vendorGstin.slice(0, 2) !== companyGstin.slice(0, 2);
  const valid = lines.filter((l) => l.itemId && Number(l.qty) > 0);

  const t = useMemo(() => {
    const a = valid.map(lineAmt);
    const gross = a.reduce((s, x) => s + x.gross, 0), disc = a.reduce((s, x) => s + x.disc, 0), taxable = gross - disc, tax = a.reduce((s, x) => s + x.tax, 0);
    const tds = (taxable * (Number(f.tdsPct) || 0)) / 100;
    return { gross, disc, taxable, tax, tds, total: Math.round(taxable + tax - tds) };
  }, [valid, f.tdsPct]);

  // 3-way match preview: quantity against what was received and not billed, net rate within 1% of the PO rate
  const match = useMemo(() => {
    if (!pre) return null;
    const qtyBad = valid.filter((l) => l.poLineId && l.open !== undefined && Number(l.qty) > l.open + 0.0005);
    const rateBad = valid.filter((l) => l.poLineId && l.poRate !== undefined && l.poRate > 0 && Math.abs((Number(l.rate) * (1 - (Number(l.discPct) || 0) / 100)) - l.poRate) / l.poRate > 0.01);
    const extra = valid.filter((l) => !l.poLineId);
    return { qtyBad, rateBad, extra, ok: !qtyBad.length && !rateBad.length && !extra.length };
  }, [pre, valid]);

  const setLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const pickItem = (i: number, id: string) => {
    const it = (items?.rows || []).find((x: any) => String(x.id) === id);
    setLine(i, { itemId: id, itemCode: it?.code, itemName: it?.name, hsn: it?.hsn, uom: it?.uom, rate: it ? String(it.stdCost || '') : '', taxPct: it ? String(it.taxPct) : '18' });
  };

  const validationMsg = tried && (!f.vendorId ? 'Select a vendor to continue.'
    : !f.vendorInvoiceNo.trim() ? 'Enter the vendor invoice number.'
    : valid.length === 0 ? 'Add at least one item line with a quantity to continue.'
    : null);

  async function save(postIt: boolean) {
    setTried(true);
    if (!f.vendorId || !f.vendorInvoiceNo.trim() || valid.length === 0) return;
    setBusy(postIt ? 'post' : 'draft');
    try {
      const b = await post('/purchase-bills', {
        vendorId: Number(f.vendorId), purchaseOrderId: f.purchaseOrderId ? Number(f.purchaseOrderId) : null, grnId: f.grnId ? Number(f.grnId) : null,
        vendorInvoiceNo: f.vendorInvoiceNo.trim(), vendorInvoiceDate: f.vendorInvoiceDate || null, billDate: f.billDate || undefined, tdsPct: Number(f.tdsPct) || 0, notes: f.notes.trim() || null, post: postIt,
        lines: valid.map((l) => ({ poLineId: l.poLineId, itemId: Number(l.itemId), lotNo: l.lotNo.trim() || null, qty: Number(l.qty), rate: Number(l.rate) || 0, discPct: Number(l.discPct) || 0, taxPct: Number(l.taxPct) })),
      });
      toast.ok(!postIt ? `${b.number} saved as draft` : b.status === 'On hold' ? `${b.number} posted · on hold for approval (${b.matchStatus})` : b.matchStatus === '3-way OK' ? `${b.number} posted · 3-way match OK` : `${b.number} posted · approved with ${b.matchStatus}`);
      router.push(tenantHref(`/purchase/bills/${b.id}`));
    } catch (e) { toast.err(e); setBusy(''); }
  }

  const due = f.billDate ? addDaysIso(f.billDate, pre?.vendor.paymentTermsDays ?? vendor?.paymentTermsDays ?? 30) : null;

  return (
    <>
      <PageHeader back="/purchase/bills"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Purchase' }, { label: 'Purchase Bills', href: '/purchase/bills' }, { label: 'New bill' }]}
        title="New purchase bill" sub="Book the vendor invoice line by line · heat / lot numbers flow into the stock ledger"
        actions={<>
          <Button onClick={() => router.push(tenantHref('/purchase/bills'))}>Cancel</Button>
          <Button icon={Save} loading={busy === 'draft'} disabled={!!busy} onClick={() => save(false)}>Save draft</Button>
          <Button variant="primary" icon={Send} loading={busy === 'post'} disabled={!!busy} onClick={() => save(true)}>Save & post</Button>
        </>} />
      {validationMsg ? <Alert tone="warning">{validationMsg}</Alert> : null}

      <div className="grid main-side">
        <Card title="Bill details" sub="Matched against the PO and GRN when you post">
          <div className="form c3">
            <SelectField label="Vendor" value={f.vendorId} required placeholder="Choose a vendor…" onChange={(v) => { setF((x) => ({ ...x, vendorId: v, purchaseOrderId: '', grnId: '' })); setPre(null); setLines([blank()]); }}
              options={(vendors?.rows || []).map((v: any) => ({ value: v.id, label: `${v.name} · ${v.code}` }))} />
            <SelectField label="Against PO" value={f.purchaseOrderId} disabled={!f.vendorId || loadingPre} placeholder={orders && !orders.length ? 'No PO waiting for a bill' : 'No PO (direct bill)'}
              onChange={(v) => load({ purchaseOrderId: v || undefined })}
              options={[...(orders || []).map((o: any) => ({ value: o.id, label: `${o.number} · ${num(o.unbilledQty)} unbilled` })), ...(pre && !(orders || []).some((o: any) => o.id === pre.purchaseOrder.id) ? [{ value: pre.purchaseOrder.id, label: pre.purchaseOrder.number }] : [])]} />
            <SelectField label="Against GRN" value={f.grnId} disabled={!pre || loadingPre} placeholder="All GRNs on the PO"
              onChange={(v) => load(v ? { grnId: v } : { purchaseOrderId: f.purchaseOrderId })}
              options={(pre?.grns || []).map((g) => ({ value: g.id, label: `${g.number} · ${date(g.receivedDate)}` }))} />
            <TextField label="Vendor invoice no" value={f.vendorInvoiceNo} onChange={set('vendorInvoiceNo')} required placeholder="As printed on the invoice" />
            <TextField label="Vendor invoice date" type="date" value={f.vendorInvoiceDate} onChange={set('vendorInvoiceDate')} />
            <TextField label="Bill date" type="date" value={f.billDate} onChange={set('billDate')} hint={due ? `Due ${date(due)} · Net ${pre?.vendor.paymentTermsDays ?? vendor?.paymentTermsDays ?? 30}` : undefined} />
            <TextField label="Vendor GSTIN" value={vendorGstin || '—'} onChange={() => undefined} disabled hint={vendorGstin ? (inter ? 'Other state · IGST' : 'Same state · CGST + SGST') : undefined} />
            <SelectField label="TDS" value={f.tdsPct} onChange={set('tdsPct')} options={[{ value: '0', label: 'None' }, { value: '0.1', label: '194Q · 0.1% (goods)' }, { value: '1', label: '194C · 1% (contractor)' }, { value: '2', label: '194C · 2% (company)' }, { value: '10', label: '194J · 10% (professional)' }]} />
            <div />
            <TextAreaField className="full" label="Notes" value={f.notes} onChange={set('notes')} rows={2} placeholder="Anything accounts should know" />
          </div>
        </Card>

        <div className="stack">
          <Card title="Bill summary">
            <KeyValue cols={1} items={[
              ['Gross', inr(t.gross, 2)],
              ['Discount', t.disc ? '−' + inr(t.disc, 2) : '—'],
              ['Taxable value', inr(t.taxable, 2)],
              ...(inter ? [['Input IGST', inr(t.tax, 2)] as [string, string]] : [['Input CGST', inr(t.tax / 2, 2)] as [string, string], ['Input SGST', inr(t.tax / 2, 2)] as [string, string]]),
              [`TDS (${f.tdsPct}%)`, t.tds ? '−' + inr(t.tds, 2) : '—'],
            ]} />
            <div className="row between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
              <span className="strong">Payable</span><span className="h3 num">{inr(t.total)}</span>
            </div>
          </Card>
          <Card title="3-way match" sub={pre ? `${pre.purchaseOrder.number}${pre.grn ? ' · ' + pre.grn.number : ''}` : 'Pick a PO to match against'}>
            {!pre ? <div className="text-sm muted">A bill without a PO always goes to a manager for approval.</div> : loadingPre ? <Loading rows={3} /> : match ? (
              <div className="list">
                <MatchRow ok={!match.qtyBad.length} title="Quantity" sub={match.qtyBad.length ? match.qtyBad.map((l) => `${l.itemCode}: ${num(Number(l.qty))} billed, ${num(l.open)} open`).join(' · ') : 'Not more than received and unbilled'} />
                <MatchRow ok={!match.rateBad.length} title="Rate" sub={match.rateBad.length ? match.rateBad.map((l) => `${l.itemCode}: ${inr(Number(l.rate), 2)} vs PO ${inr(l.poRate, 2)}`).join(' · ') : 'Within 1% of the PO rate'} />
                <MatchRow ok={!match.extra.length} title="Items" sub={match.extra.length ? `${match.extra.length} line${match.extra.length === 1 ? '' : 's'} not on the PO` : 'Every line is on the PO'} />
                <div className="text-xs muted" style={{ paddingTop: 8 }}>{match.ok ? 'Posting approves the bill for payment.' : 'Posting puts the bill on hold for a manager to approve.'}</div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      {pre && !pre.lines.length ? <Alert tone="warning" title={`Nothing left to bill on ${pre.purchaseOrder.number}`}>Every received quantity is already on a bill. Pick another PO or enter a direct bill.</Alert> : null}

      <div className="card lines-table">
        <div className="toolbar"><div><div className="tt">Items</div><div className="ts">{pre ? 'Loaded from the PO / GRN · edit quantities and rates to match the vendor invoice' : 'Enter each line as on the vendor invoice'}</div></div></div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th style={{ width: '28%' }}>Item</th><th>Heat / lot no</th><th className="r">Qty</th><th className="r">Rate (₹)</th><th className="r">Disc %</th><th className="r">GST %</th><th className="r">Amount</th><th /></tr></thead>
            <tbody>
              {lines.map((l, i) => {
                const a = lineAmt(l);
                return (
                  <tr key={i}>
                    <td>
                      {l.poLineId ? (
                        <div><div className="strong">{l.itemName}</div><div className="text-xs muted">{l.itemCode}{l.hsn ? ' · HSN ' + l.hsn : ''}{l.open !== undefined ? ` · ${num(l.open)} ${l.uom} open` : ''}</div></div>
                      ) : (
                        <select className="select" aria-label={`Item for line ${i + 1}`} value={l.itemId} onChange={(e) => pickItem(i, e.target.value)}>
                          <option value="">Choose an item…</option>
                          {(items?.rows || []).map((x: any) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td><input className="input" style={{ width: 130 }} aria-label="Heat or lot number" value={l.lotNo} onChange={(e) => setLine(i, { lotNo: e.target.value })} placeholder="optional" /></td>
                    <td className="r"><input className="input num" style={{ width: 100, textAlign: 'right' }} aria-label="Quantity" type="number" min={0} step="any" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                    <td className="r">
                      <input className="input num" style={{ width: 110, textAlign: 'right' }} aria-label="Rate" type="number" min={0} step="any" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} />
                      {l.poRate !== undefined ? <div className="text-xs muted">PO {inr(l.poRate, 2)}</div> : null}
                    </td>
                    <td className="r"><input className="input num" style={{ width: 70, textAlign: 'right' }} aria-label="Discount percent" type="number" min={0} max={100} step="any" value={l.discPct} onChange={(e) => setLine(i, { discPct: e.target.value })} /></td>
                    <td className="r"><input className="input num" style={{ width: 70, textAlign: 'right' }} aria-label="GST percent" type="number" min={0} max={40} step="any" value={l.taxPct} onChange={(e) => setLine(i, { taxPct: e.target.value })} /></td>
                    <td className="r num strong">{inr(a.taxable + a.tax, 2)}</td>
                    <td className="r"><button type="button" className="icon-btn" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tfoot"><Button size="sm" icon={Plus} onClick={() => setLines([...lines, blank()])}>Add item</Button><span>{valid.length} line{valid.length === 1 ? '' : 's'} · {inr(t.total)} payable</span></div>
      </div>
    </>
  );
}

function MatchRow({ ok, title, sub }: { ok: boolean; title: string; sub: string }) {
  return (
    <div className="li">
      {ok ? <CircleCheck size={18} className="f-success" /> : <CircleAlert size={18} className="f-warning" />}
      <div style={{ flex: 1, minWidth: 0 }}><div className="lt">{title}</div><div className="ls">{sub}</div></div>
      <span className={'badge t-' + (ok ? 'success' : 'warning')}>{ok ? 'OK' : 'Variance'}</span>
    </div>
  );
}
