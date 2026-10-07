'use client';
// Drop-in replacement for next/link that auto-prepends /{tenantSlug} to absolute paths.
// Inside the [tenant] route group, useParams() returns the slug; outside (e.g. /login),
// it falls back to localStorage so ButtonLink/Kpi/ListItem etc. keep working.
import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useTenantHref } from '@/lib/hooks';

type LinkProps = ComponentProps<typeof NextLink>;

export function TenantLink({ href, ...props }: LinkProps) {
  const tenantHref = useTenantHref();
  const fullHref = typeof href === 'string' ? tenantHref(href) : href;
  return <NextLink href={fullHref} {...props} />;
}
