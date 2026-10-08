'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { dateShort, num, todayIso } from '@/lib/format';
import { Alert, Button, Card, DataTable, Modal, PageHeader, SelectField, StatStrip, TextField, Two, useToast } from '@/components/ui';
import { ComboField } from '@/components/ui/ComboField';

function shiftDay(iso: string, d: number) {
  const dt = new Date(iso + 'T00:00:00');
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

const SHIFTS = [
  { value: 'A', label: 'Shift A' },
  { value: 'B', label: 'Shift B' },
  { value: 'C', label: 'Shift C' },
];

const blank = () => ({
  workOrderId: '', workOrderNo: '', operationId: '',
  entryDate: todayIso(), shift: 'A', operator: '',
  qtyGood: '', qtyScrap: '0', downtimeMin: '0', runHours: '',
});

export default function ProductionLogPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todayIso());
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState(blank());
  const [ops, setOps] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading } = useApi<any>(`/production-entries?date=${date}&pageSize=100&_k=${refreshKey}`);
  const rows = data?.rows || [];
  const totalGood = rows.reduce((a: number, r: any) => a + r.qtyGood, 0);
  const totalScrap = rows.reduce((a: number, r: any) => a + r.qtyScrap, 0);
  const totalDown = rows.reduce((a: number, r: any) => a + r.downtimeMin, 0);
  const scrapRate = totalGood + totalScrap > 0 ? (totalScrap / (totalGood + totalScrap)) * 100 : 0;

  const { data: woDetail } = useApi<any>(f.workOrderId ? `/work-orders/${f.workOrderId}` : null);
  useEffect(() => {
    if (woDetail) {
      setOps(woDetail.operations || []);
      setF(x => ({ ...x, operationId: '' }));
    } else {
      setOps([]);
    }
  }, [woDetail]);

  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  const validationMsg = tried && (!f.workOrderId ? 'Select a work order.'
    : !f.operationId ? 'Select an operation.'
    : !(Number(f.qtyGood) > 0) ? 'Enter a good quantity greater than zero.'
    : null);

  async function save() {
    setTried(true);
    if (!f.workOrderId || !f.operationId || !(Number(f.qtyGood) > 0)) return;
    setBusy(true);
    try {
      await post(`/work-orders/${f.workOrderId}/production`, {
        operationId: Number(f.operationId), entryDate: f.entryDate, shift: f.shift || undefined,
        operator: f.operator || undefined, qtyGood: Number(f.qtyGood), qtyScrap: Number(f.qtyScrap) || 0,
        downtimeMin: Number(f.downtimeMin) || 0, runHours: Number(f.runHours) || 0,
      });
      toast.ok('Entry saved');
      setShowAdd(false);
      setF(blank());
      setTried(false);
      setRefreshKey(k => k + 1);
    } catch (e) { toast.err(e); }
    finally { setBusy(false); }
  }

  function openAdd() { setF({ ...blank(), entryDate: date }); setTried(false); setOps([]); setShowAdd(true); }

  const isToday = date === todayIso();

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Entries' }, { label: 'Production Log' }]}
        title="Production Log"
        sub="Record daily output for each work order and operation"
        actions={can('wo', 'edit') ? <Button variant="primary" icon={Plus} onClick={openAdd}>Add Entry</Button> : null}
      />

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <button type="button" className="icon-btn" onClick={() => setDate(d => shiftDay(d, -1))}><ChevronLeft size={16} /></button>
        <span className="strong" style={{ minWidth: 130, textAlign: 'center' }}>{isToday ? `Today · ${dateShort(date)}` : dateShort(date)}</span>
        <button type="button" className="icon-btn" onClick={() => setDate(d => shiftDay(d, 1))} disabled={isToday}><ChevronRight size={16} /></button>
        {!isToday && <button type="button" className="btn xs" onClick={() => setDate(todayIso())}>Today</button>}
      </div>

      <StatStrip items={[
        { label: 'Entries', value: num(rows.length) },
        { label: 'Good pieces', value: num(totalGood) },
        { label: 'Scrap', value: num(totalScrap), color: totalScrap > 0 ? 'warning' : undefined },
        { label: 'Scrap rate', value: `${scrapRate.toFixed(1)}%`, color: scrapRate > 5 ? 'danger' : undefined },
        { label: 'Downtime', value: `${num(totalDown)} min` },
      ]} />

      <DataTable
        loading={isLoading}
        rows={rows}
        empty="No entries for this date — click Add Entry to log production"
        columns={[
          { key: 'wo', header: 'Work Order', render: (r) => <Two a={r.workOrderNo} b={r.itemName} /> },
          { key: 'op', header: 'Operation', render: (r) => <span className="secondary">{r.operationSeq ? `${r.operationSeq}. ` : ''}{r.operationName}{r.machineCode ? ` · ${r.machineCode}` : ''}</span> },
          { key: 'good', header: 'Good', align: 'right', render: (r) => <span className="strong num">{num(r.qtyGood)} {r.uom}</span> },
          { key: 'scrap', header: 'Scrap', align: 'right', render: (r) => r.qtyScrap > 0 ? <span className="num f-warning">{num(r.qtyScrap)}</span> : <span className="muted">—</span> },
          { key: 'down', header: 'Downtime', align: 'right', render: (r) => r.downtimeMin > 0 ? `${num(r.downtimeMin)} min` : <span className="muted">—</span> },
          { key: 'shift', header: 'Shift / Operator', render: (r) => <span className="secondary">{r.shift ? `Shift ${r.shift}` : '—'}{r.operator ? ` · ${r.operator}` : ''}</span> },
        ]}
      />

      {showAdd && (
        <Modal
          open={showAdd}
          title="Add Production Entry"
          onClose={() => setShowAdd(false)}
          footer={<><Button onClick={() => setShowAdd(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save Entry</Button></>}
        >
          <div className="stack gap-12">
            {validationMsg ? <Alert tone="warning">{validationMsg}</Alert> : null}
            <ComboField
              label="Work Order"
              value={f.workOrderId}
              onChange={id => setF(x => ({ ...x, workOrderId: id, operationId: '' }))}
              apiPath="/work-orders"
              extraQuery="status=Released,In Progress"
              toOption={(wo: any) => ({ id: wo.id, label: `${wo.number} · ${wo.itemName}`, sub: `${wo.status} · due ${dateShort(wo.dueDate)}` })}
              selectedLabel={f.workOrderNo}
              placeholder="Search work orders…"
              required
            />
            <SelectField
              label="Operation"
              value={f.operationId}
              onChange={set('operationId')}
              placeholder={f.workOrderId ? (ops.length ? 'Select operation…' : 'Loading…') : 'Select work order first'}
              disabled={!f.workOrderId || !ops.length}
              options={ops.map((o: any) => ({ value: o.id, label: `${o.seq}. ${o.name}${o.machineCode ? ' · ' + o.machineCode : ''} · ${num(o.qtyDone)}/${num(o.qtyPlanned || 0)} done` }))}
              required
            />
            <div className="form c3">
              <TextField label="Date" type="date" value={f.entryDate} onChange={set('entryDate')} />
              <SelectField label="Shift" value={f.shift} onChange={set('shift')} options={SHIFTS} />
              <TextField label="Operator" value={f.operator} onChange={set('operator')} placeholder="Name" />
              <TextField label="Good qty" type="number" min={0} step="any" value={f.qtyGood} onChange={set('qtyGood')} required />
              <TextField label="Scrap qty" type="number" min={0} step="any" value={f.qtyScrap} onChange={set('qtyScrap')} />
              <TextField label="Downtime (min)" type="number" min={0} value={f.downtimeMin} onChange={set('downtimeMin')} />
              <TextField label="Run hours" type="number" min={0} step="0.1" value={f.runHours} onChange={set('runHours')} className="span3" />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
