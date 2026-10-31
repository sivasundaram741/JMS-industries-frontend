'use client';
// Sidebar: Today and the shop floor at the top; then the route a job takes (Masters → Work orders → Purchase &
// job work → Production → Assembly → Quality), drawn as stops on one line so the order reads at a glance; then
// reports and settings. The stop you are on is marked in safety yellow — the same "you are here" mark the work
// order's route card uses.
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTenantHref } from '@/lib/hooks';
import { ClipboardCheck, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { MENU_END, MENU_TOP, ROUTE_MENU, activeMenuKey, type NavItem } from '@/lib/nav';
import { useApi } from '@/lib/hooks';

export function Sidebar({ branch, open }: { branch?: string; open?: boolean }) {
  const rawPathname = usePathname();
  const { tenant } = useParams<{ tenant?: string }>();
  const tenantHref = useTenantHref();
  // Strip the tenant prefix so the menu matches bare paths like /purchase/orders
  const pathname = tenant ? rawPathname.replace(`/${tenant}`, '') || '/' : rawPathname;
  const { user, can, logout } = useAuth();
  const onApprovals = pathname.startsWith('/approvals');
  const active = onApprovals ? 'approvals' : activeMenuKey(pathname);
  const visible = (it: NavItem) => can(it.module, 'view') || (it.alt || []).some((m) => can(m, 'view'));
  const { data: approvals } = useApi<{ total: number }>(can('approvals') ? '/approvals?pageSize=1' : null, { refreshInterval: 60000 });
  const route = ROUTE_MENU.filter(visible);

  const link = (it: NavItem, stop = false) => {
    const on = active === it.key;
    return (
      <Link key={it.key} href={tenantHref(it.href)} className={'nav-item' + (on ? ' active' : '')} aria-current={on ? 'page' : undefined} title={it.hint ? `${it.label} · ${it.hint}` : undefined}>
        {stop ? <span className="stop" aria-hidden><i /></span> : <it.icon size={19} />}
        <span className="truncate">{it.label}</span>
      </Link>
    );
  };

  return (
    <aside className={'sidebar' + (open ? ' open' : '')} aria-label="Main menu">
      <div className="brand">
        <span className="logo">JMS</span>
        <span className="brand-name">Catchu ERP</span>
      </div>
      <div className="workspace">
        <div style={{ minWidth: 0 }}>
          <div className="ws-name truncate">{user?.company.shortName || 'JMS Industries'}</div>
          <div className="ws-sub truncate">{branch || 'Coimbatore'}</div>
        </div>
      </div>
      <nav className="nav">
        <div className="nav-items">{MENU_TOP.filter(visible).map((it) => link(it))}</div>
        {route.length ? (
          <>
            <div className="nav-overline"><span>How a job moves</span></div>
            <div className="nav-items route-nav">{route.map((it) => link(it, true))}</div>
          </>
        ) : null}
        <div className="nav-gap" />
        <div className="nav-items">
          {can('approvals') ? (
            <Link href={tenantHref('/approvals')} className={'nav-item' + (onApprovals ? ' active' : '')} aria-current={onApprovals ? 'page' : undefined}>
              <ClipboardCheck size={19} />
              <span className="truncate">Approvals</span>
              {approvals?.total ? <span className="count">{approvals.total}</span> : null}
            </Link>
          ) : null}
          {MENU_END.filter(visible).map((it) => link(it))}
        </div>
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
