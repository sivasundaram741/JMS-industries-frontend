'use client';
// Two ways to set stock by hand, both posting to POST /stock/adjust:
//   adjust  - + or - a quantity after a count, damage or a correction
//   opening - the quantity already on the shelf when the books started, posted
//             as an OPENING movement so the ledger can tell it from a correction
import { useEffect, useId, useState } from 'react';
import { PackagePlus, SlidersHorizontal } from 'lucide-react';
import { post, qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { num } from '@/lib/format';
import { Alert, Button, Field, Modal, SelectField, TextField, useToast } from '@/components/ui';

const EMPTY = { itemId: '', warehouse: 'RM', lotNo: '', qty: '', note: '' };

export function AdjustModal({
  open, onClose, onDone, fixedItem, fixedWarehouse, mode = 'adjust',
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  /** 'opening' records what was already in stock; 'adjust' corrects what is there. */
  mode?: 'adjust' | 'opening';
  /** Adjust this item only - the picker is replaced by its name. */
  fixedItem?: { id: number; code: string; name: string; uom: string } | null;
  /** Lock the warehouse too, e.g. a work order's materials live in RM. */
  fixedWarehouse?: string;
}) {
  const toast = useToast();
  const listId = useId();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ ...EMPTY, itemId: fixedItem ? String(fixedItem.id) : '', warehouse: fixedWarehouse || EMPTY.warehouse });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedItem?.id, fixedWarehouse]);
  const set = (k: keyof typeof EMPTY) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  // Only fetch the item list when the user has to choose from it.
  const { data: items } = useApi<any>(open && !fixedItem ? '/items?type=FG,RM,BOUGHT,CONSUMABLE&pageSize=200' : null);
  const { data: whs } = useApi<any[]>(open && !fixedWarehouse ? '/warehouses' : null);
  const item = fixedItem || (items?.rows || []).find((i: any) => String(i.id) === f.itemId);
  const { data: lots } = useApi<any[]>(open && item ? '/stock/lots' + qs({ warehouse: f.warehouse, search: item.code }) : null);
  const itemLots = (lots || []).filter((l) => l.itemId === item?.id);
  const onHand = itemLots.reduce((a, l) => a + l.qty, 0);
  const lot = itemLots.find((l) => (l.lotNo || '') === f.lotNo.trim());
  const qty = Number(f.qty) || 0;
  const opening = mode === 'opening';
  const needLot = qty < 0 && itemLots.some((l) => l.lotNo) && !lot;
  const tooMuch = qty < 0 && -qty > (lot ? lot.qty : onHand) + 0.0005;
  // An opening balance is what was already there, so it can only be positive.
  const negativeOpening = opening && qty < 0;
  const valid = !!item && qty !== 0 && f.note.trim().length >= 3 && !needLot && !tooMuch && !negativeOpening;

  async function save() {
    setBusy(true);
    try {
      await post('/stock/adjust', { itemId: item.id, warehouse: f.warehouse, lotNo: f.lotNo.trim() || undefined, qty, note: f.note.trim(), opening });
      toast.ok(`${opening ? 'Opening balance' : 'Adjustment'} · ${item.name} ${qty > 0 ? '+' : ''}${num(qty, 3)} ${item.uom} in ${f.warehouse}`);
      onDone();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose}
      title={opening ? 'Opening stock balance' : 'Adjust stock'}
      sub={opening
        ? 'What was already on the shelf before this system started counting · it lands in the ledger as an opening balance'
        : 'For counts, damage or corrections · every adjustment is posted to the stock ledger with your reason'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={opening ? PackagePlus : SlidersHorizontal} loading={busy} disabled={!valid} onClick={save}>{opening ? 'Post opening balance' : 'Post adjustment'}</Button></>}>
      <div className="form c2">
        {fixedItem ? (
          <Field className="full" label="Item">
            {() => <div className="input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)' }}>{fixedItem.code} · {fixedItem.name}</div>}
          </Field>
        ) : (
          <SelectField className="full" label="Item" value={f.itemId} onChange={(v) => setF((x) => ({ ...x, itemId: v, lotNo: '' }))} placeholder="Choose an item…"
            options={(items?.rows || []).map((i: any) => ({ value: i.id, label: `${i.code} · ${i.name}` }))} />
        )}
        {fixedWarehouse ? (
          <Field label="Warehouse" hint={item ? `${num(onHand, 3)} ${item.uom} on hand here` : undefined}>
            {() => <div className="input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)' }}>{fixedWarehouse}</div>}
          </Field>
        ) : (
          <SelectField label="Warehouse" value={f.warehouse} onChange={(v) => setF((x) => ({ ...x, warehouse: v, lotNo: '' }))}
            options={(whs || [{ code: 'RM', name: 'RM Store' }, { code: 'WIP', name: 'WIP' }, { code: 'QC', name: 'QC Hold' }, { code: 'FG', name: 'FG Store' }]).map((w: any) => ({ value: w.code, label: w.name }))}
            hint={item ? `${num(onHand, 3)} ${item.uom} on hand here` : undefined} />
        )}
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
