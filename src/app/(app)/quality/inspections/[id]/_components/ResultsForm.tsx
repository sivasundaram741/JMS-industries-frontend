'use client';
// Results form for an open inspection lot: checks (from the item's template), accepted / rejected quantity,
// deviation, defect and remarks.
import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { post } from '@/lib/api';
import { num } from '@/lib/format';
import { Alert, Button, Card, Checkbox, TextAreaField, TextField, Toggle, useToast } from '@/components/ui';

const r3 = (v: number) => Math.round(v * 1000) / 1000;
type Row = { characteristic: string; spec: string; measured: string; ok: boolean };

export function ResultsForm({ lot, inspector, onDone }: { lot: any; inspector: string; onDone: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() => (lot.template || []).map((t: any) => ({ characteristic: t.characteristic, spec: t.spec || '', measured: '', ok: true })));
  const [acc, setAcc] = useState(String(lot.qty));
  const [rej, setRej] = useState('0');
  const [deviation, setDeviation] = useState(false);
  const [defect, setDefect] = useState('');
  const [remarks, setRemarks] = useState('');
  const [who, setWho] = useState(inspector);
  const [busy, setBusy] = useState(false);

  const a = Number(acc) || 0, r = Number(rej) || 0;
  const sumOk = Math.abs(a + r - lot.qty) < 0.0005 && a >= 0 && r >= 0;
  const failed = rows.filter((x) => x.characteristic.trim() && !x.ok).length;
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setAccepted = (v: string) => { setAcc(v); setRej(String(Math.max(0, r3(lot.qty - (Number(v) || 0))))); };
  const setRejected = (v: string) => { setRej(v); setAcc(String(Math.max(0, r3(lot.qty - (Number(v) || 0))))); };
  const status = a === 0 ? 'Rejected' : r > 0 ? 'Partially accepted' : deviation ? 'Accepted w/ deviation' : 'Accepted';

  async function save() {
    setBusy(true);
    try {
      const res = await post(`/quality/inspections/${lot.id}/results`, {
        results: rows.filter((x) => x.characteristic.trim()).map((x) => ({ characteristic: x.characteristic.trim(), spec: x.spec || null, measured: x.measured || null, ok: x.ok })),
        qtyAccepted: a, qtyRejected: r, deviation: r === 0 && deviation ? true : undefined,
        defect: r > 0 ? defect.trim() : undefined, remarks: remarks.trim() || undefined, inspector: who.trim() || undefined,
      });
      toast.ok(`${lot.number} · ${res.status}${res.ncrNo ? ` · ${res.ncrNo} raised for ${num(r)} rejected` : ''}`);
      onDone();
    } catch (e) { toast.err(e); setBusy(false); }
  }

  return (
    <Card title="Record results" sub={`Sample n = ${lot.sampleSize} of ${num(lot.qty)} ${lot.uom} · accepted stock moves to ${lot.type === 'Incoming' ? 'RM Store' : 'FG Store'}`}
      right={<Button size="sm" icon={Plus} onClick={() => setRows([...rows, { characteristic: '', spec: '', measured: '', ok: true }])}>Add check</Button>}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="table-wrap" style={{ border: '1px solid var(--border-default)', borderRadius: 10 }}>
          <table className="tbl">
            <thead><tr><th>Characteristic</th><th>Spec</th><th>Measured</th><th style={{ width: 80 }}>OK</th><th style={{ width: 44 }} /></tr></thead>
            <tbody>
              {rows.map((x, i) => (
                <tr key={i}>
                  <td><input className="input" style={{ height: 36 }} aria-label="Characteristic" value={x.characteristic} onChange={(e) => setRow(i, { characteristic: e.target.value })} placeholder="e.g. Bore Ø80 H7" /></td>
                  <td><input className="input" style={{ height: 36 }} aria-label="Spec" value={x.spec} onChange={(e) => setRow(i, { spec: e.target.value })} placeholder="Spec" /></td>
                  <td><input className="input" style={{ height: 36 }} aria-label="Measured" value={x.measured} onChange={(e) => setRow(i, { measured: e.target.value })} placeholder="Reading" /></td>
                  <td><div className="row" style={{ gap: 8 }}><Toggle on={x.ok} onChange={(v) => setRow(i, { ok: v })} label={`${x.characteristic || 'Check'} OK`} /><span className={'text-xs strong ' + (x.ok ? 'f-success' : 'f-danger')}>{x.ok ? 'OK' : 'NG'}</span></div></td>
                  <td><button type="button" className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Remove check" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={15} /></button></td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={5} className="muted text-sm">No checks · add one or record the quantities only</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="form c3">
          <TextField label={`Accepted (${lot.uom})`} type="number" min={0} value={acc} onChange={setAccepted} />
          <TextField label={`Rejected (${lot.uom})`} type="number" min={0} value={rej} onChange={setRejected} />
          <TextField label="Inspector" value={who} onChange={setWho} />
          {!sumOk ? <div className="full"><Alert tone="danger" title={`Accepted + rejected must add up to the lot quantity (${num(lot.qty)})`} /></div> : null}
          {r > 0 ? <TextField className="span2" label="Defect (required)" value={defect} onChange={setDefect} placeholder="e.g. Journal Ø oversize" /> : null}
          {r === 0 ? <div className="span2" style={{ alignSelf: 'end', paddingBottom: 10 }}><Checkbox checked={deviation} onChange={setDeviation} label="Accepted with deviation (concession)" /></div> : null}
          <div />
          <TextAreaField className="full" label="Remarks" value={remarks} onChange={setRemarks} placeholder="Gauges used, observations…" rows={2} />
        </div>

        {failed > 0 && r === 0 && !deviation ? <Alert tone="warning" title={`${failed} check${failed === 1 ? '' : 's'} not OK`}>Record the rejected quantity, or accept with deviation.</Alert> : null}
        {r > 0 ? <Alert tone="warning" title={`${num(r)} ${lot.uom} rejected · an NCR is raised`}>The rejected pieces stay in QC Hold until the NCR is closed with a disposition.</Alert> : null}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <span className="text-sm secondary">Result: <span className="strong" style={{ color: 'var(--text-primary)' }}>{status}</span></span>
          <Button variant="primary" icon={Save} loading={busy} disabled={!sumOk || (r > 0 && !defect.trim())} onClick={save}>Save results</Button>
        </div>
      </div>
    </Card>
  );
}
