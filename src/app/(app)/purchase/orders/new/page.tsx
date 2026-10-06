'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { addDaysIso, dateShort, num, todayIso } from '@/lib/format';
import { Alert, Button, Card, PageHeader, SelectField, TextAreaField, TextField, useToast } from '@/components/ui';
import { LinesEditor, emptyLine, type Line } from '@/components/LinesEditor';

type PoType = 'PO' | 'JOB_WORK';

export default function NewPurchaseOrderPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const [type, setType] = useState<PoType>(sp.get('type') === 'JOB_WORK' ? 'JOB_WORK' : 'PO');
  const jw = type === 'JOB_WORK';
  const { data: vendors } = useApi<any>('/vendors?pageSize=200');
  const { data: items } = useApi<any>(`/items?type=${jw ? 'SERVICE' : 'RM,BOUGHT,CONSUMABLE'}&pageSize=200`);
  const { data: wos } = useApi<any>(can('wo') ? '/work-orders?open=1&pageSize=100' : null);
  const [f, setF] = useState({ vendorId: '', needBy: addDaysIso(todayIso(), 7), workOrderId: sp.get('wo') || '', notes: '' });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const vendorRows: any[] = (vendors?.rows || []).filter((v: any) => v.isActive !== false && (!jw || v.isSubcontractor));
  const itemRows: any[] = items?.rows || [];
  const wo = (wos?.rows || []).find((w: any) => String(w.id) === f.workOrderId);

  // Prefill a line from ?item=<id>&qty=<n> (e.g. "Raise purchase order" from low stock), once the items are loaded
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !items) return;
    prefilled.current = true;
    const it = itemRows.find((x) => String(x.id) === sp.get('item'));
    if (it) setLines([{ itemId: String(it.id), qty: sp.get('qty') || '', rate: String(it.stdCost || ''), taxPct: String(it.taxPct) }]);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Job work for a work order: default the quantity to what is still to make
  useEffect(() => {
    if (!jw || !wo) return;
    setLines((ls) => (ls.length === 1 && !ls[0].qty ? [{ ...ls[0], qty: String(Math.max(0, wo.qtyPlanned - wo.qtyCompleted) || wo.qtyPlanned) }] : ls));
  }, [jw, wo]);

  function changeType(v: string) {
    const t = v === 'JOB_WORK' ? 'JOB_WORK' : 'PO';
    if (t === type) return;
    setType(t);
    setLines([emptyLine()]);
    const cur = (vendors?.rows || []).find((x: any) => String(x.id) === f.vendorId);
    setF((x) => ({ ...x, vendorId: t === 'JOB_WORK' && cur && !cur.isSubcontractor ? '' : x.vendorId }));
  }

  const valid = lines.filter((l) => l.itemId && Number(l.qty) > 0);
  async function save() {
    setBusy(true);
    try {
      const po = await post('/purchase-orders', {
        vendorId: Number(f.vendorId), type, needBy: f.needBy || undefined, notes: f.notes || undefined,
        workOrderId: f.workOrderId ? Number(f.workOrderId) : undefined,
        lines: valid.map((l) => ({ itemId: Number(l.itemId), qty: Number(l.qty), rate: Number(l.rate) || 0, taxPct: Number(l.taxPct) })),
      });
      toast.ok(`${po.number} created as draft`);
      router.push(`/purchase/orders/${po.id}`);
    } catch (e) { toast.err(e); setBusy(false); }
  }

  const back = jw ? '/purchase/subcontracting' : '/purchase/orders';
  return (
    <>
      <PageHeader back={back}
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Purchase' }, { label: jw ? 'Subcontracting' : 'Purchase Orders', href: back }, { label: 'New' }]}
        title={jw ? 'New job work order' : 'New purchase order'}
        sub={jw ? 'Material goes to the vendor for a process and comes back against this order' : 'Saved as a draft requisition · submit it for approval next'}
        actions={<><Button onClick={() => router.push(back)}>Cancel</Button><Button variant="primary" icon={Save} loading={busy} onClick={save} disabled={!f.vendorId || !valid.length}>Save {jw ? 'job work' : 'purchase order'}</Button></>} />
      <Card title="Order details">
        <div className="form c3">
          <SelectField label="Order type" value={type} onChange={changeType} options={[{ value: 'PO', label: 'Purchase order' }, { value: 'JOB_WORK', label: 'Job work' }]} />
          <SelectField label={jw ? 'Subcontractor' : 'Vendor'} value={f.vendorId} onChange={set('vendorId')} placeholder={jw ? 'Choose a subcontractor…' : 'Choose a vendor…'} required
            options={vendorRows.map((v) => ({ value: v.id, label: `${v.name} · ${v.city || v.code}` }))}
            hint={jw && vendors && !vendorRows.length ? 'No vendor is marked as a subcontractor yet' : undefined} />
          <TextField label={jw ? 'Due back' : 'Need by'} type="date" value={f.needBy} onChange={set('needBy')} />
          {can('wo') ? (
            <SelectField className="span2" label={jw ? 'Work order' : 'Work order (optional)'} value={f.workOrderId} onChange={set('workOrderId')} placeholder="Not linked to a work order"
              options={(wos?.rows || []).map((w: any) => ({ value: w.id, label: `${w.number} · ${w.itemCode} × ${num(w.qtyPlanned)} · ${w.status}${w.customerName ? ' · ' + w.customerName : ''}` }))}
              hint={wo ? `${wo.itemName} · ${num(wo.qtyCompleted)} of ${num(wo.qtyPlanned)} made · due ${dateShort(wo.dueDate)}${wo.salesOrderNo ? ' · ' + wo.salesOrderNo : ''}` : jw ? 'The job work is tracked on this work order' : undefined} />
          ) : <div className="span2" />}
          <div />
          <TextAreaField className="full" label="Notes" value={f.notes} onChange={set('notes')} placeholder={jw ? 'Process specification, hardness, packing…' : 'Delivery instructions, test certificate, drawing revision…'} rows={2} />
        </div>
      </Card>
      {jw && items && !itemRows.length ? <Alert tone="warning" title="No job-work services set up">Add a SERVICE item in Items & Machines, e.g. heat treatment or coating.</Alert> : null}
      <LinesEditor lines={lines} onChange={setLines} items={itemRows} priceField="stdCost" />
    </>
  );
}
