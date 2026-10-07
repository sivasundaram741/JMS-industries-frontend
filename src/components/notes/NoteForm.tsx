'use client';
// New debit / credit invoice: pick the party and the original bill, tick every product being returned — each line
// has its own quantity, reason and condition — choose how to settle, then save a draft or send it for approval.
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Save, Send, Trash2 } from 'lucide-react';
import { api, post, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, inr, num, todayIso } from '@/lib/format';
import { Alert, Button, Card, KeyValue, Loading, PageHeader, SelectField, TextAreaField, TextField, useToast } from '@/components/ui';
import { CONDITIONS, NOTES, WAREHOUSES, type NoteKind } from './config';

interface SrcLine { sourceLineId: number; itemId: number; itemCode: string; itemName: string; hsn: string | null; uom: string; lotNo: string | null; qty: number; returned: number; returnable: number; rate: number; taxPct: number }
interface Source { id: number; number: string; partyId: number; partyName: string; status: string; lines: SrcLine[] }
interface Row { key: string; on: boolean; sourceLineId: number | null; itemId: string; itemCode?: string; itemName?: string; hsn?: string | null; uom?: string; lotNo: string; qty: string; max?: number; billed?: number; rate: string; taxPct: string; reason: string; condition: string }

export function NoteForm({ kind }: { kind: NoteKind }) {
  const c = NOTES[kind];
  const { user } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const { data: parties } = useApi<Page<any>>(c.partyApi);
  const { data: summary } = useApi<{ reasons: string[] }>(`${c.api}/summary`);
  const { data: items } = useApi<Page<any>>('/items?pageSize=200');
  const reasons = summary?.reasons || [];
  const [f, setF] = useState({ partyId: '', sourceId: '', noteDate: todayIso(), warehouse: c.defaultWh as string, reason: '', settlement: 'Adjust', notes: '' });
  const { data: sources } = useApi<Page<any>>(f.partyId ? c.sourceApi(f.partyId) : null);
  const [src, setSrc] = useState<Source | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'' | 'draft' | 'submit'>('');
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => { if (reasons.length && !f.reason) setF((x) => ({ ...x, reason: reasons[0] })); }, [reasons]); // eslint-disable-line react-hooks/exhaustive-deps
  // Start from ?bill= / ?invoice= (the "Debit invoice" button on a bill, "Credit invoice" on an invoice)
  useEffect(() => { const s = sp.get(kind === 'debit' ? 'bill' : 'invoice'); if (s) loadSource(s); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSource(id: string) {
    if (!id) { setSrc(null); setRows((r) => r.filter((x) => !x.sourceLineId)); setF((x) => ({ ...x, sourceId: '' })); return; }
    setLoading(true);
    try {
      const s = await api<Source>(`${c.api}/source/${id}`);
      setSrc(s);
      setF((x) => ({ ...x, partyId: String(s.partyId), sourceId: String(s.id) }));
      setRows(s.lines.map((l) => ({
        key: 's' + l.sourceLineId, on: false, sourceLineId: l.sourceLineId, itemId: String(l.itemId), itemCode: l.itemCode, itemName: l.itemName, hsn: l.hsn, uom: l.uom, lotNo: l.lotNo || '',
        qty: '', max: l.returnable, billed: l.qty, rate: String(l.rate), taxPct: String(l.taxPct), reason: '', condition: kind === 'debit' ? 'Damaged' : 'Resaleable',
      })));
    } catch (e) { toast.err(e); } finally { setLoading(false); }
  }

  const upd = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const toggle = (r: Row, on: boolean) => upd(r.key, { on, qty: on && !r.qty ? String(r.max ?? '') : r.qty, reason: on && !r.reason ? f.reason : r.reason });
  const addManual = () => setRows((rs) => [...rs, { key: 'm' + Date.now(), on: true, sourceLineId: null, itemId: '', lotNo: '', qty: '', rate: '', taxPct: '18', reason: f.reason, condition: kind === 'debit' ? 'Damaged' : 'Resaleable' }]);
  const pickItem = (r: Row, id: string) => {
    const it = (items?.rows || []).find((x: any) => String(x.id) === id);
    upd(r.key, { itemId: id, itemCode: it?.code, itemName: it?.name, hsn: it?.hsn, uom: it?.uom, rate: it ? String(kind === 'debit' ? it.stdCost : it.salePrice || it.stdCost) : '', taxPct: it ? String(it.taxPct) : '18' });
  };

  const chosen = rows.filter((r) => r.on && r.itemId && Number(r.qty) > 0);
  const errors = chosen.filter((r) => r.max !== undefined && Number(r.qty) > r.max + 0.0005);
  const t = useMemo(() => {
    let taxable = 0, tax = 0, units = 0;
    for (const r of chosen) { const a = Number(r.qty) * (Number(r.rate) || 0); taxable += a; tax += (a * (Number(r.taxPct) || 0)) / 100; units += Number(r.qty); }
    return { taxable, tax, total: Math.round(taxable + tax), units };
  }, [chosen]);

  const validationMsg = tried && (!f.partyId ? `Select a ${c.party.toLowerCase()} to continue.`
    : !f.reason ? 'Select a return reason to continue.'
    : !chosen.length ? 'Tick at least one product to return.'
    : null);

  async function save(submit: boolean) {
    setTried(true);
    if (!f.partyId || !f.reason || !chosen.length || errors.length > 0) return;
    setBusy(submit ? 'submit' : 'draft');
    try {
      const n = await post(c.api, {
        [c.partyField]: Number(f.partyId), [c.sourceField]: f.sourceId ? Number(f.sourceId) : null, noteDate: f.noteDate || undefined, warehouse: f.warehouse, reason: f.reason, settlement: f.settlement, notes: f.notes.trim() || null, submit,
        lines: chosen.map((r) => ({ sourceLineId: r.sourceLineId, itemId: Number(r.itemId), lotNo: r.lotNo.trim() || null, qty: Number(r.qty), rate: Number(r.rate) || 0, taxPct: Number(r.taxPct), reason: r.reason || f.reason, condition: r.condition })),
      });
      toast.ok(!submit ? `${n.number} saved as draft` : n.status === 'Pending approval' ? `${n.number} sent for approval` : `${n.number} approved · ${n.status}`);
      router.push(`${c.href}/${n.id}`);
    } catch (e) { toast.err(e); setBusy(''); }
  }

  const party = (parties?.rows || []).find((p: any) => String(p.id) === f.partyId);

  return (
    <>
      <PageHeader back={c.href}
        crumbs={[{ label: user?.company.shortName || '' }, { label: c.section }, { label: c.plural, href: c.href }, { label: 'New' }]}
        title={`New ${c.label.toLowerCase()}`} sub="Tick the products coming back · each line has its own quantity, reason and condition"
        actions={<>
          <Button onClick={() => router.push(c.href)}>Cancel</Button>
          <Button icon={Save} loading={busy === 'draft'} disabled={!!busy} onClick={() => save(false)}>Save draft</Button>
          <Button variant="primary" icon={Send} loading={busy === 'submit'} disabled={!!busy} onClick={() => save(true)}>Create {c.label.toLowerCase()}</Button>
        </>} />
      {validationMsg ? <Alert tone="warning">{validationMsg}</Alert> : null}

      <div className="grid main-side">
        <Card title="Return against" sub={`Pick the original ${c.source.toLowerCase()} to load its products`}>
          <div className="form c3">
            <SelectField label={c.party} value={f.partyId} placeholder={`Choose a ${c.party.toLowerCase()}…`} required
              onChange={(v) => { setF((x) => ({ ...x, partyId: v, sourceId: '' })); setSrc(null); setRows([]); }}
              options={(parties?.rows || []).map((p: any) => ({ value: p.id, label: `${p.name} · ${p.code}` }))} />
            <SelectField label={`Original ${c.source.toLowerCase()}`} value={f.sourceId} disabled={!f.partyId || loading} placeholder={sources && !sources.rows.length ? 'None to return against' : 'Not against a bill'}
              onChange={loadSource}
              options={[...(sources?.rows || []).map((s: any) => ({ value: s.id, label: `${s.number} · ${date(s.billDate || s.invoiceDate)} · ${inr(s.total)}` })), ...(src && !(sources?.rows || []).some((s: any) => s.id === src.id) ? [{ value: src.id, label: src.number }] : [])]} />
            <TextField label="Return date" type="date" value={f.noteDate} onChange={set('noteDate')} />
            <SelectField label={c.whLabel} value={f.warehouse} onChange={set('warehouse')} options={WAREHOUSES} hint={kind === 'credit' ? 'Damaged / expired goods always go to QC Hold' : 'Stock leaves this location on approval'} />
            <SelectField label="Default reason" value={f.reason} onChange={set('reason')} options={reasons.map((r) => ({ value: r, label: r }))} />
            <TextField label={`${c.party} code`} value={party?.code || '—'} onChange={() => undefined} disabled />
            <TextAreaField className="full" label="Notes" value={f.notes} onChange={set('notes')} rows={2} placeholder={kind === 'debit' ? 'e.g. hardness below spec on heat H-22871, photos attached' : 'e.g. 6 housings dented in transit, POD remark'} />
          </div>
        </Card>
        <div className="stack">
          <Card title="Return summary">
            <KeyValue cols={1} items={[
              ['Products selected', src ? `${chosen.filter((r) => r.sourceLineId).length} of ${src.lines.length}${chosen.some((r) => !r.sourceLineId) ? ` + ${chosen.filter((r) => !r.sourceLineId).length} other` : ''}` : String(chosen.length)],
              ['Units returned', num(t.units, 3)],
              ['Taxable value', inr(t.taxable, 2)],
              ['GST reversal', inr(t.tax, 2)],
            ]} />
            <div className="row between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
              <span className="strong">{kind === 'debit' ? 'Debit value' : 'Credit value'}</span><span className="h3 num">{inr(t.total)}</span>
            </div>
          </Card>
          <Card title={kind === 'debit' ? 'Settle the debit' : 'Settle the credit'}>
            <div className="stack tight" style={{ gap: 8 }}>
              {(['Adjust', 'Refund', 'Replacement'] as const).map((k) => (
                <button key={k} type="button" className={'choice' + (f.settlement === k ? ' on' : '')} onClick={() => set('settlement')(k)} aria-pressed={f.settlement === k}>
                  <input type="radio" readOnly checked={f.settlement === k} style={{ marginTop: 3 }} tabIndex={-1} />
                  <span><span className="ct" style={{ display: 'block' }}>{c.settle[k].title}</span><span className="cs">{c.settle[k].sub(party?.name || `the ${c.party.toLowerCase()}`)}</span></span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {errors.length ? <Alert tone="danger" title="More than can be returned">{errors.map((r) => `${r.itemCode}: ${num(Number(r.qty))} entered, ${num(r.max)} returnable`).join(' · ')}</Alert> : null}

      <div className="card lines-table">
        <div className="toolbar">
          <div><div className="tt">Select products to return</div><div className="ts">Tick every product being returned · untick to leave it on the {kind === 'debit' ? 'bill' : 'invoice'}</div></div>
          <div className="spacer" />
          <span className="text-sm muted">{chosen.length} selected</span>
          <Button size="sm" icon={Plus} onClick={addManual}>Add a product not on the {kind === 'debit' ? 'bill' : 'invoice'}</Button>
        </div>
        {loading ? <div className="card-body"><Loading rows={4} /></div> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th style={{ width: 36 }} /><th style={{ minWidth: 220 }}>Product</th><th>Heat / lot no</th><th className="r">{kind === 'debit' ? 'Billed' : 'Invoiced'}</th><th className="r">Return qty</th><th>Reason</th><th>Condition</th><th className="r">Rate</th><th className="r">Return value</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const v = r.on ? Number(r.qty || 0) * (Number(r.rate) || 0) * (1 + (Number(r.taxPct) || 0) / 100) : 0;
                  return (
                    <tr key={r.key} style={{ opacity: r.on ? 1 : 0.75 }}>
                      <td><input type="checkbox" checked={r.on} onChange={(e) => toggle(r, e.target.checked)} aria-label={`Return ${r.itemName || 'this product'}`} style={{ width: 16, height: 16 }} /></td>
                      <td>
                        {r.sourceLineId ? <div style={{ minWidth: 200 }}><div className="strong">{r.itemName}</div><div className="text-xs muted">{r.itemCode}{r.hsn ? ' · HSN ' + r.hsn : ''}</div></div> : (
                          <select className="select" value={r.itemId} onChange={(e) => pickItem(r, e.target.value)} aria-label="Product">
                            <option value="">Choose a product…</option>
                            {(items?.rows || []).map((x: any) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
                          </select>
                        )}
                      </td>
                      <td><input className="input" style={{ width: 110 }} value={r.lotNo} onChange={(e) => upd(r.key, { lotNo: e.target.value })} aria-label="Heat or lot number" placeholder="—" /></td>
                      <td className="r num">{r.billed !== undefined ? <><div>{num(r.billed)}</div>{r.max !== undefined && r.max < r.billed ? <div className="text-xs muted">{num(r.max)} left</div> : null}</> : '—'}</td>
                      <td className="r"><input className="input num" style={{ width: 90, textAlign: 'right' }} type="number" min={0} step="any" value={r.qty} disabled={!r.on} onChange={(e) => upd(r.key, { qty: e.target.value })} aria-label="Return quantity" /></td>
                      <td>
                        <select className="select" style={{ width: 160 }} value={r.reason} disabled={!r.on} onChange={(e) => upd(r.key, { reason: e.target.value })} aria-label="Reason">
                          <option value="">Select reason</option>
                          {reasons.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="select" style={{ width: 130 }} value={r.condition} disabled={!r.on} onChange={(e) => upd(r.key, { condition: e.target.value })} aria-label="Condition">
                          {CONDITIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </td>
                      <td className="r">{r.sourceLineId ? <span className="num">{inr(Number(r.rate), 2)}</span> : <input className="input num" style={{ width: 100, textAlign: 'right' }} type="number" min={0} step="any" value={r.rate} onChange={(e) => upd(r.key, { rate: e.target.value })} aria-label="Rate" />}</td>
                      <td className="r num strong">{r.on && Number(r.qty) > 0 ? inr(v, 2) : '—'}</td>
                      <td className="r">{!r.sourceLineId ? <button type="button" className="icon-btn" aria-label="Remove line" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}><Trash2 size={16} /></button> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length ? <div className="empty text-sm">{f.partyId ? `Pick the original ${c.source.toLowerCase()} above, or add a product not on a ${kind === 'debit' ? 'bill' : 'invoice'}` : `Choose the ${c.party.toLowerCase()} first`}</div> : null}
          </div>
        )}
      </div>
    </>
  );
}
