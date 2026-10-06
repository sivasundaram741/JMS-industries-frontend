// Appearance settings for this browser: theme, sidebar, compact tables, reduced motion and strong focus rings.
// Stored in localStorage (a per-user, per-device convenience) and applied as attributes on <html>.
export type ThemePref = 'light' | 'dark' | 'system';
export interface Appearance { theme: ThemePref; sidebar: 'match' | 'dark'; compact: boolean; reduceMotion: boolean; strongFocus: boolean }

export const DEFAULT_APPEARANCE: Appearance = { theme: 'system', sidebar: 'match', compact: false, reduceMotion: false, strongFocus: false };
const KEY = 'kcerp-appearance';
const THEME_KEY = 'kcerp-theme'; // older key written by the top-bar switch

export function loadAppearance(): Appearance {
  let a: Appearance = { ...DEFAULT_APPEARANCE };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) a = { ...a, ...JSON.parse(raw) };
    else {
      const t = localStorage.getItem(THEME_KEY);
      if (t === 'light' || t === 'dark') a.theme = t;
    }
  } catch { /* storage blocked: defaults */ }
  return a;
}

export const resolvedTheme = (t: ThemePref): 'light' | 'dark' =>
  t === 'system' ? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;

export function applyAppearance(a: Appearance) {
  const el = document.documentElement;
  el.setAttribute('data-theme', resolvedTheme(a.theme));
  el.setAttribute('data-sidebar', a.sidebar);
  el.toggleAttribute('data-compact', a.compact);
  el.toggleAttribute('data-reduce-motion', a.reduceMotion);
  el.toggleAttribute('data-strong-focus', a.strongFocus);
}

export function saveAppearance(a: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
    localStorage.setItem(THEME_KEY, resolvedTheme(a.theme));
  } catch { /* ignore */ }
  applyAppearance(a);
  window.dispatchEvent(new Event('kcerp:appearance'));
}
