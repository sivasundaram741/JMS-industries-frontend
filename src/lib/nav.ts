// The menu follows the way a job actually moves through this shop:
//
//   Masters → Work Order ─┬─ needs outsourcing → Purchase order ─┐
//                         └─ all made here ─────────────────────┴→ Production → Assembly → QC
//
// Stock is not a screen of its own: opening balances and adjustments live on the
// Masters page, beside the items they belong to. Each work order also carries its own
// route card — its path through these steps — so the steps here are the shop-wide queues.
//
// Three lists, three different questions:
//   MENU   — what the sidebar shows (MENU_TOP, then the ROUTE_MENU stops, then MENU_END)
//   ROUTES — which permission module a page belongs to (every page, menu or not)
//   STAGES — the steps in order, with a one-line explanation (Users & roles uses them)
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3, Boxes, ClipboardCheck, ClipboardList, Database, Factory, Hammer, LayoutDashboard,
  NotebookPen, Settings, ShieldCheck, ShoppingCart,
} from 'lucide-react';
import type { Tone } from './status';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  module: string;
  /** Other modules whose users may also open this page. */
  alt?: string[];
  /** A word after the label, e.g. "if needed" on the optional step. */
  hint?: string;
}

/** Top of the sidebar: where the day starts, and the operators' screen. */
export const MENU_TOP: NavItem[] = [
  { key: 'home', label: 'Today', href: '/', icon: LayoutDashboard, module: 'home' },
  { key: 'shopfloor', label: 'Shop floor', href: '/production/shop-floor', icon: Factory, module: 'shopfloor', alt: ['wo'] },
];

/** The route a job takes, in order. The sidebar draws these as stops on one line. */
export const ROUTE_MENU: NavItem[] = [
  { key: 'masters', label: 'Masters', href: '/masters', icon: Database, module: 'masters', alt: ['vendors', 'hr', 'inventory'] },
  { key: 'wo', label: 'Work orders', href: '/production/work-orders', icon: ClipboardList, module: 'wo' },
  { key: 'buy', label: 'Purchase & job work', href: '/purchase/orders', icon: ShoppingCart, module: 'purchase', alt: ['subcon'], hint: 'if needed' },
  { key: 'prod-log', label: 'Production', href: '/production/log', icon: NotebookPen, module: 'wo' },
  { key: 'assembly', label: 'Assembly', href: '/production/assembly', icon: Hammer, module: 'wo' },
  { key: 'quality', label: 'Quality', href: '/quality', icon: ShieldCheck, module: 'quality', alt: ['wo'] },
];

/** Bottom of the sidebar. */
export const MENU_END: NavItem[] = [
  { key: 'reports', label: 'Reports', href: '/production/reports', icon: BarChart3, module: 'wo' },
  { key: 'settings', label: 'Settings', href: '/settings', icon: Settings, module: 'settings' },
];

export const MENU: NavItem[] = [...MENU_TOP, ...ROUTE_MENU, ...MENU_END];

/** Every page, including the ones with no menu entry of their own. */
const ROUTES: NavItem[] = [
  ...MENU,
  { key: 'jobwork', label: 'Job Work', href: '/purchase/subcontracting', icon: ShoppingCart, module: 'subcon', alt: ['purchase'] },
  { key: 'vendors', label: 'Vendors', href: '/purchase/vendors', icon: Database, module: 'vendors', alt: ['purchase', 'masters'] },
  { key: 'stock', label: 'Stock', href: '/warehouse/stock', icon: Boxes, module: 'inventory', alt: ['masters'] },
  { key: 'grn', label: 'Goods Received', href: '/warehouse/grn', icon: Boxes, module: 'stockentry', alt: ['inventory'] },
  { key: 'ledger', label: 'Stock Ledger', href: '/warehouse/ledger', icon: Boxes, module: 'inventory', alt: ['masters'] },
  { key: 'lots', label: 'Lots & Batches', href: '/warehouse/lots', icon: Boxes, module: 'batches', alt: ['inventory'] },
  { key: 'approvals', label: 'Approvals', href: '/approvals', icon: ClipboardCheck, module: 'approvals' },
];

/** The flow bar: the route a job takes, in order. Step 3 only applies to the jobs that need it. */
export interface Stage { key: string; n: number; label: string; sub: string; href: string; tone: Tone; optional?: boolean }
export const STAGES: Stage[] = [
  { key: 'masters', n: 1, label: 'Masters', sub: 'set the items, machines and people up first', href: '/masters', tone: 'neutral' },
  { key: 'wo', n: 2, label: 'Work Order', sub: 'raise the job and say which kind it is', href: '/production/work-orders', tone: 'info' },
  { key: 'buy', n: 3, label: 'Purchase', sub: 'only if part of it is outsourced', href: '/purchase/orders', tone: 'teal', optional: true },
  { key: 'prod', n: 4, label: 'Production', sub: 'make it on the shop floor', href: '/production/log', tone: 'danger' },
  { key: 'assembly', n: 5, label: 'Assembly', sub: 'put it together', href: '/production/assembly', tone: 'warning' },
  { key: 'qc', n: 6, label: 'QC', sub: 'check it before it goes out', href: '/quality', tone: 'purple' },
];

const matches = (href: string, pathname: string) =>
  (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));

/** The page this path belongs to — longest matching prefix wins. */
export function activeItem(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const r of ROUTES) if (matches(r.href, pathname) && (!best || r.href.length > best.href.length)) best = r;
  return best;
}

/** The menu entry to highlight, which may be a parent of the open page. */
export function activeMenuKey(pathname: string): string | null {
  let best: NavItem | null = null;
  for (const m of MENU) if (matches(m.href, pathname) && (!best || m.href.length > best.href.length)) best = m;
  if (best) return best.key;
  // Goods received belong to the purchase step; stock, ledger and lots are kept with the masters.
  if (pathname.startsWith('/warehouse/grn') || pathname.startsWith('/purchase')) return 'buy';
  if (pathname.startsWith('/warehouse') || pathname.startsWith('/masters')) return 'masters';
  if (pathname.startsWith('/production')) return 'wo';
  if (pathname.startsWith('/settings')) return 'settings';
  return null;
}

/** The stage the flow bar should mark as current. */
export function activeStage(pathname: string): string | null {
  if (pathname.startsWith('/masters') || pathname.startsWith('/warehouse')) return 'masters';
  if (pathname.startsWith('/purchase')) return 'buy';
  if (pathname.startsWith('/production/assembly')) return 'assembly';
  if (pathname.startsWith('/production/log') || pathname.startsWith('/production/shop-floor')) return 'prod';
  if (pathname.startsWith('/quality')) return 'qc';
  if (pathname.startsWith('/production')) return 'wo';
  return null;
}
