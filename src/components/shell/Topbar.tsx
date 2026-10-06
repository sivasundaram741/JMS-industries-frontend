'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, MapPin, Moon, Sun, ChevronDown, LogOut, CircleCheck, Palette } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { financialYear, ago } from '@/lib/format';
import { GlobalSearch } from './GlobalSearch';
import { applyAppearance, loadAppearance, resolvedTheme, saveAppearance } from '@/lib/appearance';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    // Apply the saved appearance (again after React's dev remount clears the attribute) and follow later changes
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

export function Topbar({ branch, onBranch }: { branch: string; onBranch: (b: string) => void }) {
  const { user, can, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState<'' | 'bell' | 'me' | 'branch'>('');
  const box = useRef<HTMLDivElement>(null);
  useOutside(box, () => setMenu(''));
  const { data: approvals } = useApi<any>(can('approvals') ? '/approvals?pageSize=5' : null, { refreshInterval: 60000 });
  const pending = approvals?.total || 0;

  return (
    <header className="topbar">
      <GlobalSearch />
      <div className="spacer" />
      <div ref={box} className="row" style={{ gap: 12, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <button className="pill" onClick={() => setMenu(menu === 'branch' ? '' : 'branch')} aria-haspopup="menu"><MapPin size={16} />{branch}<ChevronDown size={16} className="muted" /></button>
          {menu === 'branch' ? (
            <div className="dropdown" role="menu">
              {(user?.branches || []).map((b) => <button key={b.id} className="di" onClick={() => { onBranch(b.name); setMenu(''); }}><MapPin size={15} />{b.name}{b.isMain ? <span className="chip" style={{ marginLeft: 'auto' }}>Main</span> : null}</button>)}
            </div>
          ) : null}
        </div>
        <span className="pill"><CalendarDays size={16} />{financialYear()}</span>
        <button className="icon-btn outlined" onClick={toggle} title={theme === 'dark' ? 'Light theme' : 'Dark theme'} aria-label="Switch theme">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        <div style={{ position: 'relative' }}>
          <button className="icon-btn outlined" onClick={() => setMenu(menu === 'bell' ? '' : 'bell')} aria-label="Notifications">
            <Bell size={18} />{pending ? <span className="dot" /> : null}
          </button>
          {menu === 'bell' ? (
            <div className="dropdown" style={{ width: 340 }}>
              <div className="nav-overline"><span>Waiting for approval</span><span>{pending}</span></div>
              {approvals?.rows?.length ? approvals.rows.map((a: any) => (
                <Link key={a.id} href="/approvals" onClick={() => setMenu('')}><CircleCheck size={16} className="f-warning" /><div style={{ minWidth: 0 }}><div className="strong truncate">{a.title}</div><div className="text-xs muted truncate">{a.detail} · {ago(a.createdAt)}</div></div></Link>
              )) : <div className="empty text-sm">Nothing waiting for you</div>}
            </div>
          ) : null}
        </div>
        <div style={{ position: 'relative' }}>
          <button className="avatar" style={{ border: 0, cursor: 'pointer' }} onClick={() => setMenu(menu === 'me' ? '' : 'me')} aria-label="Account">{user?.initials}</button>
          {menu === 'me' ? (
            <div className="dropdown">
              <div style={{ padding: '8px 10px' }}><div className="strong">{user?.name}</div><div className="text-xs muted">{user?.email} · {user?.role.name}</div></div>
              <div className="divider" style={{ margin: '4px 0' }} />
              <Link href="/settings/appearance" onClick={() => setMenu('')}><Palette size={16} />Appearance</Link>
              <button className="di" onClick={logout}><LogOut size={16} />Sign out</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
