'use client';
// Receive goods against a purchase order: one row per open line → POST /purchase-orders/:id/receive (creates a GRN)
import { useEffect, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { post } from '@/lib/api';
import { num, todayIso } from '@/lib/format';
import { Alert, Button, Modal, TextField, useToast } from '@/components/ui';

interface Row { poLineId: number; qty: string; lotNo: string }

export function ReceiveModal({ po, open, onClose, onDone }: { po: any; open: boolean; onClose: () => void; onDone: (r: { grnId: number; purchaseOrder: any }) => void }) {
  const toast = useToast();
  const openLines = (po?.lines || []).filter((l: any) => l.qty - l.qtyReceived > 0.0005);
  const [rows, setRows] = useState<Row[]>([]);
  const [f, setF] = useState({ receivedDate: todayIso(), vendorInvoiceNo: '', vehicleNo: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !po) return;
    setRows(openLines.map((l: any) => ({ poLineId: l.id, qty: String(+(l.qty - l.qtyReceived).toFixed(3)), lotNo: '' })));
    setF({ receivedDate: todayIso(), vendorInvoiceNo: '', vehicleNo: '' });
  }, [open, po?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (poLineId: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.poLineId === poLineId ? { ...r, ...patch } : r)));
  const openOf = (poLineId: number) => { const l = openLines.find((x: any) => x.id === poLineId); return l ? l.qty - l.qtyReceived : 0; };
  const lines = rows.filter((r) => Number(r.qty) > 0 && openLines.some((l: any) => l.id === r.poLineId));
  const over = lines.some((r) => Number(r.qty) > openOf(r.poLineId) + 0.0005);
  const service = po?.type === 'JOB_WORK';

  async function save() {
    setBusy(true);
    try {
      const r = await post<{ grnId: number; purchaseOrder: any }>(`/purchase-orders/${po.id}/receive`, {
        receivedDate: f.receivedDate || undefined, vendorInvoiceNo: f.vendorInvoiceNo || undefined, vehicleNo: f.vehicleNo || undefined,
        lines: lines.map((x) => ({ poLineId: x.poLineId, qty: Number(x.qty), lotNo: x.lotNo.trim() || undefined })),
      });
      const grn = r.purchaseOrder.grns.find((g: any) => g.id === r.grnId);
      toast.ok(`${grn?.number || 'GRN'} created · ${r.purchaseOrder.status.toLowerCase()} · incoming inspection raised`);
      onDone(r);
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={`Receive goods · ${po?.number || ''}`} sub={`${po?.vendorName || ''} · stock goes to QC Hold and an incoming inspection lot is raised per line`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={PackagePlus} loading={busy} disabled={!lines.length || over} onClick={save}>Create GRN</Button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="form c3">
          <TextField label="Vendor invoice no" value={f.vendorInvoiceNo} onChange={(v) => setF({ ...f, vendorInvoiceNo: v })} placeholder="e.g. JSW/SLM/44871" />
          <TextField label="Vehicle no" value={f.vehicleNo} onChange={(v) => setF({ ...f, vehicleNo: v.toUpperCase() })} placeholder="TN 30 AR 1182" />
          <TextField label="Received on" type="date" value={f.receivedDate} onChange={(v) => setF({ ...f, receivedDate: v })} />
        </div>
        {openLines.length ? (
          <div className="card lines-table" style={{ boxShadow: 'none' }}>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Item</th><th className="r">Ordered</th><th className="r">Open</th><th className="r">Receive now</th><th>Lot / heat no</th></tr></thead>
                <tbody>
                  {openLines.map((l: any) => {
                    const openQty = l.qty - l.qtyReceived;
                    const row = rows.find((r) => r.poLineId === l.id);
                    const bad = Number(row?.qty) > openQty + 0.0005;
                    return (
                      <tr key={l.id}>
                        <td><div className="two"><div className="a">{l.itemName}</div><div className="b">{l.itemCode}</div></div></td>
                        <td className="r num">{num(l.qty, 3)} {l.uom}</td>
                        <td className="r num strong">{num(openQty, 3)}</td>
                        <td className="r">
                          <input className="input num" style={{ width: 120, textAlign: 'right', borderColor: bad ? 'var(--danger-solid)' : undefined }} aria-label={`Quantity to receive for ${l.itemName}`} type="number" min={0} max={openQty} step="any" value={row?.qty ?? ''} onChange={(e) => set(l.id, { qty: e.target.value })} />
                        </td>
                        <td><input className="input" style={{ width: 160 }} aria-label={`Lot number for ${l.itemName}`} placeholder="Auto" value={row?.lotNo ?? ''} onChange={(e) => set(l.id, { lotNo: e.target.value })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : <Alert tone="success" title="Everything on this order has been received" />}
        {over ? <Alert tone="danger" title="More than the open quantity">A line can take at most its open quantity.</Alert> : null}
        {service ? <Alert tone="info" title="Job work coming back">The GRN records the processed pieces returned by the vendor and raises their incoming inspection.</Alert> : null}
        <div className="text-xs muted">Leave the lot blank to number it after the GRN.</div>
      </div>
    </Modal>
  );
}
