'use client';
// Add or edit an employee: HR record and payroll profile. Pay details only for roles that edit HR.
import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { api, post, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { todayIso } from '@/lib/format';
import { Button, Checkbox, Field, Loading, Modal, SelectField, TextField, useToast } from '@/components/ui';
import { Attachments } from '@/components/docs/Attachments';

const EMPTY = {
  code: '', name: '', designation: '', departmentId: '', location: '', shift: '', dateOfJoining: todayIso(), phone: '', email: '', status: 'Active', reportsTo: '',
  monthlyGross: '', pfApplicable: true, esiApplicable: false, bankAccount: '', pan: '',
};

export function EmployeeModal({ open, id, onClose, onSaved }: { open: boolean; id?: number; onClose: () => void; onSaved: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { data: depts } = useApi<any[]>(open ? '/hr/departments' : null);
  const { data: desigs } = useApi<any[]>(open ? '/master-data/designation?status=active' : null);
  const { data: shifts } = useApi<any[]>(open ? '/master-data/shift?status=active' : null);
  const { data: sum } = useApi<any>(open ? '/hr/summary' : null);
  const [f, setF] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const canPay = can('hr', 'edit');
  const readOnly = id ? !can('hr', 'edit') : !can('hr', 'create');
  const set = (k: keyof typeof EMPTY) => (v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!open) return;
    if (!id) { setF(EMPTY); return; }
    setLoading(true);
    api<any>(`/hr/employees/${id}`).then((e) => setF({
      code: e.code || '', name: e.name || '', designation: e.designation || '', departmentId: e.departmentId ? String(e.departmentId) : '', location: e.location || '', shift: e.shift || '',
      dateOfJoining: e.dateOfJoining || '', phone: e.phone || '', email: e.email || '', status: e.status || 'Active', reportsTo: e.reportsTo || '',
      monthlyGross: e.monthlyGross !== undefined ? String(e.monthlyGross) : '', pfApplicable: !!e.pfApplicable, esiApplicable: !!e.esiApplicable, bankAccount: e.bankAccount || '', pan: e.pan || '',
    })).catch((e) => { toast.err(e); onClose(); }).finally(() => setLoading(false));
  }, [open, id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        code: f.code.trim() || undefined, name: f.name.trim(), designation: f.designation.trim() || null, departmentId: f.departmentId ? Number(f.departmentId) : null, location: f.location.trim() || null,
        shift: f.shift || null, dateOfJoining: f.dateOfJoining || null, phone: f.phone.trim() || null, email: f.email.trim() || null, status: f.status, reportsTo: f.reportsTo.trim() || null,
      };
      if (canPay) Object.assign(body, { monthlyGross: Number(f.monthlyGross) || 0, pfApplicable: f.pfApplicable, esiApplicable: f.esiApplicable, bankAccount: f.bankAccount.trim() || null, pan: f.pan.trim().toUpperCase() || null });
      const r = id ? await put(`/hr/employees/${id}`, body) : await post('/hr/employees', body);
      toast.ok(`${r.name} saved${id ? '' : ' as ' + r.code}`);
      await mutate((k) => typeof k === 'string' && k.startsWith('/hr/'));
      onSaved();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={id ? (readOnly ? f.name || 'Employee' : `Edit ${f.name || 'employee'}`) : 'Add employee'} sub={id ? f.code : 'Creates the HR record and payroll profile · the ID is given automatically when left blank'}
      footer={<><Button onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>{readOnly ? null : <Button variant="primary" loading={busy} disabled={f.name.trim().length < 2 || loading} onClick={save}>Save employee</Button>}</>}>
      {loading ? <Loading rows={6} /> : (
        <div className="stack">
          <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="form c3">
              <TextField className="span2" label="Full name" value={f.name} onChange={set('name')} required />
              <TextField label="Employee ID" value={f.code} onChange={set('code')} placeholder="Auto" />
              <SelectField label="Department" value={f.departmentId} onChange={set('departmentId')} placeholder="Choose…" options={(depts || []).filter((d) => d.isActive || String(d.id) === f.departmentId).map((d) => ({ value: d.id, label: d.name }))} />
              <Field label="Designation">{(fid) => <><input id={fid} className="input" list="kc-desig" value={f.designation} onChange={(e) => set('designation')(e.target.value)} /><datalist id="kc-desig">{(desigs || []).map((d) => <option key={d.id} value={d.name} />)}</datalist></>}</Field>
              <TextField label="Date of joining" type="date" value={f.dateOfJoining} onChange={set('dateOfJoining')} />
              <SelectField label="Shift" value={f.shift} onChange={set('shift')} placeholder="General" options={(shifts || []).map((s) => ({ value: s.code, label: `${s.name}${s.data?.start ? ` · ${s.data.start}–${s.data.end}` : ''}` }))} />
              <Field label="Location">{(fid) => <><input id={fid} className="input" list="kc-loc" value={f.location} onChange={(e) => set('location')(e.target.value)} /><datalist id="kc-loc">{(sum?.locations || []).map((l: string) => <option key={l} value={l} />)}</datalist></>}</Field>
              <TextField label="Reports to" value={f.reportsTo} onChange={set('reportsTo')} />
              <TextField label="Phone (with area code)" value={f.phone} onChange={set('phone')} placeholder="+91 98400 00000" />
              <TextField label="Email" type="email" value={f.email} onChange={set('email')} />
              <SelectField label="Status" value={f.status} onChange={set('status')} options={['Active', 'On leave', 'Exited'].map((s) => ({ value: s, label: s }))} />
            </div>
            {canPay ? (
              <>
                <div className="divider" style={{ margin: '18px 0 14px' }} />
                <div className="h4" style={{ marginBottom: 10 }}>Payroll profile</div>
                <div className="form c3">
                  <TextField label="Monthly gross (₹)" type="number" value={f.monthlyGross} onChange={set('monthlyGross')} min={0} hint="Basic is 50% · HRA 20% · special allowance the rest" />
                  <TextField label="Bank account" value={f.bankAccount} onChange={set('bankAccount')} hint={!f.bankAccount ? 'Needed for the bank transfer' : undefined} />
                  <TextField label="PAN" value={f.pan} onChange={(v) => set('pan')(v.toUpperCase())} placeholder="ABCDE1234F" />
                  <div className="field" style={{ alignSelf: 'end', paddingBottom: 10 }}><Checkbox label="PF applicable" checked={f.pfApplicable} onChange={(v) => set('pfApplicable')(v)} /></div>
                  <div className="field" style={{ alignSelf: 'end', paddingBottom: 10 }}><Checkbox label="ESI applicable (gross ≤ ₹21,000)" checked={f.esiApplicable} onChange={(v) => set('esiApplicable')(v)} /></div>
                </div>
              </>
            ) : null}
          </fieldset>
          {id ? <Attachments entityType="EMP" entityId={id} entityNo={f.name} title="Employee documents" /> : null}
        </div>
      )}
    </Modal>
  );
}
