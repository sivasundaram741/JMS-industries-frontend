'use client';
// Grouped bar chart (e.g. production actual vs plan per day), drawn in SVG with a tooltip on hover
import { useState } from 'react';

export function BarChart({ labels, series, height = 250, format = (v: number) => String(v) }: { labels: string[]; series: Array<{ name: string; color: string; values: number[] }>; height?: number; format?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 4 ? 4 : m <= 5 ? 5 : 10) * p; })();
  const W = 640, H = height, L = 44, B = 26, T = 8;
  const gw = (W - L) / labels.length, bw = Math.min(22, (gw * 0.6) / series.length);
  const y = (v: number) => T + (H - T - B) * (1 - v / nice);
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={series.map((s) => s.name).join(' vs ')}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W} y1={y(nice * f)} y2={y(nice * f)} stroke="var(--border-subtle)" />
            <text x={L - 8} y={y(nice * f) + 4} textAnchor="end" fontSize="11" fill="var(--text-tertiary)">{format(nice * f)}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={L + gw * i} y={T} width={gw} height={H - T - B} fill={hover === i ? 'var(--bg-muted)' : 'transparent'} opacity={0.5} />
            {series.map((s, j) => {
              const v = s.values[i] || 0;
              const x = L + gw * i + (gw - bw * series.length - 4 * (series.length - 1)) / 2 + j * (bw + 4);
              return <rect key={s.name} x={x} y={y(v)} width={bw} height={Math.max(v ? 2 : 0, H - B - y(v))} rx={3} fill={s.color} />;
            })}
            <text x={L + gw * i + gw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-tertiary)">{l}</text>
          </g>
        ))}
      </svg>
      {hover !== null ? (
        <div style={{ position: 'absolute', top: 8, left: `calc(${((L + (hover + 0.5) * gw) / W) * 100}% - 70px)`, width: 140, background: 'var(--text-primary)', color: 'var(--bg-surface)', borderRadius: 8, padding: '6px 10px', fontSize: 12, pointerEvents: 'none' }}>
          <div className="strong">{labels[hover]}</div>
          {series.map((s) => <div key={s.name} className="row between" style={{ gap: 8 }}><span>{s.name}</span><span className="num">{(s.values[hover] || 0).toLocaleString('en-IN')}</span></div>)}
        </div>
      ) : null}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ name: string; color: string }> }) {
  return (
    <div className="row" style={{ gap: 14 }}>
      {items.map((i) => <span key={i.name} className="row text-xs secondary" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: i.color, display: 'inline-block' }} />{i.name}</span>)}
    </div>
  );
}

// Semi-circle gauge
export function Gauge({ value, label, color = 'var(--success-solid)', size = 200 }: { value: number; label?: string; color?: string; size?: number }) {
  const r = size / 2 - 14, c = Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`} role="img" aria-label={`${label || ''} ${v}%`}>
      <path d={`M 14 ${size / 2} A ${r} ${r} 0 0 1 ${size - 14} ${size / 2}`} fill="none" stroke="var(--bg-muted)" strokeWidth={20} strokeLinecap="round" />
      <path d={`M 14 ${size / 2} A ${r} ${r} 0 0 1 ${size - 14} ${size / 2}`} fill="none" stroke={color} strokeWidth={20} strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize="26" fontWeight="600" fill="var(--text-primary)">{Math.round(v)}%</text>
      {label ? <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize="12" fill="var(--text-tertiary)">{label}</text> : null}
    </svg>
  );
}
