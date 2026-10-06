'use client';
// Tabs shared by the three Tracking Center pages, plus where each of the 7 stages opens
import { Tabs } from '@/components/ui';

export function TrackingTabs({ active }: { active: 'stock' | 'orders' | 'stages' }) {
  return (
    <Tabs
      active={active}
      items={[
        { key: 'stock', label: 'Stock Tracking', href: '/tracking' },
        { key: 'orders', label: 'Order Tracking', href: '/tracking/orders' },
        { key: 'stages', label: 'Stage Tracking', href: '/tracking/stages', count: 7 },
      ]}
    />
  );
}

export const STAGE_HREF: Record<string, string> = {
  sales: '/sales/orders',
  purchase: '/purchase/orders',
  store: '/warehouse/stock',
  prod: '/production/work-orders',
  quality: '/quality',
  dispatch: '/dispatch',
  finance: '/finance',
};
