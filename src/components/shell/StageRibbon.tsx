'use client';
// Numbered stage ribbon shown on every page: Sales → Purchase → Warehouse → Production → Quality → Dispatch → Finance
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { STAGE_SECTIONS, activeItem } from '@/lib/nav';

export function StageRibbon() {
  const pathname = usePathname();
  const act = activeItem(pathname)?.section.key;
  return (
    <nav className="ribbon" aria-label="Manufacturing flow">
      {STAGE_SECTIONS.map((s) => {
        const on = s.key === act;
        return (
          <Link key={s.key} href={s.items[0].href} title={`${s.stage} · ${s.label} · ${s.sub}`} className={on ? `s-${s.tone}` : `t-${s.tone}`} style={on ? { color: '#fff' } : undefined} aria-current={on ? 'step' : undefined}>
            <span className={'n ' + (on ? '' : `s-${s.tone}`)} style={on ? { background: '#fff', color: `var(--${s.tone}-fg)` } : { color: '#fff' }}>{s.stage}</span>
            <span className="truncate">{s.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
