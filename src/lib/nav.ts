// Sidebar and stage ribbon: the Manufacturing Flow design's 7 stages (Sales → Purchase → Warehouse → Production →
// Quality → Dispatch → Finance). Each item names the permission module that decides whether a role sees it.
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Activity, CircleCheck, ShoppingCart, Contact, Receipt, Truck, Building2, Warehouse, PackagePlus, Layers,
  ClipboardList, Factory, ClipboardCheck, ShieldCheck, Send, Landmark, Database, Users, ChartColumn, FolderOpen, FileText,
  FileMinus, Undo2, Barcode, FilePlus2, FileX2, IdCard, Settings,
} from 'lucide-react';
import type { Tone } from './status';

// alt: other modules whose users may also open pages under this menu (e.g. an invoice opened from Invoicing & Payments)
export interface NavItem { key: string; label: string; href: string; icon: LucideIcon; module: string; alt?: string[]; managerOnly?: boolean }
export interface NavSection { key: string; label: string; icon: LucideIcon; stage?: number; short?: string; sub?: string; tone?: Tone; items: NavItem[] }

export const OVERVIEW: NavSection = {
  key: 'overview', label: 'Overview', icon: LayoutDashboard, items: [
    { key: 'home', label: 'Dashboard', href: '/', icon: LayoutDashboard, module: 'home' },
    { key: 'track', label: 'Tracking Center', href: '/tracking', icon: Activity, module: 'track' },
    { key: 'docs', label: 'Document Tracking', href: '/documents', icon: FolderOpen, module: 'docs' },
    { key: 'approvals', label: 'Approvals', href: '/approvals', icon: CircleCheck, module: 'approvals' },
  ],
};

export const SECTIONS: NavSection[] = [
  { key: 'sales', label: 'Sales', sub: 'CRM', short: 'Sales', stage: 1, tone: 'info', icon: ShoppingCart, items: [
    { key: 'sales', label: 'Customer Orders', href: '/sales/orders', icon: ShoppingCart, module: 'sales' },
    { key: 'customers', label: 'Customers', href: '/sales/customers', icon: Contact, module: 'customers' },
  ] },
  { key: 'purchase', label: 'Purchase', sub: 'Procurement', short: 'Purchase', stage: 2, tone: 'teal', icon: Receipt, items: [
    { key: 'purchase', label: 'Purchase Orders', href: '/purchase/orders', icon: Receipt, module: 'purchase' },
    { key: 'subcon', label: 'Subcontracting', href: '/purchase/subcontracting', icon: Truck, module: 'subcon' },
    { key: 'pbills', label: 'Purchase Bills', href: '/purchase/bills', icon: FileText, module: 'pbills', alt: ['purchase', 'finance'] },
    { key: 'debitinv', label: 'Debit Invoices', href: '/purchase/debit-notes', icon: FileMinus, module: 'debitinv' },
    { key: 'vendors', label: 'Vendors', href: '/purchase/vendors', icon: Building2, module: 'vendors' },
  ] },
  { key: 'store', label: 'Warehouse', sub: 'Inventory', short: 'Warehouse', stage: 3, tone: 'warning', icon: Warehouse, items: [
    { key: 'inventory', label: 'Stock Overview', href: '/warehouse/stock', icon: Warehouse, module: 'inventory' },
    { key: 'stockentry', label: 'GRN & Stock Entry', href: '/warehouse/grn', icon: PackagePlus, module: 'stockentry' },
    { key: 'batches', label: 'Batch & Lot Stock', href: '/warehouse/lots', icon: Layers, module: 'batches' },
    { key: 'stockreturns', label: 'Stock Returns', href: '/warehouse/returns', icon: Undo2, module: 'stockreturns' },
    { key: 'barcode', label: 'Barcode Generator', href: '/warehouse/barcodes', icon: Barcode, module: 'barcode' },
  ] },
  { key: 'prod', label: 'Production', sub: 'Work orders', short: 'Production', stage: 4, tone: 'danger', icon: Factory, items: [
    { key: 'wo', label: 'Work Orders', href: '/production/work-orders', icon: ClipboardList, module: 'wo' },
    { key: 'shopfloor', label: 'Shop Floor', href: '/production/shop-floor', icon: Factory, module: 'shopfloor' },
  ] },
  { key: 'quality', label: 'Quality', sub: 'QMS', short: 'Quality', stage: 5, tone: 'neutral', icon: ShieldCheck, items: [
    { key: 'quality', label: 'Inspections & NCR', href: '/quality', icon: ClipboardCheck, module: 'quality' },
  ] },
  { key: 'dispatch', label: 'Dispatch', sub: 'Logistics', short: 'Dispatch', stage: 6, tone: 'info', icon: Truck, items: [
    { key: 'dispatch', label: 'Dispatch & Delivery', href: '/dispatch', icon: Send, module: 'dispatch' },
  ] },
  { key: 'finance', label: 'Finance', sub: 'Accounting', short: 'Finance', stage: 7, tone: 'teal', icon: Landmark, items: [
    { key: 'finance', label: 'Invoicing & Payments', href: '/finance', icon: Landmark, module: 'finance' },
    { key: 'billing', label: 'Sales Invoices', href: '/finance/invoices', icon: FilePlus2, module: 'billing', alt: ['finance', 'creditinv'] },
    { key: 'creditinv', label: 'Credit Invoices', href: '/finance/credit-notes', icon: FileX2, module: 'creditinv' },
  ] },
  { key: 'masters', label: 'People & Masters', icon: Users, items: [
    { key: 'hr', label: 'HR & Payroll', href: '/hr', icon: IdCard, module: 'hr' },
    { key: 'masters', label: 'Masters', href: '/masters', icon: Database, module: 'masters', alt: ['hr'] },
  ] },
  { key: 'admin', label: 'Insights & Admin', icon: ChartColumn, items: [
    { key: 'reports', label: 'Reports & Analytics', href: '/reports', icon: ChartColumn, module: 'reports' },
    { key: 'settings', label: 'Settings', href: '/settings', icon: Settings, module: 'settings' },
  ] },
];

export const STAGE_SECTIONS = SECTIONS.filter((s) => s.stage);

// Which menu item a path belongs to (longest matching prefix)
export function activeItem(pathname: string): { section: NavSection; item: NavItem } | null {
  let best: { section: NavSection; item: NavItem } | null = null;
  for (const section of [OVERVIEW, ...SECTIONS]) {
    for (const item of section.items) {
      const match = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href + '/');
      if (match && (!best || item.href.length > best.item.href.length)) best = { section, item };
    }
  }
  return best;
}
