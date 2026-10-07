'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTenantHref } from '@/lib/hooks';
import { Loading } from '@/components/ui';

// Settings opens on Company & Industry (or Appearance for roles that cannot see company settings)
export default function SettingsIndex() {
  const router = useRouter();
  const { can, status } = useAuth();
  const tenantHref = useTenantHref();
  useEffect(() => {
    if (status === 'signed-in') router.replace(tenantHref(can('settings') ? '/settings/company' : '/settings/appearance'));
  }, [status, can, router, tenantHref]);
  return <Loading rows={3} />;
}
