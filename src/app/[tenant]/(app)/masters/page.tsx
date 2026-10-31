'use client';
// Masters: the lists every other screen is built on — items, machines, vendors, people.
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useState } from 'react';
import {
  ChevronRight, PackagePlus, ScrollText, Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { ago, num } from '@/lib/format';
import { Button, Card, Loading, PageHeader } from '@/components/ui';
import { AdjustModal } from '../warehouse/stock/_components/AdjustModal';

interface Summary {
  kinds: Array<{ key: string; label: string; group: string; count: number }>;
  counts: { items: number; customers: number; vendors: number; employees: number; departments: number; warehouses: number; machines: number; unitLocations: number; users: number; roles: number };
  lastChange: { kind: string; label: string; name: string; at: string; by: string | null } | null;
}
interface Tile { label: string; href: string; count: (s: Summary) => string; module?: string }

const kindCount = (key: string) => (s: Summary) => `${num(s.kinds.find((k) => k.key === key)?.count || 0)} records`;
const GROUPS: Array<{ title: string; tiles: Tile[] }> = [
  { title: 'What we make and keep', tiles: [
    { label: 'Items', href: '/masters/items', count: (s) => `${num(s.counts.items)} records` },
    { label: 'Item categories & brands', href: '/masters/category', count: kindCount('category') },
    { label: 'Units of measure', href: '/masters/uom', count: kindCount('uom') },
    { label: 'Warehouses & locations', href: '/masters/warehouses', count: (s) => `${num(s.counts.warehouses)} records` },
  ] },
  { title: 'The shop floor', tiles: [
    { label: 'Machines & work centres', href: '/masters/machines', count: (s) => `${num(s.counts.machines)} records` },
    { label: 'Unit locations', href: '/masters/unit-locations', count: (s) => `${num(s.counts.unitLocations)} records` },
    { label: 'Inspection plans', href: '/masters/inspection_plan', count: kindCount('inspection_plan') },
    { label: 'Tools & fixtures', href: '/masters/tool', count: kindCount('tool') },
  ] },
  { title: 'Who we buy from', tiles: [
    { label: 'Vendors', href: '/purchase/vendors', count: (s) => `${num(s.counts.vendors)} records`, module: 'vendors' },
    { label: 'Tax, HSN & GST', href: '/masters/tax_code', count: kindCount('tax_code') },
  ] },
  { title: 'Our people', tiles: [
    { label: 'Employees', href: '/masters/employees', count: (s) => `${num(s.counts.employees)} records`, module: 'hr' },
    { label: 'Departments', href: '/masters/departments', count: (s) => `${num(s.counts.departments)} records` },
    { label: 'Designations', href: '/masters/designation', count: kindCount('designation') },
    { label: 'Shifts', href: '/masters/shift', count: kindCount('shift') },
    { label: 'Users & roles', href: '/settings/users', count: (s) => `${num(s.counts.users)} users · ${num(s.counts.roles)} roles`, module: 'settings' },
  ] },
];

export default function MastersHub() {
  const { user, can } = useAuth();
  const { data, mutate } = useApi<Summary>('/master-data/summary');
  const [q, setQ] = useState('');
  // Opening balances and corrections are a master-data job, so they live here.
  const [stockDlg, setStockDlg] = useState<null | 'opening' | 'adjust'>(null);
  const term = q.trim().toLowerCase();
  const groups = GROUPS.map((g) => ({ ...g, tiles: g.tiles.filter((t) => (!t.module || can(t.module)) && (!term || t.label.toLowerCase().includes(term) || g.title.toLowerCase().includes(term))) })).filter((g) => g.tiles.length);

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Masters' }]} title="Masters"
        sub="The lists the rest of the app is built on — change something here and it applies everywhere"
        actions={can('inventory', 'edit') ? <>
          <Button icon={PackagePlus} onClick={() => setStockDlg('opening')}>Opening balance</Button>
          <Button icon={SlidersHorizontal} onClick={() => setStockDlg('adjust')}>Adjust stock</Button>
        </> : null} />

      {can('inventory', 'edit') ? (
        <Card title="Stock on hand" sub="Set what was already on the shelf, or correct what the system thinks is there — both are posted to the stock ledger with your reason">
          <div className="row" style={{ gap: 10, padding: '0 14px 14px', flexWrap: 'wrap' }}>
            <Button icon={PackagePlus} onClick={() => setStockDlg('opening')}>Enter an opening balance</Button>
            <Button icon={SlidersHorizontal} onClick={() => setStockDlg('adjust')}>Adjust a quantity</Button>
            <Link href="/warehouse/ledger" className="btn"><ScrollText size={16} />See every movement</Link>
            <Link href="/warehouse/stock" className="btn"><ScrollText size={16} />Stock by item</Link>
          </div>
        </Card>
      ) : null}
      <div className="card">
        <div className="toolbar">
          <label className="tsearch" style={{ flex: 1, maxWidth: 520 }}><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search masters — items, tax codes, shifts…" aria-label="Search masters" style={{ width: "100%" }} /></label>
          <div className="spacer" />
          {data?.lastChange ? <span className="text-sm muted">Last change: {data.lastChange.label.toLowerCase()} · {data.lastChange.name} · {ago(data.lastChange.at)}{data.lastChange.by ? ' by ' + data.lastChange.by : ''}</span> : null}
        </div>
      </div>
      {!data ? <Card><Loading rows={6} /></Card> : groups.map((g) => (
        <Card key={g.title} title={g.title}>
          <div className="list">
            {g.tiles.map((t) => (
              <Link key={t.href} href={t.href} className="li" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lt truncate">{t.label}</div>
                  <div className="ls truncate">{t.count(data)}</div>
                </div>
                <ChevronRight size={16} className="muted" />
              </Link>
            ))}
          </div>
        </Card>
      ))}
      {data && !groups.length ? <Card><div className="empty">No master matches “{q}”</div></Card> : null}
      <AdjustModal
        open={!!stockDlg}
        mode={stockDlg || 'adjust'}
        onClose={() => setStockDlg(null)}
        onDone={() => { setStockDlg(null); mutate(); }}
      />
    </>
  );
}
