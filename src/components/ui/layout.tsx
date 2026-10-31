'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TenantLink as Link } from './TenantLink';
import { useTenantHref } from '@/lib/hooks';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ChevronRight, CircleAlert, Info, TriangleAlert, CircleCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Tone } from '@/lib/status';
import { IconTile } from './basic';

export function Card({ title, sub, right, icon, children, className, bodyClass, pad = true, id }: { title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; icon?: LucideIcon; children?: React.ReactNode; className?: string; bodyClass?: string; pad?: boolean; id?: string }) {
  return (
    <div className={'card ' + (className || '')} id={id}>
      {title || right ? (
        <div className="card-head">
          {icon ? <IconTile icon={icon} tone="info" size={28} /> : null}
          <div>
            {title ? <div className="t">{title}</div> : null}
            {sub ? <div className="s">{sub}</div> : null}
          </div>
          {right ? <div className="r">{right}</div> : null}
        </div>
      ) : null}
      {pad ? <div className={'card-body ' + (bodyClass || '')}>{children}</div> : children}
    </div>
  );
}

export function Kpi({ label, value, icon, tone = 'info', delta, trend, good, note, href }: { label: string; value: React.ReactNode; icon: LucideIcon; tone?: Tone; delta?: React.ReactNode; trend?: 'up' | 'down' | 'flat'; good?: boolean; note?: React.ReactNode; href?: string }) {
  const T = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const positive = good ?? trend !== 'down';
  const body = (
    <>
      <div className="top"><span>{label}</span><IconTile icon={icon} tone={tone} /></div>
      <div className="val num">{value}</div>
      <div className="foot">
        {delta !== undefined && delta !== null ? <span className={`badge t-${trend === 'flat' ? 'neutral' : positive ? 'success' : 'danger'}`}><T size={12} />{delta}</span> : null}
        {note ? <span>{note}</span> : null}
      </div>
    </>
  );
  return href ? <Link href={href} className="card kpi" style={{ color: 'inherit' }}>{body}</Link> : <div className="card kpi">{body}</div>;
}

export function StatStrip({ items }: { items: Array<{ label: string; value: React.ReactNode; tag?: React.ReactNode; tone?: Tone; color?: Tone }> }) {
  return (
    <div className="card stat-strip">
      {items.map((s) => (
        <div key={s.label}>
          <div className="l">{s.label}</div>
          <div className={'v num' + (s.color ? ' f-' + s.color : '')}>{s.value}{s.tag ? <span className={`badge t-${s.tone || 'neutral'}`}>{s.tag}</span> : null}</div>
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ crumbs, title, sub, tags, actions, back }: { crumbs?: Array<{ label: string; href?: string }>; title: React.ReactNode; sub?: React.ReactNode; tags?: React.ReactNode; actions?: React.ReactNode; back?: string | boolean }) {
  const router = useRouter();
  const tenantHref = useTenantHref();
  useEffect(() => {
    if (typeof title === 'string') document.title = title + ' · Catchu ERP';
  }, [title]);
  return (
    <div className="page-bar">
      {crumbs?.length ? (
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="row" style={{ gap: 4 }}>
              {i ? <ChevronRight size={12} /> : null}
              {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span className={i === crumbs.length - 1 ? 'cur' : ''}>{c.label}</span>}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="title">
            {back ? (
              <button className="back" aria-label="Back" onClick={() => (typeof back === 'string' ? router.push(tenantHref(back)) : router.back())}><ArrowLeft size={16} /></button>
            ) : null}
            <h1>{title}</h1>
            {tags}
          </div>
          {sub ? <div className="sub">{sub}</div> : null}
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Tabs({ items, active }: { items: Array<{ key: string; label: string; href?: string; count?: React.ReactNode; onClick?: () => void }>; active: string }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => {
        const inner = <>{t.label}{t.count !== undefined && t.count !== null ? <span className="cnt">{t.count}</span> : null}</>;
        return t.href
          ? <Link key={t.key} href={t.href} className={t.key === active ? 'on' : ''} role="tab" aria-selected={t.key === active}>{inner}</Link>
          : <button key={t.key} type="button" className={t.key === active ? 'on' : ''} role="tab" aria-selected={t.key === active} onClick={t.onClick}>{inner}</button>;
      })}
    </div>
  );
}

const ALERT_ICON: Record<string, LucideIcon> = { danger: CircleAlert, warning: TriangleAlert, info: Info, success: CircleCheck };
export function Alert({ tone = 'info', title, children, action }: { tone?: Tone; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  const I = ALERT_ICON[tone] || Info;
  return (
    <div className={`alert t-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <I size={18} style={{ flex: 'none', marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? <div className="at">{title}</div> : null}
        {children ? <div className="ax">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', children, icon: Icon }: { title?: string; children?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="empty">
      {Icon ? <Icon size={22} style={{ marginBottom: 6, opacity: 0.4 }} /> : null}
      <div className="strong secondary">{title}</div>
      {children ? <div className="text-xs muted" style={{ marginTop: 3 }}>{children}</div> : null}
    </div>
  );
}

export function ErrorBox({ error }: { error: any }) {
  if (!error) return null;
  return <Alert tone="danger" title="Could not load this page">{error.message || String(error)}</Alert>;
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack tight" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" style={{ height: 14, width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

export function KeyValue({ items, cols = 2 }: { items: Array<[string, React.ReactNode]>; cols?: number }) {
  return (
    <div className="kv" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map(([k, v]) => (
        <div key={k}><div className="k">{k}</div><div className="v">{v ?? '—'}</div></div>
      ))}
    </div>
  );
}

export function ListItem({ icon, tone = 'info', title, sub, right, href, onClick }: { icon?: LucideIcon; tone?: Tone; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; href?: string | null; onClick?: () => void }) {
  const inner = (
    <>
      {icon ? <IconTile icon={icon} tone={tone} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="lt truncate">{title}</div>
        {sub ? <div className="ls truncate">{sub}</div> : null}
      </div>
      {right}
      {href ? <ChevronRight size={16} className="muted" /> : null}
    </>
  );
  if (href) return <Link href={href} className="li">{inner}</Link>;
  return <div className="li" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>{inner}</div>;
}
