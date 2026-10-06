'use client';
// Stock adjustment: + or − a quantity of one item in one warehouse (and lot) with a reason → POST /stock/adjust
import { useEffect, useId, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { post, qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { num } from '@/lib/format';
import { Alert, Button, Field, Modal, SelectField, TextField, useToast } from '@/components/ui';

const EMPTY = { itemId: '', warehouse: 'RM', lotNo: '', qty: '', note: '' };

export function AdjustModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const listId = useId();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF(EMPTY); }, [open]);
  const set = (k: keyof typeof EMPTY) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const { data: items } = useApi<any>(open ? '/items?type=FG,RM,BOUGHT,CONSUMABLE&pageSize=200' : null);
  const { data: whs } = useApi<any[]>(open ? '/warehouses' : null);
  const item = (items?.rows || []).find((i: any) => String(i.id) === f.itemId);
  const { data: lots } = useApi<any[]>(open && item ? '/stock/lots' + qs({ warehouse: f.warehouse, search: item.code }) : null);
  const itemLots = (lots || []).filter((l) => l.itemId === item?.id);
  const onHand = itemLots.reduce((a, l) => a + l.qty, 0);
  const lot = itemLots.find((l) => (l.lotNo || '') === f.lotNo.trim());
  const qty = Number(f.qty) || 0;
  const needLot = qty < 0 && itemLots.some((l) => l.lotNo) && !lot;
  const tooMuch = qty < 0 && -qty > (lot ? lot.qty : onHand) + 0.0005;
  const valid = !!item && qty !== 0 && f.note.trim().length >= 3 && !needLot && !tooMuch;

  async function save() {
    setBusy(true);
    try {
      await post('/stock/adjust', { itemId: item.id, warehouse: f.warehouse, lotNo: f.lotNo.trim() || undefined, qty, note: f.note.trim() });
      toast.ok(`${item.name} ${qty > 0 ? '+' : ''}${num(qty, 3)} ${item.uom} in ${f.warehouse}`);
      onDone();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Adjust stock" sub="For counts, damage or corrections · every adjustment is posted to the stock ledger with your reason"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={SlidersHorizontal} loading={busy} disabled={!valid} onClick={save}>Post adjustment</Button></>}>
      <div className="form c2">
        <SelectField className="full" label="Item" value={f.itemId} onChange={(v) => setF((x) => ({ ...x, itemId: v, lotNo: '' }))} placeholder="Choose an item…"
          options={(items?.rows || []).map((i: any) => ({ value: i.id, label: `${i.code} · ${i.name}` }))} />
        <SelectField label="Warehouse" value={f.warehouse} onChange={(v) => setF((x) => ({ ...x, warehouse: v, lotNo: '' }))}
          options={(whs || [{ code: 'RM', name: 'RM Store' }, { code: 'WIP', name: 'WIP' }, { code: 'QC', name: 'QC Hold' }, { code: 'FG', name: 'FG Store' }]).map((w: any) => ({ value: w.code, label: w.name }))}
          hint={item ? `${num(onHand, 3)} ${item.uom} on hand here` : undefined} />
        <Field label="Lot / heat no" hint={lot ? `${num(lot.qty, 3)} ${item?.uom} in this lot` : itemLots.length ? `${itemLots.length} lot${itemLots.length > 1 ? 's' : ''} here · type a new one to add stock` : 'Optional for new stock'}>
          {(id) => (
            <>
              <input id={id} className="input" list={listId} value={f.lotNo} onChange={(e) => set('lotNo')(e.target.value)} placeholder={itemLots.length ? 'Choose or type a lot' : 'e.g. H-22871'} />
              <datalist id={listId}>{itemLots.filter((l) => l.lotNo).map((l) => <option key={l.lotNo} value={l.lotNo}>{num(l.qty, 3)} {l.uom}</option>)}</datalist>
            </>
          )}
        </Field>
        <TextField label={`Quantity ± ${item ? '(' + item.uom + ')' : ''}`} type="number" step="any" value={f.qty} onChange={set('qty')} placeholder="e.g. -12 or 40" hint="Negative to take out, positive to add" />
        <TextField label="Reason" value={f.note} onChange={set('note')} placeholder="e.g. Cycle count difference" required />
      </div>
      {needLot ? <div style={{ marginTop: 12 }}><Alert tone="warning" title="Choose the lot to take stock from">This item is held in lots here · pick one from the list.</Alert></div> : null}
      {tooMuch && !needLot ? <div style={{ marginTop: 12 }}><Alert tone="danger" title="More than is in stock">Only {num(lot ? lot.qty : onHand, 3)} {item?.uom} {lot ? 'in this lot' : 'here'}.</Alert></div> : null}
    </Modal>
  );
}
