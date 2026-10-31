'use client';
// Shared bits for the Production pages: the work order process strip, the Work Orders · Shop Floor tabs,
// and a small "More" menu for secondary actions.
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ClipboardList, Ellipsis, Factory, Forklift, GitFork, Lock, Play, ShieldCheck } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { Alert, Tabs } from '@/components/ui';

export const WO_PROCESS: Array<{ label: string; sub?: string; icon: LucideIcon; href: string }> = [
  { label: 'Create work order', icon: ClipboardList, href: '/production/work-orders/new' },
  { label: 'Material issue', icon: Forklift, href: '/production/work-orders?status=Released' },
  { label: 'Start operation', icon: Play, href: '/production/shop-floor' },
  { label: 'Record production', icon: Factory, href: '/production/work-orders?status=In Progress' },
  { label: 'Partial completion', sub: '(if needed)', icon: GitFork, href: '/production/work-orders?status=In Progress,On Hold' },
  { label: 'Move to quality', icon: ShieldCheck, href: '/quality' },
  { label: 'Close work order', icon: Lock, href: '/production/work-orders?status=Completed' },
];

// Work orders, the shop floor and reports each have their own place in the sidebar now, so the production pages
// no longer repeat them as tabs. Kept as a no-op so older screens that still render it need no change.
export function ProductionTabs(_props: { active: 'wo' | 'floor' | 'reports' }) {
  return null;
}

// Button that opens a dropdown of secondary actions
export function MoreMenu({ items }: { items: Array<{ label: string; icon: LucideIcon; onClick: () => void; danger?: boolean } | null | false> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const list = items.filter(Boolean) as Array<{ label: string; icon: LucideIcon; onClick: () => void; danger?: boolean }>;
  if (!list.length) return null;
  if (list.length === 1) {
    const only = list[0], I = only.icon;
    return <button type="button" className={'btn' + (only.danger ? ' danger-outline' : '')} onClick={only.onClick}><I size={16} />{only.label}</button>;
  }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Ellipsis size={16} />More</button>
      {open ? (
        <div className="dropdown" role="menu" style={{ minWidth: 220 }}>
          {list.map((i) => {
            const I = i.icon;
            return <button key={i.label} type="button" role="menuitem" className={'di' + (i.danger ? ' f-danger' : '')} onClick={() => { setOpen(false); i.onClick(); }}><I size={16} />{i.label}</button>;
          })}
        </div>
      ) : null}
    </div>
  );
}

/** The work order's own notes, shown as a plain-language panel.
 *  First line is the heading, the rest is the explanation. */
export function WorkOrderNote({ notes, tone = 'info' }: { notes?: string | null; tone?: 'info' | 'warning' }) {
  const lines = String(notes || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const [head, ...rest] = lines;
  return (
    <Alert tone={tone} title={head}>
      {rest.map((l, i) => <div key={i} style={{ marginTop: i ? 4 : 0 }}>{l}</div>)}
    </Alert>
  );
}
