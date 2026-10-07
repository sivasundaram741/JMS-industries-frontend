'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR, { SWRConfiguration } from 'swr';
import { fetcher, tenantStore } from './api';

/** Returns a function that prefixes any absolute path with /{tenantSlug}. */
export function useTenantHref(): (path: string) => string {
  const params = useParams<{ tenant?: string }>();
  const slug = params?.tenant || tenantStore.get() || '';
  return useCallback((path: string) => slug && path.startsWith('/') ? `/${slug}${path}` : path, [slug]);
}

/** Returns the current tenant slug from the URL params or localStorage. */
export function useTenantSlug(): string {
  const params = useParams<{ tenant?: string }>();
  return params?.tenant || tenantStore.get() || '';
}

// GET an API path with caching and revalidation; pass null to wait
export function useApi<T = any>(path: string | null, config?: SWRConfiguration) {
  return useSWR<T>(path, fetcher, { revalidateOnFocus: false, keepPreviousData: true, ...config });
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// Search, status filter and page for a list, with the status also readable from the URL (?status=…)
export function useListState(defaults: { status?: string; pageSize?: number } = {}) {
  const [search, setSearchRaw] = useState('');
  const [status, setStatusRaw] = useState(defaults.status || '');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (s) setStatusRaw(s);
  }, []);
  const debounced = useDebounced(search, 300);
  const setSearch = (v: string) => { setSearchRaw(v); setPage(1); };
  const setStatus = (v: string) => { setStatusRaw(v); setPage(1); };
  const params = { search: debounced || undefined, status: status || undefined, page, pageSize: defaults.pageSize || 25 };
  return { search, setSearch, status, setStatus, page, setPage, params };
}
