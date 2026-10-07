'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantHref } from '@/lib/hooks';

export default function SalesHubPage() {
  const router = useRouter();
  const tenantHref = useTenantHref();
  useEffect(() => { router.replace(tenantHref('/sales/orders')); }, [router, tenantHref]);
  return null;
}
