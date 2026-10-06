'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Loading } from '@/components/ui';

// Settings opens on Company & Industry (or Appearance for roles that cannot see company settings)
export default function SettingsIndex() {
  const router = useRouter();
  const { can, status } = useAuth();
  useEffect(() => {
    if (status === 'signed-in') router.replace(can('settings') ? '/settings/company' : '/settings/appearance');
  }, [status, can, router]);
  return <Loading rows={3} />;
}
