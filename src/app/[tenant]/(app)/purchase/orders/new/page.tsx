'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useTenantHref } from '@/lib/hooks';
import { addDaysIso, dateShort, num, todayIso } from '@/lib/format';
import { Alert, Button, Card, PageHeader, SelectField, TextAreaField, TextField, useToast } from '@/components/ui';
import { ComboField } from '@/components/ui/ComboField';
import { LinesEditor, emptyLine, type Line } from '@/components/LinesEditor';
import { QuickVendor } from '@/components/QuickCreate';

type PoType = 'PO' | 'JOB_WORK';

export default function NewPurchaseOrderPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const sp = useSearchParams();
  const toast = useToast();

  const [type, setType] = useState<PoType>(sp.get('type') === 'JOB_WORK' ? 'JOB_WORK' : 'PO');
  const jw = type === 'JOB_WORK';

  const { data: wos } = useApi<any>(can('wo') ? '/work-orders?open=1&pageSize=100' : null);
  const [f, setF] = useState({ vendorId: '', needBy: addDaysIso(todayIso(), 7), workOrderId: sp.get('wo') || '', notes: '' });
  const [vendorLabel, setVendorLabel] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  const wo = (wos?.rows || []).find((w: any) => String(w.id) === f.workOrderId);

  // Prefill a single line from URL params (?item=<id>&qty=<n>) without bulk-loading all items
  const prefilled = useRef(false);
  const prefillId = sp.get('item');
  const { data: prefillItem } = useApi<any>(prefillId ? `/items/${prefillId}` : null);
  useEffect(() => {
    if (prefilled.current || !prefillItem) return;
    prefilled.current = true;
    setLines([{ itemId: String(prefillItem.id), qty: sp.get('qty') || '', rate: String(prefillItem.stdCost || ''), taxPct: String(prefillItem.taxPct) }]);
  }, [prefillItem]); // eslint-disable-line react-hooks/exhaustive-deps

  // Job work for a WO: default qty to remaining
  useEffect(() => {
    if (!jw || !wo) return;
    setLines(ls => ls.length === 1 && !ls[0].qty ? [{ ...ls[0], qty: String(Math.max(0, wo.qtyPlanned - wo.qtyCompleted) || wo.qtyPlanned) }] : ls);
  }, [jw, wo]);

  function changeType(v: string) {
    const t = v === 'JOB_WORK' ? 'JOB_WORK' : 'PO';
    if (t === type) return;
    setType(t);
    setLines([emptyLine()]);
    // Clear vendor — the filter changes between PO (all vendors) and JOB_WORK (subcontractors only)
    setF(x => ({ ...x, vendorId: '' }));
    setVendorLabel('');
  }

  const itemFilter = jw ? 'type=SERVICE' : 'type=RM,BOUGHT,CONSUMABLE';
  const valid = lines.filter(l => l.itemId && Number(l.qty) > 0);
  const [tried, setTried] = useState(false);

  const validationMsg = tried && (!f.vendorId ? `Select a ${jw ? 'subcontractor' : 'vendor'} to continue.`
    : !valid.length ? 'Add at least one item line with a quantity to continue.'
    : null);

  async function save() {
    setTried(true);
    if (!f.vendorId || !valid.length) return;
    setBusy(true);
    try {
      const po = await post('/purchase-orders', {
        vendorId: Number(f.vendorId), type, needBy: f.needBy || undefined,
        notes: f.notes || undefined,
        workOrderId: f.workOrderId ? Number(f.workOrderId) : undefined,
        lines: valid.map(l => ({ itemId: Number(l.itemId), qty: Number(l.qty), rate: Number(l.rate) || 0, taxPct: Number(l.taxPct) })),
      });
      toast.ok(`${po.number} created as draft`);
      router.push(tenantHref(`/purchase/orders/${po.id}`));
    } catch (e) { toast.err(e); setBusy(false); }
  }

  const back = jw ? '/purchase/subcontracting' : '/purchase/orders';
  return (
    <>
      <PageHeader back={back}
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Purchase' }, { label: jw ? 'Subcontracting' : 'Purchase Orders', href: back }, { label: 'New' }]}
        title={jw ? 'New job work order' : 'New purchase order'}
        sub={jw ? 'Material goes to the vendor for a process and comes back against this order' : 'Saved as a draft — submit it for approval next'}
        actions={
          <>
            <Button onClick={() => router.push(back)}>Cancel</Button>
            <Button variant="primary" icon={Save} loading={busy} onClick={save}>
              Save {jw ? 'job work' : 'purchase order'}
            </Button>
          </>
        }
      />
      {validationMsg ? <Alert tone="warning">{validationMsg}</Alert> : null}
      <Card title="Order details">
        <div className="form c3">
          <SelectField label="Order type" value={type} onChange={changeType}
            options={[{ value: 'PO', label: 'Purchase order' }, { value: 'JOB_WORK', label: 'Job work' }]} />
          <ComboField
            label={jw ? 'Subcontractor' : 'Vendor'}
            value={f.vendorId}
            onChange={id => setF(x => ({ ...x, vendorId: id }))}
            apiPath="/vendors"
            extraQuery={jw ? 'subcontractor=1' : undefined}
            toOption={v => ({ id: v.id, label: v.name, sub: v.city || v.code })}
            selectedLabel={vendorLabel}
            canCreate={can('vendors', 'create')}
            createLabel={jw ? 'Add subcontractor' : 'Add vendor'}
            onCreateClick={() => setShowAddVendor(true)}
            placeholder={jw ? 'Search subcontractors…' : 'Search vendors…'}
            required
          />
          <TextField label={jw ? 'Due back' : 'Need by'} type="date" value={f.needBy} onChange={set('needBy')} />
          {can('wo') ? (
            <SelectField className="span2" label={jw ? 'Work order' : 'Work order (optional)'}
              value={f.workOrderId} onChange={set('workOrderId')}
              placeholder="Not linked to a work order"
              options={(wos?.rows || []).map((w: any) => ({ value: w.id, label: `${w.number} · ${w.itemCode} × ${num(w.qtyPlanned)} · ${w.status}${w.customerName ? ' · ' + w.customerName : ''}` }))}
              hint={wo ? `${wo.itemName} · ${num(wo.qtyCompleted)} of ${num(wo.qtyPlanned)} made · due ${dateShort(wo.dueDate)}${wo.salesOrderNo ? ' · ' + wo.salesOrderNo : ''}` : jw ? 'The job work is tracked on this work order' : undefined} />
          ) : <div className="span2" />}
          <div />
          <TextAreaField className="full" label="Notes" value={f.notes} onChange={set('notes')}
            placeholder={jw ? 'Process specification, hardness, packing…' : 'Delivery instructions, test certificate, drawing revision…'}
            rows={2} />
        </div>
      </Card>
      <LinesEditor
        lines={lines}
        onChange={setLines}
        itemApiPath="/items"
        itemFilter={itemFilter}
        canAddItem={can('masters', 'create')}
        priceField="stdCost"
      />
      <QuickVendor
        open={showAddVendor}
        forSubcon={jw}
        onClose={() => setShowAddVendor(false)}
        onCreated={opt => {
          setVendorLabel(opt.label);
          setF(x => ({ ...x, vendorId: String(opt.id) }));
        }}
      />
    </>
  );
}
