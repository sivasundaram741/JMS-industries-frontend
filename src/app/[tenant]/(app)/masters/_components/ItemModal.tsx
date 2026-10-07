'use client';
// Create or edit an item master → POST /items or PUT /items/:id
import { useEffect, useId, useState } from 'react';
import { post, put } from '@/lib/api';
import { Button, Checkbox, Field, Modal, SelectField, TextField, useToast } from '@/components/ui';

export const ITEM_TYPES = [
  { value: 'FG', label: 'Finished good (manufactured)' },
  { value: 'RM', label: 'Raw material' },
  { value: 'BOUGHT', label: 'Bought-out part' },
  { value: 'CONSUMABLE', label: 'Consumable' },
  { value: 'SERVICE', label: 'Service (job work)' },
];
const UOMS = ['Nos', 'Kg', 'Set', 'Mtr', 'Ltr', 'Box'];
const EMPTY = { code: '', name: '', type: 'RM', uom: 'Nos', hsn: '', stdCost: '0', salePrice: '0', taxPct: '18', reorderLevel: '0', isActive: true };

export function ItemModal({ item, open, onClose, onSaved }: { item?: any; open: boolean; onClose: () => void; onSaved: (it: any) => void }) {
  const toast = useToast();
  const uomList = useId();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(item ? { code: item.code, name: item.name, type: item.type, uom: item.uom, hsn: item.hsn || '', stdCost: String(item.stdCost), salePrice: String(item.salePrice), taxPct: String(item.taxPct), reorderLevel: String(item.reorderLevel), isActive: item.isActive !== false } : EMPTY);
  }, [open, item]);
  const set = (k: keyof typeof EMPTY) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const body = { ...f, code: f.code.trim(), name: f.name.trim(), hsn: f.hsn || null, stdCost: Number(f.stdCost) || 0, salePrice: Number(f.salePrice) || 0, taxPct: Number(f.taxPct) || 0, reorderLevel: Number(f.reorderLevel) || 0 };
      const r = item?.id ? await put(`/items/${item.id}`, body) : await post('/items', body);
      toast.ok(`${r.code} · ${r.name} saved`);
      onSaved(r);
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={item?.id ? `Edit ${item.code}` : 'New item'} sub="Used by orders, stock, work orders and invoices · change it once, it applies everywhere"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save} disabled={!f.code.trim() || f.name.trim().length < 2}>Save item</Button></>}>
      <div className="form c3">
        <TextField label="Item code" value={f.code} onChange={(v) => set('code')(v.toUpperCase())} placeholder="e.g. RM-EN8-50" required />
        <TextField className="span2" label="Item name" value={f.name} onChange={set('name')} placeholder="e.g. EN8 round bar Ø50" required />
        <SelectField label="Item type" value={f.type} onChange={set('type')} options={ITEM_TYPES} hint={item?.id ? 'Cannot change once the item has stock movements' : undefined} />
        <Field label="Unit of measure">
          {(id) => (
            <>
              <input id={id} className="input" list={uomList} value={f.uom} onChange={(e) => set('uom')(e.target.value)} />
              <datalist id={uomList}>{UOMS.map((u) => <option key={u} value={u} />)}</datalist>
            </>
          )}
        </Field>
        <TextField label="HSN / SAC" value={f.hsn} onChange={set('hsn')} placeholder="e.g. 7228 30 29" />
        <TextField label="Standard cost (₹)" type="number" value={f.stdCost} onChange={set('stdCost')} hint="Values stock and purchase rates" />
        <TextField label="Sale price (₹)" type="number" value={f.salePrice} onChange={set('salePrice')} hint={f.type === 'FG' ? 'Default rate on customer orders' : '0 if not sold'} />
        <TextField label="GST %" type="number" value={f.taxPct} onChange={set('taxPct')} />
        <TextField label="Reorder level" type="number" value={f.reorderLevel} onChange={set('reorderLevel')} hint="0 = no low-stock alert" />
        {item?.id ? <div className="field full"><Checkbox label="Active · inactive items drop out of low-stock alerts" checked={f.isActive} onChange={(v) => setF((x) => ({ ...x, isActive: v }))} /></div> : null}
      </div>
    </Modal>
  );
}
