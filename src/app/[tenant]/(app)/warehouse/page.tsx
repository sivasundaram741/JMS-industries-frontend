'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantHref } from '@/lib/hooks';

export default function WarehouseHubPage() {
  const router = useRouter();
  const tenantHref = useTenantHref();
  useEffect(() => { router.replace(tenantHref('/warehouse/stock')); }, [router, tenantHref]);
  return null;
}
