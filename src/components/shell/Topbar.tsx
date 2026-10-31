'use client';
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, MapPin, Menu, Moon, Sun, ChevronDown, CircleCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { financialYear, ago } from '@/lib/format';
import { ProfileDrawer } from './ProfileDrawer';
import { applyAppearance, loadAppearance, resolvedTheme, saveAppearance } from '@/lib/appearance';
import { GlobalSearch } from './GlobalSearch';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const sync = () => { const a = loadAppearance(); applyAppearance(a); setTheme(resolvedTheme(a.theme)); };
    sync();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    window.addEventListener('kcerp:appearance', sync);
    return () => { mq.removeEventListener('change', sync); window.removeEventListener('kcerp:appearance', sync); };
  }, []);
  const toggle = () => saveAppearance({ ...loadAppearance(), theme: theme === 'dark' ? 'light' : 'dark' });
  return { theme, toggle };
}

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

export function Topbar({ branch, onBranch, onMenu }: { branch: string; onBranch: (b: string) => void; onMenu?: () => void }) {
  const { user, can } = useAuth();
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState<'' | 'bell' | 'branch'>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useOutside(box, () => setMenu(''));
  const { data: approvals } = useApi<any>(can('approvals') ? '/approvals?pageSize=5' : null, { refreshInterval: 60000 });
  const pending = approvals?.total || 0;

  return (
    <>
      <header className="topbar">
        <button className="icon-btn outlined menu-btn" onClick={onMenu} aria-label="Open the menu"><Menu size={18} /></button>
        <GlobalSearch />
        <div className="spacer" />

        <div ref={box} className="row" style={{ gap: 8, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <button className="pill" onClick={() => setMenu(menu === 'branch' ? '' : 'branch')} aria-haspopup="menu">
              <MapPin size={14} />{branch}<ChevronDown size={14} className="muted" />
            </button>
            {menu === 'branch' ? (
              <div className="dropdown" role="menu">
                {(user?.branches || []).map((b) => (
                  <button key={b.id} className="di" onClick={() => { onBranch(b.name); setMenu(''); }}>
                    <MapPin size={15} />{b.name}
                    {b.isMain ? <span className="chip" style={{ marginLeft: 'auto' }}>Main</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <span className="pill"><CalendarDays size={14} />{financialYear()}</span>
          <button className="icon-btn outlined" onClick={toggle} title={theme === 'dark' ? 'Light theme' : 'Dark theme'} aria-label="Switch theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn outlined" onClick={() => setMenu(menu === 'bell' ? '' : 'bell')} aria-label="Notifications">
              <Bell size={16} />{pending ? <span className="dot" /> : null}
            </button>
            {menu === 'bell' ? (
              <div className="dropdown" style={{ width: 340 }}>
                <div className="nav-overline"><span>Waiting for your approval</span><span>{pending}</span></div>
                {approvals?.rows?.length ? approvals.rows.map((a: any) => (
                  <Link key={a.id} href="/approvals" onClick={() => setMenu('')}>
                    <CircleCheck size={16} className="f-warning" />
                    <div style={{ minWidth: 0 }}>
                      <div className="strong truncate">{a.title}</div>
                      <div className="text-xs muted truncate">{a.detail} · {ago(a.createdAt)}</div>
                    </div>
                  </Link>
                )) : <div className="empty text-sm">Nothing waiting for you</div>}
              </div>
            ) : null}
          </div>
          <button
            className="avatar"
            style={{ border: 0, cursor: 'pointer' }}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open profile & settings"
          >
            {user?.initials}
          </button>
        </div>
      </header>
      <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
