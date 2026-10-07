'use client';
// Settings · Appearance: theme and layout for this user on this browser. Every user can set it for themselves.
import { useEffect, useState } from 'react';
import { Monitor, Moon, PanelLeft, RotateCcw, Sun, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DEFAULT_APPEARANCE, loadAppearance, saveAppearance, type Appearance } from '@/lib/appearance';
import { Alert, Badge, Button, Card, PageHeader, Toggle } from '@/components/ui';
import { SettingsTabs } from '../_components/SettingsTabs';

const THEMES: Array<{ key: Appearance['theme']; label: string; sub: string; icon: LucideIcon }> = [
  { key: 'light', label: 'Light', sub: 'Bright surfaces for daylight and offices', icon: Sun },
  { key: 'dark', label: 'Dark', sub: 'Low glare for night shifts and control rooms', icon: Moon },
  { key: 'system', label: 'System', sub: 'Follows your device’s light or dark setting', icon: Monitor },
];

export default function AppearancePage() {
  const { user } = useAuth();
  const [a, setA] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setA(loadAppearance()); }, []);
  const change = (patch: Partial<Appearance>) => { const next = { ...a, ...patch }; setA(next); saveAppearance(next); setSaved(true); };

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Settings' }, { label: 'Appearance' }]} title="Settings"
        sub="Theme and layout for your account on this browser · every user can set this for themselves"
        actions={<Button icon={RotateCcw} onClick={() => change(DEFAULT_APPEARANCE)}>Reset to default</Button>} />
      <SettingsTabs active="appearance" />
      <div className="grid main-side">
        <div className="stack">
          <Card title="Theme" sub="Light, dark, or follow your device setting">
            <div className="grid cols-3" style={{ gap: 12 }}>
              {THEMES.map((t) => (
                <button key={t.key} type="button" className={'choice' + (a.theme === t.key ? ' on' : '')} onClick={() => change({ theme: t.key })} aria-pressed={a.theme === t.key} style={{ flexDirection: 'column' }}>
                  <t.icon size={20} className={a.theme === t.key ? 'f-info' : 'muted'} />
                  <span className="ct">{t.label}</span><span className="cs">{t.sub}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Sidebar" sub="The sidebar follows the theme by default">
            <div className="grid cols-2" style={{ gap: 12 }}>
              {([['match', 'Match theme', 'Light sidebar in the light theme, dark sidebar in the dark theme'], ['dark', 'Always dark', 'Keep a dark sidebar even when the rest of the screen is light']] as const).map(([k, l, s]) => (
                <button key={k} type="button" className={'choice' + (a.sidebar === k ? ' on' : '')} onClick={() => change({ sidebar: k })} aria-pressed={a.sidebar === k}>
                  <PanelLeft size={18} className={a.sidebar === k ? 'f-info' : 'muted'} style={{ marginTop: 2 }} />
                  <span><span className="ct" style={{ display: 'block' }}>{l}</span><span className="cs">{s}</span></span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Comfort">
            <div className="list">
              {([['compact', 'Compact tables', 'Tighter rows to fit more records on screen'], ['reduceMotion', 'Reduce motion', 'Turn off chart and page animations'], ['strongFocus', 'Strong focus rings', 'Clear outlines when using the keyboard']] as const).map(([k, l, s]) => (
                <div key={k} className="li">
                  <div style={{ flex: 1 }}><div className="lt">{l}</div><div className="ls">{s}</div></div>
                  <Toggle on={a[k]} onChange={(v) => change({ [k]: v } as Partial<Appearance>)} label={l} />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Live preview" sub="Colours update as soon as you switch">
            <div className="stack tight" style={{ gap: 12 }}>
              <div className="card kpi" style={{ boxShadow: 'none' }}>
                <div className="top"><span>Revenue (MTD)</span><span className="icon-tile t-success"><TrendingUp size={16} /></span></div>
                <div className="val num">₹6.12 Cr</div>
                <div className="foot"><span className="badge t-success">+12.4%</span><span>vs last month</span></div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <Badge tone="success">In stock</Badge><Badge tone="warning">Low stock</Badge><Badge tone="danger">Overdue</Badge><Badge tone="info">In transit</Badge><Badge tone="neutral">Draft</Badge>
              </div>
              <div className="row" style={{ gap: 8 }}><Button variant="primary" size="sm">Create PO</Button><Button size="sm">Export</Button></div>
            </div>
          </Card>
          {saved ? <Alert tone="success" title="Saved on this browser">Your theme is kept for your next visit. Use the moon / sun button in the top bar to switch at any time.</Alert> : null}
        </div>
      </div>
    </>
  );
}
