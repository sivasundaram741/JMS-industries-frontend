'use client';
// People & Masters · Masters: master data shared by every module — change it once, it applies everywhere.
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote, Boxes, Building2, CalendarDays, ClipboardCheck, Clock, Contact, Factory, IdCard, Landmark, Layers, Percent, Ruler, Search,
  ShieldCheck, Tags, Users, Warehouse, Wrench, Briefcase, Network,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { ago, num } from '@/lib/format';
import type { Tone } from '@/lib/status';
import { Card, IconTile, Loading, PageHeader } from '@/components/ui';

interface Summary {
  kinds: Array<{ key: string; label: string; group: string; count: number }>;
  counts: { items: number; customers: number; vendors: number; employees: number; departments: number; warehouses: number; machines: number; users: number; roles: number };
  lastChange: { kind: string; label: string; name: string; at: string; by: string | null } | null;
}
interface Tile { label: string; href: string; icon: LucideIcon; tone: Tone; count: (s: Summary) => string; module?: string }

const kindCount = (key: string) => (s: Summary) => `${num(s.kinds.find((k) => k.key === key)?.count || 0)} records`;
const GROUPS: Array<{ title: string; tiles: Tile[] }> = [
  { title: 'Inventory', tiles: [
    { label: 'Items', href: '/masters/items', icon: Boxes, tone: 'info', count: (s) => `${num(s.counts.items)} records` },
    { label: 'Item categories & brands', href: '/masters/category', icon: Tags, tone: 'purple', count: kindCount('category') },
    { label: 'Units of measure', href: '/masters/uom', icon: Ruler, tone: 'neutral', count: kindCount('uom') },
    { label: 'Warehouses & locations', href: '/masters/warehouses', icon: Warehouse, tone: 'warning', count: (s) => `${num(s.counts.warehouses)} records` },
  ] },
  { title: 'Sales & purchase', tiles: [
    { label: 'Customers', href: '/sales/customers', icon: Contact, tone: 'info', count: (s) => `${num(s.counts.customers)} records`, module: 'customers' },
    { label: 'Vendors', href: '/purchase/vendors', icon: Building2, tone: 'teal', count: (s) => `${num(s.counts.vendors)} records`, module: 'vendors' },
    { label: 'Payment terms', href: '/masters/payment_term', icon: CalendarDays, tone: 'neutral', count: kindCount('payment_term') },
    { label: 'Tax, HSN & GST', href: '/masters/tax_code', icon: Percent, tone: 'warning', count: kindCount('tax_code') },
  ] },
  { title: 'Finance', tiles: [
    { label: 'Banks & cash', href: '/masters/bank', icon: Landmark, tone: 'teal', count: kindCount('bank') },
    { label: 'Cost centres', href: '/masters/cost_centre', icon: Banknote, tone: 'info', count: kindCount('cost_centre') },
  ] },
  { title: 'People', tiles: [
    { label: 'Employees', href: '/hr', icon: IdCard, tone: 'info', count: (s) => `${num(s.counts.employees)} records`, module: 'hr' },
    { label: 'Departments', href: '/masters/departments', icon: Network, tone: 'purple', count: (s) => `${num(s.counts.departments)} records` },
    { label: 'Designations', href: '/masters/designation', icon: Briefcase, tone: 'neutral', count: kindCount('designation') },
    { label: 'Shifts', href: '/masters/shift', icon: Clock, tone: 'warning', count: kindCount('shift') },
    { label: 'Holidays', href: '/masters/holiday', icon: CalendarDays, tone: 'teal', count: kindCount('holiday') },
    { label: 'Users & roles', href: '/settings/users', icon: Users, tone: 'success', count: (s) => `${num(s.counts.users)} users · ${num(s.counts.roles)} roles`, module: 'settings' },
  ] },
  { title: 'Industrial masters', tiles: [
    { label: 'Work centres & machines', href: '/masters/machines', icon: Factory, tone: 'danger', count: (s) => `${num(s.counts.machines)} records` },
    { label: 'Inspection plans', href: '/masters/inspection_plan', icon: ClipboardCheck, tone: 'info', count: kindCount('inspection_plan') },
    { label: 'Tools & fixtures', href: '/masters/tool', icon: Wrench, tone: 'neutral', count: kindCount('tool') },
  ] },
];

export default function MastersHub() {
  const { user, can } = useAuth();
  const { data } = useApi<Summary>('/master-data/summary');
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const groups = GROUPS.map((g) => ({ ...g, tiles: g.tiles.filter((t) => (!t.module || can(t.module)) && (!term || t.label.toLowerCase().includes(term) || g.title.toLowerCase().includes(term))) })).filter((g) => g.tiles.length);

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'People & Masters' }, { label: 'Masters' }]} title="Masters"
        sub="Master data shared by every module — change it once, it applies everywhere" />
      <div className="card">
        <div className="toolbar">
          <label className="tsearch" style={{ flex: 1, maxWidth: 520 }}><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search masters — items, tax codes, shifts…" aria-label="Search masters" style={{ width: "100%" }} /></label>
          <div className="spacer" />
          {data?.lastChange ? <span className="text-sm muted">Last change: {data.lastChange.label.toLowerCase()} · {data.lastChange.name} · {ago(data.lastChange.at)}{data.lastChange.by ? ' by ' + data.lastChange.by : ''}</span> : null}
        </div>
      </div>
      {!data ? <Card><Loading rows={6} /></Card> : groups.map((g) => (
        <section key={g.title} className="stack tight" style={{ gap: 10 }}>
          <div className="h4 secondary">{g.title}</div>
          <div className="tile-grid">
            {g.tiles.map((t) => (
              <Link key={t.href} href={t.href} className="tile">
                <IconTile icon={t.icon} tone={t.tone} size={36} />
                <div style={{ minWidth: 0 }}><div className="tt truncate">{t.label}</div><div className="ts">{t.count(data)}</div></div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {data && !groups.length ? <Card><div className="empty">No master matches “{q}”</div></Card> : null}
      <div className="text-xs muted"><Layers size={12} style={{ verticalAlign: -2 }} /> Items, customers, vendors and employees keep their own screens; the smaller lists are edited here. <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> Inactive records stay on old documents but are hidden from new ones.</div>
    </>
  );
}
