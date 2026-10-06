'use client';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Loader } from 'lucide-react';
import type { Tone, StatusKind } from '@/lib/status';
import { toneOf } from '@/lib/status';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'danger-outline';
type BtnSize = 'md' | 'sm' | 'xs';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: BtnVariant; size?: BtnSize; icon?: LucideIcon; iconRight?: LucideIcon; loading?: boolean }

const cls = (variant: BtnVariant = 'secondary', size: BtnSize = 'md', extra?: string) => ['btn', variant !== 'secondary' && variant, size !== 'md' && size, extra].filter(Boolean).join(' ');
const iconSize = (size: BtnSize = 'md') => (size === 'xs' ? 13 : size === 'sm' ? 15 : 16);

export function Button({ variant, size, icon: Icon, iconRight: IconR, loading, children, className, disabled, ...rest }: BtnProps) {
  return (
    <button className={cls(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader size={iconSize(size)} className="spin" /> : Icon ? <Icon size={iconSize(size)} /> : null}
      {children}
      {IconR ? <IconR size={iconSize(size)} /> : null}
    </button>
  );
}

export function ButtonLink({ href, variant, size, icon: Icon, iconRight: IconR, children, className }: { href: string; variant?: BtnVariant; size?: BtnSize; icon?: LucideIcon; iconRight?: LucideIcon; children?: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cls(variant, size, className)}>
      {Icon ? <Icon size={iconSize(size)} /> : null}
      {children}
      {IconR ? <IconR size={iconSize(size)} /> : null}
    </Link>
  );
}

export function Badge({ tone = 'neutral', dot = true, children, title }: { tone?: Tone; dot?: boolean; children: React.ReactNode; title?: string }) {
  return (
    <span className={`badge t-${tone}`} title={title}>
      {dot ? <span className="d" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ kind, status, dot = true, label }: { kind: StatusKind; status?: string | null; dot?: boolean; label?: string }) {
  if (!status) return null;
  return <Badge tone={toneOf(kind, status)} dot={dot}>{label || status}</Badge>;
}

export function Chip({ children, tone }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={'chip' + (tone ? ' t-' + tone : '')}>{children}</span>;
}

export function IconTile({ icon: Icon, tone = 'info', size = 32 }: { icon: LucideIcon; tone?: Tone; size?: number }) {
  return (
    <span className={`icon-tile t-${tone}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size / 2)} />
    </span>
  );
}

export function Avatar({ initials, size }: { initials?: string | null; size?: 'sm' }) {
  return <span className={'avatar' + (size ? ' ' + size : '')}>{initials || '?'}</span>;
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={'toggle' + (on ? ' on' : '')} disabled={disabled} onClick={() => onChange(!on)} />;
}

export function Segmented<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o} type="button" className={o === value ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

export function ProgressBar({ pct, tone = 'info', label, width }: { pct: number; tone?: Tone; label?: React.ReactNode; width?: number }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="prog" style={width ? { width } : undefined}>
      <div className="bar"><i className={`s-${tone}`} style={{ width: p + '%' }} /></div>
      {label !== undefined ? <span className="text-xs num secondary nowrap">{label}</span> : null}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader size={size} className="spin" />;
}
