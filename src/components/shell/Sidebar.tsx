'use client';
// Sidebar: Overview plus one drawer per master module. The drawer holding the current page opens itself; the
// others remember whether you left them open. Menus the signed-in role cannot view are hidden.
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTenantHref } from '@/lib/hooks';
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Factory, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { OVERVIEW, SECTIONS, activeItem, type NavItem } from '@/lib/nav';
import { useApi } from '@/lib/hooks';

const KEY = 'kcerp-navopen';

export function Sidebar({ branch }: { branch?: string }) {
  const rawPathname = usePathname();
  const { tenant } = useParams<{ tenant?: string }>();
  const tenantHref = useTenantHref();
  // Strip the tenant prefix so activeItem matches against bare paths like /sales/orders
  const pathname = tenant ? rawPathname.replace(`/${tenant}`, '') || '/' : rawPathname;
  const { user, can, logout } = useAuth();
  const active = activeItem(pathname);
  const visible = (it: NavItem) => can(it.module, 'view');
  const sections = useMemo(() => SECTIONS.map((s) => ({ ...s, items: s.items.filter(visible) })).filter((s) => s.items.length), [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const overview = OVERVIEW.items.filter(visible);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { data: approvals } = useApi<{ total: number }>(can('approvals') ? '/approvals?pageSize=1' : null, { refreshInterval: 60000 });

  useEffect(() => {
    try { setOpen(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (active && active.section.key !== 'overview' && !open[active.section.key]) save({ ...open, [active.section.key]: true });
  }, [active?.section.key]); // eslint-disable-line react-hooks/exhaustive-deps

  function save(next: Record<string, boolean>) {
    setOpen(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  const allOpen = sections.every((s) => open[s.key]);
  const toggleAll = () => save(Object.fromEntries(sections.map((s) => [s.key, !allOpen || (active?.section.key === s.key)])));

  const item = (it: NavItem) => (
    <Link key={it.key} href={tenantHref(it.href)} className={'nav-item' + (active?.item.key === it.key ? ' active' : '')} aria-current={active?.item.key === it.key ? 'page' : undefined}>
      <it.icon size={18} />
      <span className="truncate">{it.label}</span>
      {it.key === 'approvals' && approvals?.total ? <span className="count">{approvals.total}</span> : null}
    </Link>
  );

  return (
    <aside className="sidebar" aria-label="Main menu">
      <div className="brand">
        <span className="logo">KC</span>
        <span className="brand-name">KCERP</span>
        <span className="ver">v5</span>
      </div>
      <div className="workspace">
        <span className="ws-icon"><Factory size={18} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="ws-name truncate">{user?.company.shortName || 'Forgetech Engineering'}</div>
          <div className="ws-sub truncate">Industrial · {branch || 'Hosur Plant 1'}</div>
        </div>
      </div>
      <nav className="nav">
        <div className="nav-overline">
          <span>Overview</span>
          <button type="button" onClick={toggleAll} title={allOpen ? 'Close all modules' : 'Open all modules'} aria-label="Open or close all modules">
            {allOpen ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
          </button>
        </div>
        <div className="nav-items">{overview.map(item)}</div>
        {sections.map((s) => {
          const isOpen = !!open[s.key];
          return (
            <div key={s.key} className="nav-section">
              <button type="button" className="nav-head" aria-expanded={isOpen} title={s.desc} onClick={() => save({ ...open, [s.key]: !isOpen })}>
                {s.stage ? <span className={`stage-dot s-${s.tone}`}>{s.stage}</span> : <s.icon size={18} className="secondary" />}
                <span>{s.label} {s.sub ? <span className="sub">{s.sub}</span> : null}</span>
                <ChevronRight size={16} className="chev" />
              </button>
              {isOpen ? <div className="nav-items indent">{s.items.map(item)}</div> : null}
            </div>
          );
        })}
      </nav>
      <div className="me">
        <span className="avatar">{user?.initials}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="strong text-sm truncate">{user?.name}</div>
          <div className="text-xs muted truncate">{user?.title}</div>
        </div>
        <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
      </div>
    </aside>
  );
}
