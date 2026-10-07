'use client';
// Numbered stage ribbon shown on every page: Sales → Purchase → Warehouse → Production → Quality → Dispatch → Finance
import { useParams, usePathname } from 'next/navigation';
import { TenantLink as Link } from '../ui/TenantLink';
import { STAGE_SECTIONS, activeItem } from '@/lib/nav';

export function StageRibbon() {
  const rawPathname = usePathname();
  const { tenant } = (useParams<{ tenant?: string }>() || {}) as { tenant?: string };
  const pathname = tenant ? rawPathname.replace(`/${tenant}`, '') || '/' : rawPathname;
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
