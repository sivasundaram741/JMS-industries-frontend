'use client';
// A manufactured (FG) item: stock by warehouse, and its standard operations and materials that fill new work orders —
// including who supplies what: right-click a row (or use its ⋯ button) to issue a material from our store or buy it
// from a supplier, and to do an operation in our shop or send it outside to a supplier. Different lines can name
// different suppliers. Editable with masters:edit → PUT /items/:id/template
import { useEffect, useState } from 'react';
import { Pencil, Plus, Save } from 'lucide-react';
import { put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { TIME_UNITS, bestUnit, duration, fromMinutes, toMinutes, type TimeUnit } from '@/lib/format';
import { inr, num } from '@/lib/format';
import { Button, Loading, Modal, RowMenuButton, StatStrip, useContextMenu, useToast } from '@/components/ui';
import { SupplierChip, SuppliersSummary, materialMenu, operationMenu, type Vendor } from '@/components/SupplierMenu';

interface Op { name: string; machineId: string; setupMin: string; runMin: string; unit: TimeUnit; doneBy: 'inhouse' | 'outside'; vendorId: number | null; serviceItemId: number | null }
interface Mat { itemId: string; qtyPer: string; source: 'stock' | 'buy'; vendorId: number | null }
const WH = [['RM', 'RM Store'], ['WIP', 'WIP'], ['QC', 'QC Hold'], ['FG', 'FG Store']] as const;

export function TemplateModal({ itemId, open, onClose, onEdit }: { itemId: number | null; open: boolean; onClose: () => void; onEdit: (item: any) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const editable = can('masters', 'edit');
  const { data: it, mutate } = useApi<any>(open && itemId ? `/items/${itemId}` : null);
  const { data: machines } = useApi<any[]>(open ? '/machines' : null);
  const { data: mats } = useApi<any>(open ? '/items?type=RM,BOUGHT,CONSUMABLE&pageSize=200' : null);
  const { data: vendorPage } = useApi<any>(open ? '/vendors?pageSize=200' : null);
  const vendors: Vendor[] = vendorPage?.rows || [];
  const vendorName = (id: number | null) => vendors.find((v) => v.id === id)?.name || null;
  const menu = useContextMenu();
  const [ops, setOps] = useState<Op[]>([]);
  const [materials, setMaterials] = useState<Mat[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!it || it.id !== itemId) return;
    setOps(it.operations.map((o: any) => {
      // Show each row in the largest unit that states it without an odd fraction.
      const unit = bestUnit(Number(o.setupMin) || 0, Number(o.runMin) || 0);
      return {
        name: o.name,
        machineId: o.machineId ? String(o.machineId) : '',
        setupMin: String(fromMinutes(Number(o.setupMin) || 0, unit)),
        runMin: String(fromMinutes(Number(o.runMin) || 0, unit)),
        unit,
        doneBy: o.doneBy === 'outside' ? 'outside' : 'inhouse',
        vendorId: o.vendorId || null,
        serviceItemId: o.serviceItemId || null,
      };
    }));
    setMaterials(it.materials.map((m: any) => ({ itemId: String(m.materialItemId), qtyPer: String(m.qtyPer), source: m.source === 'buy' ? 'buy' : 'stock', vendorId: m.vendorId || null })));
    setDirty(false);
  }, [it, itemId]);

  const setOp = (i: number, p: Partial<Op>) => { setOps((x) => x.map((o, j) => (j === i ? { ...o, ...p } : o))); setDirty(true); };
  const setMat = (i: number, p: Partial<Mat>) => { setMaterials((x) => x.map((m, j) => (j === i ? { ...m, ...p } : m))); setDirty(true); };
  const matItems: any[] = mats?.rows || [];
  const matCost = materials.reduce((a, m) => a + (Number(m.qtyPer) || 0) * (matItems.find((x) => String(x.id) === m.itemId)?.stdCost || 0), 0);
  const minsOf = (o: Op, field: 'setupMin' | 'runMin') => toMinutes(Number(o[field]) || 0, o.unit);
  const runMin = ops.reduce((a, o) => a + minsOf(o, 'runMin'), 0);
  const setupMin = ops.reduce((a, o) => a + minsOf(o, 'setupMin'), 0);
  const valid = ops.every((o) => o.name.trim() && (o.doneBy !== 'outside' || o.vendorId)) && materials.every((m) => m.itemId && Number(m.qtyPer) > 0 && (m.source !== 'buy' || m.vendorId));

  async function save() {
    setBusy(true);
    try {
      await put(`/items/${itemId}/template`, {
        operations: ops.map((o) => ({
          name: o.name.trim(), machineId: o.machineId && o.doneBy !== 'outside' ? Number(o.machineId) : null, setupMin: minsOf(o, 'setupMin'), runMin: minsOf(o, 'runMin'),
          doneBy: o.doneBy, vendorId: o.doneBy === 'outside' ? o.vendorId : null, serviceItemId: o.doneBy === 'outside' ? o.serviceItemId : null,
        })),
        materials: materials.map((m) => ({ itemId: Number(m.itemId), qtyPer: Number(m.qtyPer), source: m.source, vendorId: m.source === 'buy' ? m.vendorId : null })),
      });
      toast.ok(`${it.code} plan saved · new work orders use these operations, materials and suppliers`);
      await mutate();
      setDirty(false);
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  const stockQty = (wh: string) => it?.stock.find((s: any) => s.warehouse === wh)?.qty || 0;
  const opMenu = (o: Op, i: number) => (e: React.MouseEvent) => menu.open(e, o.name || `Operation ${(i + 1) * 10}`, operationMenu({
    doneBy: o.doneBy, vendorId: o.vendorId, vendorName: vendorName(o.vendorId), vendors, editable,
    onInhouse: () => setOp(i, { doneBy: 'inhouse', vendorId: null, serviceItemId: null }),
    // A different supplier may bill it as a different service, so the service is worked out again on save
    onOutside: (v) => setOp(i, { doneBy: 'outside', vendorId: v, serviceItemId: o.doneBy === 'outside' && o.vendorId === v ? o.serviceItemId : null, machineId: '' }),
    onRemove: () => { setOps((x) => x.filter((_, j) => j !== i)); setDirty(true); },
  }));
  const matMenu = (m: Mat, i: number) => (e: React.MouseEvent) => menu.open(e, matItems.find((x) => String(x.id) === m.itemId)?.name || `Material ${i + 1}`, materialMenu({
    source: m.source, vendorId: m.vendorId, vendorName: vendorName(m.vendorId), vendors, editable,
    onStore: () => setMat(i, { source: 'stock', vendorId: null }),
    onBuy: (v) => setMat(i, { source: 'buy', vendorId: v }),
    onRemove: () => { setMaterials((x) => x.filter((_, j) => j !== i)); setDirty(true); },
  }));
  const plan = [
    ...materials.filter((m) => m.source === 'buy').map((m) => ({ vendorName: vendorName(m.vendorId), kind: 'buy' as const, what: matItems.find((x) => String(x.id) === m.itemId)?.name || 'a component' })),
    ...ops.filter((o) => o.doneBy === 'outside').map((o) => ({ vendorName: vendorName(o.vendorId), kind: 'outside' as const, what: o.name || 'an operation' })),
  ];
  return (
    <Modal open={open} onClose={onClose} wide title={it ? `${it.name}` : 'Item'} sub={it ? `${it.code} · finished good · HSN ${it.hsn || '—'} · std cost ${inr(it.stdCost)} · sale ${inr(it.salePrice)}` : undefined}
      footer={<>
        {editable && it ? <Button icon={Pencil} onClick={() => onEdit(it)}>Edit item details</Button> : null}
        <div className="spacer" />
        <Button onClick={onClose}>{dirty ? 'Discard' : 'Close'}</Button>
        {editable ? <Button variant="primary" icon={Save} loading={busy} disabled={!dirty || !valid} onClick={save}>Save operations & materials</Button> : null}
      </>}>
      {!it || it.id !== itemId ? <Loading rows={6} /> : (
        <div className="stack" style={{ gap: 18 }}>
          <StatStrip items={[...WH.map(([k, l]) => ({ label: l, value: `${num(stockQty(k))} ${it.uom}`, color: k === 'FG' && it.reorderLevel && stockQty('FG') < it.reorderLevel ? ('danger' as const) : undefined })), { label: 'Reorder level', value: it.reorderLevel ? num(it.reorderLevel) : '—' }]} />

          <div>
            <div className="row between" style={{ marginBottom: 8 }}>
              <div><div className="h4">Standard operations</div><div className="text-xs muted">In routing order · right-click a row to do it in our shop or send it outside to a supplier</div></div>
              <div className="text-xs muted" style={{ textAlign: 'right' }}>
                <div><span className="strong">{duration(runMin)}</span> run per piece</div>
                <div>{setupMin ? `${duration(setupMin)} setup per batch` : 'no setup time'}</div>
              </div>
            </div>
            <div className="card lines-table" style={{ boxShadow: 'none' }}>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th style={{ width: 44 }}>Seq</th><th>Operation</th><th>Done by</th><th>Machine</th><th>Time in</th><th className="r">Setup</th><th className="r">Run / pc</th><th className="r">Run per piece</th><th /></tr></thead>
                  <tbody>
                    {ops.map((o, i) => (
                      <tr key={i} className="has-menu" onContextMenu={opMenu(o, i)}>
                        <td className="muted num">{(i + 1) * 10}</td>
                        <td><input className="input" aria-label={`Operation ${i + 1} name`} value={o.name} disabled={!editable} placeholder="e.g. Welding" onChange={(e) => setOp(i, { name: e.target.value })} /></td>
                        <td><SupplierChip kind={o.doneBy} name={vendorName(o.vendorId)} onClick={opMenu(o, i)} /></td>
                        <td>
                          <select className="select" style={{ minWidth: 150 }} aria-label={`Machine for operation ${i + 1}`} value={o.machineId} disabled={!editable || o.doneBy === 'outside'} onChange={(e) => setOp(i, { machineId: e.target.value })}>
                            <option value="">{o.doneBy === 'outside' ? 'At the supplier' : 'Any machine'}</option>
                            {(machines || []).map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <select className="select" style={{ width: 112 }} aria-label={`Time unit for operation ${i + 1}`} value={o.unit} disabled={!editable}
                            onChange={(e) => {
                              // Keep the real duration: re-express it in the newly chosen unit.
                              const next = e.target.value as TimeUnit;
                              setOp(i, {
                                unit: next,
                                setupMin: String(fromMinutes(minsOf(o, 'setupMin'), next)),
                                runMin: String(fromMinutes(minsOf(o, 'runMin'), next)),
                              });
                            }}>
                            {TIME_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        </td>
                        <td className="r"><input className="input num" style={{ width: 80, textAlign: 'right' }} aria-label={`Setup time for operation ${i + 1}`} type="number" min={0} step="any" value={o.setupMin} disabled={!editable} onChange={(e) => setOp(i, { setupMin: e.target.value })} /></td>
                        <td className="r"><input className="input num" style={{ width: 80, textAlign: 'right' }} aria-label={`Run time per piece for operation ${i + 1}`} type="number" min={0} step="any" value={o.runMin} disabled={!editable} onChange={(e) => setOp(i, { runMin: e.target.value })} /></td>
                        <td className="r"><span className="text-xs muted nowrap">{duration(minsOf(o, 'runMin'))}</span></td>
                        <td className="r"><RowMenuButton label={`Options for ${o.name || 'operation ' + (i + 1) * 10}`} onClick={opMenu(o, i)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!ops.length ? <div className="empty text-sm" style={{ padding: 16 }}>No operations yet</div> : null}
              </div>
              {editable ? <div className="tfoot"><Button size="sm" icon={Plus} onClick={() => { setOps((x) => [...x, { name: '', machineId: '', setupMin: '0', runMin: '0', unit: 'min', doneBy: 'inhouse', vendorId: null, serviceItemId: null }]); setDirty(true); }}>Add operation</Button></div> : null}
            </div>
          </div>

          <div>
            <div className="row between" style={{ marginBottom: 8 }}>
              <div><div className="h4">Materials per piece</div><div className="text-xs muted">Right-click a row to issue it from our store or buy it for each job from a supplier</div></div>
              <span className="text-xs muted">Material cost {inr(matCost, 2)} / pc</span>
            </div>
            <div className="card lines-table" style={{ boxShadow: 'none' }}>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Material</th><th>Comes from</th><th className="r">Qty per piece</th><th>Unit</th><th className="r">Cost / pc</th><th /></tr></thead>
                  <tbody>
                    {materials.map((m, i) => {
                      const mi = matItems.find((x) => String(x.id) === m.itemId);
                      return (
                        <tr key={i} className="has-menu" onContextMenu={matMenu(m, i)}>
                          <td>
                            <select className="select" aria-label={`Material ${i + 1}`} value={m.itemId} disabled={!editable} onChange={(e) => setMat(i, { itemId: e.target.value })}>
                              <option value="">Choose a material…</option>
                              {matItems.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
                            </select>
                          </td>
                          <td><SupplierChip kind={m.source} name={vendorName(m.vendorId)} onClick={matMenu(m, i)} /></td>
                          <td className="r"><input className="input num" style={{ width: 110, textAlign: 'right' }} aria-label="Quantity per piece" type="number" min={0} step="any" value={m.qtyPer} disabled={!editable} onChange={(e) => setMat(i, { qtyPer: e.target.value })} /></td>
                          <td className="muted">{mi?.uom || '—'}</td>
                          <td className="r num">{mi ? inr((Number(m.qtyPer) || 0) * mi.stdCost, 2) : '—'}</td>
                          <td className="r"><RowMenuButton label={`Options for ${mi?.name || 'material ' + (i + 1)}`} onClick={matMenu(m, i)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!materials.length ? <div className="empty text-sm" style={{ padding: 16 }}>No materials yet</div> : null}
              </div>
              {editable ? <div className="tfoot"><Button size="sm" icon={Plus} onClick={() => { setMaterials((x) => [...x, { itemId: '', qtyPer: '', source: 'stock', vendorId: null }]); setDirty(true); }}>Add material</Button></div> : null}
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 8 }}><div className="h4">Suppliers for this product</div><div className="text-xs muted">Each job for it raises one order per supplier from this plan</div></div>
            <SuppliersSummary lines={plan} empty="Everything is made in our shop from our own store · right-click a material or operation to bring in a supplier." />
          </div>
        </div>
      )}
      {menu.node}
    </Modal>
  );
}
