'use client';
import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Alert, ButtonLink, PageHeader, Spinner } from '@/components/ui';
import { activeItem } from '@/lib/nav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { StageRibbon } from './StageRibbon';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, user, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [branch, setBranch] = useState('');
  useEffect(() => {
    if (status === 'signed-out') router.replace('/login?next=' + encodeURIComponent(pathname));
  }, [status, pathname, router]);
  useEffect(() => {
    if (user && !branch) setBranch(user.branches.find((b) => b.isMain)?.name || user.branches[0]?.name || '');
  }, [user, branch]);
  // A page whose menu the role cannot view (typed URL, old link) shows a short notice instead of failing requests.
  // Appearance is open to everyone.
  const act = activeItem(pathname);
  const blocked = act && !can(act.item.module) && !(act.item.alt || []).some((m) => can(m)) && !pathname.startsWith('/settings/appearance') ? act.item : null;
  if (status !== 'signed-in') return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><Spinner size={24} /></div>;
  return (
    <div className="app">
      <Sidebar branch={branch} />
      <div className="main">
        <Topbar branch={branch} onBranch={setBranch} />
        <main className="content">
          <StageRibbon />
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
