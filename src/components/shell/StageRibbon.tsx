'use client';
// The flow bar shown on every page:
//   1 Masters → 2 Work Order → 3 Purchase (only when outsourced) → 4 Production → 5 Assembly → 6 QC
// It is the shortest answer to "how do these screens fit together" - each chip opens that step.
import { useParams, usePathname } from 'next/navigation';
import { TenantLink as Link } from '../ui/TenantLink';
import { STAGES, activeStage } from '@/lib/nav';

export function StageRibbon() {
  const rawPathname = usePathname();
  const { tenant } = (useParams<{ tenant?: string }>() || {}) as { tenant?: string };
  const pathname = tenant ? rawPathname.replace(`/${tenant}`, '') || '/' : rawPathname;
  const act = activeStage(pathname);
  return (
    <nav className="ribbon" aria-label="Manufacturing flow">
      {STAGES.map((s) => {
        const on = s.key === act;
        return (
          <Link key={s.key} href={s.href} title={`${s.n} · ${s.label} · ${s.sub}`} className={on ? `s-${s.tone}` : `t-${s.tone}`} style={on ? { color: '#fff' } : undefined} aria-current={on ? 'step' : undefined}>
            <span className={'n ' + (on ? '' : `s-${s.tone}`)} style={on ? { background: '#fff', color: `var(--${s.tone}-fg)` } : { color: '#fff' }}>{s.n}</span>
            <span className="truncate">{s.label}</span>
            {s.optional ? <span className="text-micro" style={{ opacity: 0.75, flex: 'none' }}>if needed</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
