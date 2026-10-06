'use client';
import { Tabs } from '@/components/ui';

// Settings sections, as in the design: Company & Industry · Users & Roles · Appearance
export function SettingsTabs({ active }: { active: 'company' | 'users' | 'appearance' }) {
  return (
    <Tabs active={active} items={[
      { key: 'company', label: 'Company & Industry', href: '/settings/company' },
      { key: 'users', label: 'Users & Roles', href: '/settings/users' },
      { key: 'appearance', label: 'Appearance', href: '/settings/appearance' },
    ]} />
  );
}
