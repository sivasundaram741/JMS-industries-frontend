'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { tenantStore } from '@/lib/api';
import { Alert, ButtonLink, PageHeader, Spinner } from '@/components/ui';
import { activeItem } from '@/lib/nav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, user, can, logout } = useAuth();
  const router = useRouter();
  const rawPathname = usePathname();
  const { tenant } = (useParams<{ tenant?: string }>() || {}) as { tenant?: string };
  const pathname = tenant ? rawPathname.replace(`/${tenant}`, '') || '/' : rawPathname;
  const [branch, setBranch] = useState('');
  // Below 900 px the sidebar becomes a drawer opened from the top bar (tablets on the shop floor).
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [rawPathname]);

  // Tenant in URL changed mid-session → log out immediately, regardless of auth state,
  // then land on the new tenant's login page.
  useEffect(() => {
    if (status === 'loading') return;
    const stored = tenantStore.get();
    if (tenant && stored && tenant !== stored) {
      logout();
      router.replace(`/${tenant}/login`);
    }
  }, [tenant, status, logout, router]);

  useEffect(() => {
    if (status === 'signed-out') {
      const stored = tenantStore.get();
      const slug = tenant || stored;
      router.replace(slug ? `/${slug}/login` : '/login');
    }
  }, [status, router, tenant]);
  useEffect(() => {
    if (user && !branch) setBranch(user.branches.find((b) => b.isMain)?.name || user.branches[0]?.name || '');
  }, [user, branch]);
  // A page whose menu the role cannot view (typed URL, old link) shows a short notice instead of failing requests.
  // Appearance is open to everyone.
  const act = activeItem(pathname);
  const blocked = act && !can(act.module) && !(act.alt || []).some((m) => can(m)) && !pathname.startsWith('/settings/appearance') ? act : null;
  if (status !== 'signed-in') return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><Spinner size={24} /></div>;
  return (
    <div className="app">
      <Sidebar branch={branch} open={navOpen} />
      {navOpen ? <div className="nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden /> : null}
      <div className="main">
        <Topbar branch={branch} onBranch={setBranch} onMenu={() => setNavOpen(true)} />
        <main className="content">
          <Suspense fallback={<Spinner />}>{blocked ? (
            <>
              <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: blocked.label }]} title={blocked.label} />
              <Alert tone="warning" title={`Your role cannot open ${blocked.label}`} action={<ButtonLink href="/" size="sm">Go to dashboard</ButtonLink>}>
                Menus follow your role. Ask a manager to switch it on in Settings · Users & Roles if you need it.
              </Alert>
            </>
          ) : children}</Suspense>
        </main>
      </div>
    </div>
  );
}
