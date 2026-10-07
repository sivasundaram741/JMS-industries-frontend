'use client';
// Settings · Company & Industry: company profile, statutory numbers, document numbering and the industry template.
import { useEffect, useState } from 'react';
import { Check, Factory, RotateCcw, Save } from 'lucide-react';
import { put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { Alert, Badge, Button, Card, DataTable, ErrorBox, IconTile, Loading, PageHeader, SelectField, TextAreaField, TextField, useToast } from '@/components/ui';
import { SettingsTabs } from '../_components/SettingsTabs';

interface Company {
  name: string; shortName: string; gstin: string | null; city: string | null; pan: string | null; address: string | null; phone: string | null; email: string | null; website: string | null;
  fyStart: string; currency: string; timezone: string; industry: string; branches: Array<{ id: number; code: string; name: string; isMain: boolean }>;
  numbering: Array<{ label: string; prefix: string; next: string }>; modules: string[];
}
const FIELDS = ['name', 'shortName', 'gstin', 'city', 'pan', 'address', 'phone', 'email', 'website', 'fyStart', 'timezone'] as const;
type Form = Record<(typeof FIELDS)[number], string>;
const toForm = (c: Company): Form => Object.fromEntries(FIELDS.map((k) => [k, (c as any)[k] ?? ''])) as Form;
const TEMPLATES = [
  { key: 'fmcg', label: 'FMCG', sub: '4 industry modules' }, { key: 'nonfmcg', label: 'Non-FMCG', sub: '8 industry modules' },
  { key: 'industrial', label: 'Industrial', sub: '7 industry modules' }, { key: 'supermarket', label: 'Supermarket', sub: '6 industry modules' },
];

export default function CompanySettingsPage() {
  const { user, can, refresh } = useAuth();
  const toast = useToast();
  const allowed = can('settings');
  const { data, error, mutate } = useApi<Company>(allowed ? '/settings/company' : null);
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = can('settings', 'edit');
  useEffect(() => { if (data && !f) setF(toForm(data)); }, [data, f]);
  const set = (k: keyof Form) => (v: string) => setF((x) => (x ? { ...x, [k]: v } : x));
  const dirty = !!data && !!f && FIELDS.some((k) => (f[k] || '') !== ((data as any)[k] ?? ''));
  const gstErr = f?.gstin && !/^[0-9A-Z]{15}$/.test(f.gstin) ? 'GSTIN is 15 letters and digits' : null;
  const panErr = f?.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan) ? 'PAN is 5 letters, 4 digits, 1 letter' : null;

  async function save() {
    if (!f) return;
    setBusy(true);
    try {
      await put('/settings/company', Object.fromEntries(FIELDS.map((k) => [k, f[k] || (k === 'name' || k === 'shortName' ? f[k] : null)])));
      toast.ok('Company settings saved');
      const fresh = await mutate();
      if (fresh) setF(toForm(fresh));
      refresh();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  if (!allowed) {
    return (
      <>
        <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Settings' }, { label: 'Company & Industry' }]} title="Settings" />
        <SettingsTabs active="company" />
        <Alert tone="warning" title="Your role cannot open company settings">Appearance is open to everyone.</Alert>
      </>
    );
  }
  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Settings' }, { label: 'Company & Industry' }]} title="Settings"
        sub="Company profile and the industry template that decides which modules load"
        actions={canEdit ? <>
          <Button icon={RotateCcw} disabled={!dirty || busy} onClick={() => data && setF(toForm(data))}>Discard</Button>
          <Button variant="primary" icon={Save} loading={busy} disabled={!dirty || !!gstErr || !!panErr || !f?.name.trim() || !f?.shortName.trim()} onClick={save}>Save changes</Button>
        </> : null} />
      <SettingsTabs active="company" />
      <ErrorBox error={error} />
      {!data || !f ? <Card><Loading rows={8} /></Card> : (
        <div className="grid main-side">
          <div className="stack">
            <Card title="Company profile" sub="Printed on invoices, bills, challans and payslips">
              <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
                <div className="form c2">
                  <TextField label="Legal name" value={f.name} onChange={set('name')} required />
                  <TextField label="Short name" value={f.shortName} onChange={set('shortName')} required hint="Shown in the sidebar and breadcrumbs" />
                  <TextField label="GSTIN" value={f.gstin} onChange={(v) => set('gstin')(v.toUpperCase())} hint={gstErr || 'Decides CGST + SGST or IGST on every document'} />
                  <TextField label="PAN" value={f.pan} onChange={(v) => set('pan')(v.toUpperCase())} hint={panErr || undefined} />
                  <TextAreaField className="full" label="Head office address" value={f.address} onChange={set('address')} rows={2} />
                  <TextField label="City" value={f.city} onChange={set('city')} />
                  <TextField label="Phone" value={f.phone} onChange={set('phone')} placeholder="+91 4344 276 331" />
                  <TextField label="Email" type="email" value={f.email} onChange={set('email')} />
                  <TextField label="Website" value={f.website} onChange={set('website')} />
                  <SelectField label="Financial year" value={f.fyStart} onChange={set('fyStart')} options={[{ value: 'April', label: 'April – March' }, { value: 'January', label: 'January – December' }]} />
                  <SelectField label="Time zone" value={f.timezone} onChange={set('timezone')} options={[{ value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' }, { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' }, { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' }, { value: 'UTC', label: 'UTC' }]} />
                  <TextField label="Base currency" value={`${data.currency} · ₹`} onChange={() => undefined} disabled />
                </div>
              </fieldset>
            </Card>
            <DataTable
              toolbar={<div className="toolbar"><div><div className="tt">Numbering & documents</div><div className="ts">Prefix and the next number on every document · numbers come from a locked sequence</div></div></div>}
              rows={data.numbering} rowKey="prefix"
              columns={[
                { key: 'label', header: 'Document', render: (r) => <span className="strong">{r.label}</span> },
                { key: 'prefix', header: 'Prefix', render: (r) => <span className="num">{r.prefix}</span> },
                { key: 'next', header: 'Next number', render: (r) => <span className="num secondary">{r.next}</span> },
              ]} />
          </div>
          <div className="stack">
            <Card title="Industry template" sub="Switching template changes menus, screens and workflows">
              <div className="stack tight" style={{ gap: 8 }}>
                {TEMPLATES.map((t) => {
                  const on = t.key === (data.industry || 'industrial');
                  return (
                    <div key={t.key} className={'choice' + (on ? ' on' : '')} style={{ cursor: 'default', opacity: on ? 1 : 0.7 }}>
                      <IconTile icon={Factory} tone={on ? 'warning' : 'neutral'} size={32} />
                      <span style={{ flex: 1 }}><span className="ct" style={{ display: 'block' }}>{t.label}</span><span className="cs">{t.sub}</span></span>
                      {on ? <Badge tone="success"><Check size={12} />In use</Badge> : null}
                    </div>
                  );
                })}
                <div className="text-xs muted">This installation runs the Industrial template. Other templates need their own module pack.</div>
              </div>
            </Card>
            <Card title="Modules loaded for Industrial">
              <div className="stack tight" style={{ gap: 8 }}>
                {data.modules.map((m) => <div key={m} className="row text-sm" style={{ gap: 8 }}><Check size={15} className="f-success" />{m}</div>)}
              </div>
            </Card>
            <Card title="Branches">
              <div className="stack tight" style={{ gap: 8 }}>
                {data.branches.map((b) => <div key={b.id} className="row between text-sm"><span>{b.name} <span className="muted">· {b.code}</span></span>{b.isMain ? <Badge tone="info" dot={false}>Main</Badge> : null}</div>)}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
