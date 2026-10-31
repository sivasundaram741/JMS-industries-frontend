'use client';
// Right-click menu for a row. The same menu opens from the row's ⋯ button, so it works on touch screens and from
// the keyboard too. An item can lead to a second step: a searchable list to pick from — a supplier, say.
//
//   const menu = useContextMenu();
//   <tr onContextMenu={(e) => menu.open(e, 'O-ring kit', sections)}> … <RowMenuButton onClick={(e) => menu.open(e, …)} />
//   {menu.node}
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Check, ChevronRight, Ellipsis, Search } from 'lucide-react';

export interface PickOption { value: number | string; label: string; sub?: string }
export interface MenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Shown on the right, e.g. the supplier currently chosen */
  hint?: string;
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  /** Opens a second step listing options to pick from */
  pick?: { title: string; placeholder?: string; options: PickOption[]; current?: number | string | null; empty?: string; onPick: (value: number | string) => void };
}
export interface MenuSection { title?: string; items: MenuItem[] }
interface MenuState { x: number; y: number; title?: string; sections: MenuSection[] }

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const close = useCallback(() => setMenu(null), []);
  const open = useCallback((e: React.MouseEvent, title: string | undefined, sections: MenuSection[]) => {
    // Right-clicking inside a text box keeps the browser's own menu (copy, paste)
    const t = e.target as HTMLElement;
    if (e.type === 'contextmenu' && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    // Right-click opens at the pointer; the ⋯ button opens under itself
    const fromButton = e.type !== 'contextmenu';
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: fromButton ? r.right : e.clientX, y: fromButton ? r.bottom + 4 : e.clientY, title, sections: sections.filter((s) => s.items.length) });
  }, []);
  const node = menu && typeof document !== 'undefined' ? createPortal(<ContextMenu {...menu} onClose={close} anchorRight={false} />, document.body) : null;
  return { open, close, node, isOpen: !!menu };
}

/** The ⋯ button at the end of a row; opens the same menu as right-clicking the row. */
export function RowMenuButton({ label, onClick }: { label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button type="button" className="icon-btn row-menu-btn" aria-label={label} aria-haspopup="menu" title="Options (or right-click the row)" onClick={onClick}>
      <Ellipsis size={18} />
    </button>
  );
}

function ContextMenu({ x, y, title, sections, onClose }: MenuState & { onClose: () => void; anchorRight: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<MenuItem | null>(null);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu on screen
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, pad = 8;
    setPos({ left: Math.max(pad, Math.min(x, window.innerWidth - w - pad)), top: Math.max(pad, Math.min(y, window.innerHeight - h - pad)) });
  }, [x, y, step]);

  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => {
      // Escape closes only the menu (or steps back), never the dialog underneath it
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (step) { setStep(null); setQ(''); } else onClose(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[data-mi]:not(:disabled)') || []);
        if (!items.length) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
      }
    };
    const away = () => onClose();
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', away);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); window.removeEventListener('resize', away); };
  }, [onClose, step]);

  // Focus the first choice (or the search box on a pick step) so the keyboard works straight away
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    (el.querySelector<HTMLInputElement>('input') || el.querySelector<HTMLButtonElement>('[data-mi]:not(:disabled)'))?.focus();
  }, [step]);

  const pick = step?.pick;
  const term = q.trim().toLowerCase();
  const options = pick ? pick.options.filter((o) => !term || o.label.toLowerCase().includes(term) || (o.sub || '').toLowerCase().includes(term)) : [];

  return (
    <div ref={ref} className="ctx-menu" role="menu" aria-label={title || 'Options'} style={{ left: pos.left, top: pos.top }} onContextMenu={(e) => e.preventDefault()}>
      {pick && step ? (
        <>
          <div className="ctx-head">
            <button type="button" className="icon-btn" aria-label="Back" onClick={() => { setStep(null); setQ(''); }}><ArrowLeft size={16} /></button>
            <span className="truncate">{pick.title}</span>
          </div>
          <label className="ctx-search">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={pick.placeholder || 'Search…'} aria-label={pick.placeholder || 'Search'}
              onKeyDown={(e) => { if (e.key === 'Enter' && options[0]) { e.preventDefault(); pick.onPick(options[0].value); onClose(); } }} />
          </label>
          <div className="ctx-list">
            {options.length ? options.map((o) => (
              <button key={o.value} type="button" data-mi role="menuitemradio" aria-checked={o.value === pick.current} className="ctx-item" onClick={() => { pick.onPick(o.value); onClose(); }}>
                <span className="ctx-check">{o.value === pick.current ? <Check size={15} /> : null}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="truncate" style={{ display: 'block' }}>{o.label}</span>
                  {o.sub ? <span className="ctx-sub truncate">{o.sub}</span> : null}
                </span>
              </button>
            )) : <div className="ctx-empty">{term ? `Nothing matches “${q}”` : pick.empty || 'Nothing to choose from'}</div>}
          </div>
        </>
      ) : (
        <>
          {title ? <div className="ctx-title truncate">{title}</div> : null}
          {sections.map((s, si) => (
            <div key={si} className="ctx-section">
              {s.title ? <div className="ctx-section-title">{s.title}</div> : null}
              {s.items.map((it) => {
                const I = it.icon;
                return (
                  <button key={it.key} type="button" data-mi role={it.checked !== undefined ? 'menuitemradio' : 'menuitem'} aria-checked={it.checked} disabled={it.disabled}
                    className={'ctx-item' + (it.danger ? ' danger' : '')}
                    onClick={() => { if (it.pick) { setStep(it); setQ(''); } else { it.onSelect?.(); onClose(); } }}>
                    <span className="ctx-check">{it.checked ? <Check size={15} /> : I ? <I size={15} /> : null}</span>
                    <span className="truncate" style={{ flex: 1 }}>{it.label}</span>
                    {it.hint ? <span className="ctx-hint truncate">{it.hint}</span> : null}
                    {it.pick ? <ChevronRight size={15} className="muted" style={{ flex: 'none' }} /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
