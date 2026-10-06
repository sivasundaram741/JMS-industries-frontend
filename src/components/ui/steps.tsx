'use client';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@/lib/status';

// Horizontal stepper: done steps filled, current step ringed
export function Stepper({ steps, current }: { steps: Array<{ label: string; sub?: React.ReactNode }>; current: number }) {
  return (
    <div className="stepper">
      {steps.map((s, i) => (
        <div key={i} className={'st' + (i < current ? ' done' : i === current ? ' cur' : '')}>
          <div className="circle">{i < current ? <Check size={13} /> : i + 1}</div>
          <div><div className="sl">{s.label}</div>{s.sub ? <div className="ss">{s.sub}</div> : null}</div>
        </div>
      ))}
    </div>
  );
}

// Process strip: boxes joined by chevrons, each optionally a link
export function ProcessStrip({ steps, current }: { steps: Array<{ label: string; sub?: string; icon: LucideIcon; href?: string }>; current?: number | null }) {
  return (
    <div className="process">
      {steps.map((s, i) => {
        const done = current != null && i < current, on = i === current;
        const t: Tone = on ? 'warning' : done ? 'success' : 'info';
        const I = s.icon;
        const box = (
          <div className={`ps t-${t}`} style={{ borderColor: `color-mix(in srgb, var(--${t}-solid) ${on ? 90 : 35}%, transparent)`, borderWidth: on ? 1.5 : 1, color: 'var(--text-primary)' }}>
            <I size={16} className={`f-${t}`} />
            <span className="truncate" style={{ maxWidth: '100%' }}>{s.label}</span>
            {s.sub ? <span className="text-micro muted">{s.sub}</span> : null}
          </div>
        );
        return (
          <div key={i} style={{ display: 'contents' }}>
            {i ? <span className="arrow"><ChevronRight size={14} /></span> : null}
            {s.href ? <Link href={s.href} style={{ flex: 1, minWidth: 0, display: 'flex', textDecoration: 'none' }}>{box}</Link> : box}
          </div>
        );
      })}
    </div>
  );
}

// Dot trail showing how far a record has moved through a stage's steps
export function Trail({ n, current, tone, done, width = 150 }: { n: number; current: number; tone: Tone; done?: boolean; width?: number }) {
  return (
    <div className="trail" style={{ width }}>
      {Array.from({ length: n }).map((_, i) => {
        const past = done || i < current, now = !done && i === current;
        return (
          <span key={i} style={{ display: 'contents' }}>
            {i ? <b style={{ background: past || now ? `var(--${tone}-solid)` : 'var(--border-default)' }} /> : null}
            <i style={{ background: past ? `var(--${tone}-solid)` : now ? 'var(--bg-surface)' : 'var(--bg-muted)', boxShadow: now ? `inset 0 0 0 2.5px var(--${tone}-solid)` : undefined }} />
          </span>
        );
      })}
    </div>
  );
}
