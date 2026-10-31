'use client';
// Dialogs on the work order page: issue material, record production, move to quality, material QC.
import { useMemo, useState } from 'react';
import { patch, post } from '@/lib/api';
import { addDaysIso, dateShort, num, todayIso } from '@/lib/format';
import { Alert, Badge, Button, Checkbox, Modal, SelectField, TextField, useToast } from '@/components/ui';

const r3 = (v: number) => Math.round(v * 1000) / 1000;
type Done = (wo: any) => void;

// Material issue · RM Store → shop floor (WIP)
export function IssueDialog({ wo, onClose, onDone }: { wo: any; onClose: () => void; onDone: Done }) {
  const toast = useToast();
  const [qty, setQty] = useState<Record<number, string>>(() =>
    Object.fromEntries(wo.materials.map((m: any) => [m.id, String(r3(Math.max(0, Math.min(m.qtyRequired - m.qtyIssued, m.stockAvailable))))])));
  const [busy, setBusy] = useState(false);
  const lines = wo.materials.map((m: any) => ({ materialId: m.id, qty: Number(qty[m.id]) || 0 })).filter((l: any) => l.qty > 0);
  const over = wo.materials.some((m: any) => (Number(qty[m.id]) || 0) > m.stockAvailable + 0.0005);
  const failMats = wo.materials.filter((m: any) => m.qcStatus === 'Fail');

  async function save() {
    setBusy(true);
    try {
      const r = await post(`/work-orders/${wo.id}/issue`, { lines });
      toast.ok(`Material issued to ${wo.number} · ${lines.length} item${lines.length === 1 ? '' : 's'} moved to shop floor`);
      onDone(r);
    } catch (e) { toast.err(e); setBusy(false); }
  }

  return (
    <Modal open wide onClose={onClose} title="Issue Material" sub={`RM Store → shop floor for ${wo.number} · oldest lot first`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!lines.length || over} onClick={save}>Issue {lines.length ? lines.length + ' item' + (lines.length === 1 ? '' : 's') : ''}</Button></>}>
      <div className="stack" style={{ gap: 12 }}>
        {failMats.length > 0 && (
          <Alert tone="danger" title={`${failMats.length} material${failMats.length === 1 ? '' : 's'} failed QC`}>
            {failMats.map((m: any) => m.itemName).join(', ')} — complete QC before issuing.
          </Alert>
        )}
        <div className="table-wrap" style={{ border: '1px solid var(--border-default)', borderRadius: 6 }}>
          <table className="tbl">
            <thead>
              <tr><th>Material</th><th>QC</th><th className="r">Required</th><th className="r">Issued</th><th className="r">In RM Store</th><th className="r">Qty to issue</th></tr>
            </thead>
            <tbody>
              {wo.materials.map((m: any) => {
                const q = Number(qty[m.id]) || 0, bad = q > m.stockAvailable + 0.0005;
                return (
                  <tr key={m.id}>
                    <td><div className="two"><div className="a">{m.itemName}</div><div className="b">{m.itemCode}</div></div></td>
                    <td>
                      <Badge tone={m.qcStatus === 'Pass' ? 'success' : m.qcStatus === 'Fail' ? 'danger' : 'neutral'} dot={false}>
                        {m.qcStatus || 'Pending'}
                      </Badge>
                    </td>
                    <td className="r num">{num(m.qtyRequired, 3)} {m.uom}</td>
                    <td className="r num">{num(m.qtyIssued, 3)}</td>
                    <td className={'r num' + (m.stockAvailable < m.qtyRequired - m.qtyIssued ? ' f-danger strong' : '')}>{num(m.stockAvailable, 3)}</td>
                    <td className="r">
                      <input className="cell num" type="number" min={0} step="any" aria-label={`Qty of ${m.itemName}`} value={qty[m.id] ?? ''} onChange={(e) => setQty({ ...qty, [m.id]: e.target.value })} style={bad ? { borderColor: 'var(--danger-solid)' } : undefined} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {over ? <Alert tone="danger" title="More than stock in RM Store">Lower the highlighted quantities or receive more stock first.</Alert>
          : <div className="text-xs muted">Quantities default to what is still to issue, limited by RM Store stock. Leave 0 to skip.</div>}
      </div>
    </Modal>
  );
}

// Record production against one operation — with notes
export function RecordDialog({ wo, machines, onClose, onDone, defaultDate }: { wo: any; machines: any[]; onClose: () => void; onDone: Done; defaultDate?: string }) {
  const toast = useToast();
  const ops: any[] = wo.operations;
  const firstOpen = Math.max(0, ops.findIndex((o) => o.status !== 'Done' && o.qtyDone < wo.qtyPlanned - 0.0005));
  const capOf = (i: number) => r3((i === 0 ? wo.qtyPlanned : ops[i - 1].qtyDone) - ops[i].qtyDone);
  const operatorOf = (o: any) => machines.find((m) => m.id === (o?.machineId || wo.machineId))?.operator || '';
  const [f, setF] = useState(() => ({
    operationId: String(ops[firstOpen]?.id || ''), qtyGood: String(Math.max(0, capOf(firstOpen))), qtyScrap: '0', downtimeMin: '0', runHours: '',
    shift: wo.shift || 'A', operator: operatorOf(ops[firstOpen]), entryDate: defaultDate || todayIso(), notes: '',
  }));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const idx = ops.findIndex((o) => String(o.id) === f.operationId);
  const op = ops[idx];
  const cap = idx >= 0 ? capOf(idx) : 0;
  const good = Number(f.qtyGood) || 0, scrap = Number(f.qtyScrap) || 0;
  const tooMany = good > cap + 0.0005;

  function pickOp(v: string) {
    const i = ops.findIndex((o) => String(o.id) === v);
    setF({ ...f, operationId: v, qtyGood: String(Math.max(0, capOf(i))), operator: f.operator || operatorOf(ops[i]) });
  }

  async function save() {
    setBusy(true);
    try {
      const r = await post(`/work-orders/${wo.id}/production`, {
        operationId: Number(f.operationId), qtyGood: good, qtyScrap: scrap,
        downtimeMin: Math.round(Number(f.downtimeMin) || 0), runHours: Number(f.runHours) || 0,
        shift: f.shift, operator: f.operator || undefined, entryDate: f.entryDate || undefined, notes: f.notes || undefined,
      });
      toast.ok(`Op ${op.seq} · ${num(good)} good${scrap ? ' · ' + num(scrap) + ' scrap' : ''} recorded`);
      onDone(r);
    } catch (e) { toast.err(e); setBusy(false); }
  }

  return (
    <Modal open wide onClose={onClose} title="Record Production" sub={`${wo.number} · ${wo.itemName} · good pieces, scrap and downtime`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!op || good + scrap <= 0 || tooMany} onClick={save}>Save Entry</Button></>}>
      <div className="form c3">
        <SelectField className="span2" label="Operation" value={f.operationId} onChange={pickOp}
          options={ops.map((o) => ({ value: o.id, label: `Op ${o.seq} · ${o.name} · ${num(o.qtyDone)} / ${num(wo.qtyPlanned)}${o.status === 'Done' || o.qtyDone >= wo.qtyPlanned - 0.0005 ? ' · ✓ done' : ''}` }))} />
        <TextField label="Date" type="date" value={f.entryDate} onChange={set('entryDate')} />
        <TextField label="Good qty" type="number" min={0} value={f.qtyGood} onChange={set('qtyGood')}
          hint={op ? (tooMany ? undefined : `Up to ${num(cap)} more${idx > 0 ? ` · ${num(ops[idx - 1].qtyDone)} have finished Op ${ops[idx - 1].seq}` : ''}`) : undefined} />
        <TextField label="Scrap qty" type="number" min={0} value={f.qtyScrap} onChange={set('qtyScrap')} />
        <TextField label="Downtime (min)" type="number" min={0} value={f.downtimeMin} onChange={set('downtimeMin')} />
        <TextField label="Run hours" type="number" min={0} step="0.1" value={f.runHours} onChange={set('runHours')} placeholder="e.g. 7.5" />
        <SelectField label="Shift" value={f.shift} onChange={set('shift')} options={['A', 'B', 'C'].map((s) => ({ value: s, label: 'Shift ' + s }))} />
        <TextField label="Operator" value={f.operator} onChange={set('operator')} placeholder="Operator name" />
        <TextField className="span3" label="Progress note (optional)" value={f.notes} onChange={set('notes')} placeholder="e.g. First piece approved · tool changed after 50 pcs" />
        {tooMany ? <div className="full"><Alert tone="danger" title={`Only ${num(cap)} more can be recorded on Op ${op.seq}`}>{idx === 0 ? `${num(wo.qtyPlanned)} planned.` : `Cannot exceed previous operation's output.`}</Alert></div> : null}
        {op?.machineCode ? <div className="full text-xs muted">Recorded on {op.machineCode}.</div> : null}
      </div>
    </Modal>
  );
}

// Material QC · inspect a raw material line before or after issuing to shop floor
export function MaterialQcDialog({ wo, material, onClose, onDone }: { wo: any; material: any; onClose: () => void; onDone: Done }) {
  const toast = useToast();
  const [f, setF] = useState({
    status: material.qcStatus || 'Pending',
    inspector: material.qcInspector || '',
    date: material.qcDate || todayIso(),
    qtyOk: String(material.qcQtyOk > 0 ? material.qcQtyOk : (material.qtyIssued || material.qtyRequired || '')),
    qtyFail: String(material.qcQtyFail || 0),
    note: material.qcNote || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  async function save() {
    setBusy(true);
    try {
      const r = await patch(`/work-orders/${wo.id}/materials/${material.id}/qc`, {
        status: f.status, inspector: f.inspector || undefined, date: f.date || undefined,
        qtyOk: Number(f.qtyOk) || 0, qtyFail: Number(f.qtyFail) || 0, note: f.note || undefined,
      });
      toast.ok(`Material QC saved: ${f.status}`);
      onDone(r);
    } catch (e) { toast.err(e); setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Log Material QC"
      sub={`${material.itemName} · ${material.itemCode} · ${num(material.qtyRequired, 3)} ${material.uom} required`}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={f.status === 'Pass' ? 'success' : f.status === 'Fail' ? 'danger' : 'primary'} loading={busy} onClick={save}>
          {f.status === 'Pass' ? '✓ Save Pass' : f.status === 'Fail' ? '✗ Save Fail' : 'Save QC'}
        </Button>
      </>}>
      <div className="form c2">
        <SelectField className="span2" label="QC Result" value={f.status} onChange={set('status')} options={[
          { value: 'Pending', label: 'Pending — not yet inspected' },
          { value: 'Pass', label: '✓ Pass — material approved for production' },
          { value: 'Fail', label: '✗ Fail — material rejected, do not issue' },
        ]} />
        <TextField label="Inspector name" value={f.inspector} onChange={set('inspector')} placeholder="Name of inspector" />
        <TextField label="Inspection date" type="date" value={f.date} onChange={set('date')} />
        <TextField label={`Qty OK (${material.uom})`} type="number" min={0} step="any" value={f.qtyOk} onChange={set('qtyOk')} />
        <TextField label={`Qty Rejected (${material.uom})`} type="number" min={0} step="any" value={f.qtyFail} onChange={set('qtyFail')} />
        <TextField className="span2" label="Defect / Remarks" value={f.note} onChange={set('note')} placeholder="e.g. Surface cracks on 3 pcs · EN8 cert not matching heat no." />
      </div>
    </Modal>
  );
}

// Move finished pieces to quality · optionally split what is left into a new work order
export function MoveDialog({ wo, machines, onClose, onDone }: { wo: any; machines: any[]; onClose: () => void; onDone: Done }) {
  const toast = useToast();
  const waiting = r3(wo.qtyCompleted - wo.qtyToQc);
  const remaining = r3(Math.max(0, wo.qtyPlanned - wo.qtyCompleted));
  const [qty, setQty] = useState(String(waiting));
  const [split, setSplit] = useState(false);
  const [due, setDue] = useState(() => addDaysIso(wo.dueDate || todayIso(), 2));
  const [machineId, setMachineId] = useState(String(wo.machineId || ''));
  const [busy, setBusy] = useState(false);
  const q = Number(qty) || 0;
  const after = useMemo(() => r3(wo.qtyPlanned - wo.qtyToQc - q), [wo, q]);

  async function save() {
    setBusy(true);
    try {
      const r = await post(`/work-orders/${wo.id}/move-to-quality`, { qty: q, ...(split ? { splitRemaining: true, splitDueDate: due || undefined, splitMachineId: machineId ? Number(machineId) : undefined } : {}) });
      const lot = r.workOrder?.inspections?.[r.workOrder.inspections.length - 1];
      toast.ok(`${num(q)} ${wo.uom} moved to quality${lot ? ' · ' + lot.number : ''}${r.splitNo ? ` · ${r.splitNo} created` : ''}`);
      onDone(r.workOrder);
    } catch (e) { toast.err(e); setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Move to Quality" sub={`Finished pieces → QC Hold with inspection lot · ${num(waiting)} ${wo.uom} waiting`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={q <= 0 || q > waiting + 0.0005} onClick={save}>{split ? 'Move and split' : 'Move to quality'}</Button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <TextField label={`Quantity (${wo.uom})`} type="number" min={0} value={qty} onChange={setQty} hint={q > waiting + 0.0005 ? undefined : `${num(wo.qtyCompleted)} completed · ${num(wo.qtyToQc)} already in quality`} />
        {q > waiting + 0.0005 ? <Alert tone="danger" title={`Only ${num(waiting)} finished pieces are waiting`} /> : null}
        {remaining > 0 ? (
          <div className="stack" style={{ gap: 12, padding: 14, border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--bg-subtle)' }}>
            <Checkbox checked={split} onChange={setSplit} label={<span><span className="strong">Split the remaining {num(remaining)} into a new work order</span><br /><span className="text-xs muted">This work order re-plans to {num(wo.qtyCompleted)} and closes once they pass quality</span></span>} />
            {split ? (
              <div className="form c2">
                <TextField label="New due date" type="date" value={due} onChange={setDue} />
                <SelectField label="Machine" value={machineId} onChange={setMachineId} placeholder="Same as routing" options={machines.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}${m.status !== 'Running' && m.status !== 'Idle' ? ' · ' + m.status.toLowerCase() : ''}` }))} />
              </div>
            ) : null}
          </div>
        ) : null}
        {!split && q > 0 && q <= waiting + 0.0005 ? (
          <div className="text-xs muted">{after > 0.0005 ? `Partial · ${num(after)} ${wo.uom} remain on ${wo.number}` : `All ${num(wo.qtyPlanned)} in quality · ${wo.number} completes`}</div>
        ) : null}
      </div>
    </Modal>
  );
}
