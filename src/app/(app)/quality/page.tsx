'use client';
// Quality: inspection lots (incoming and final) and NCR & CAPA, on two tabs (?tab=ncr).
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { PageHeader, Tabs } from '@/components/ui';
import { InspectionsTab } from './_components/InspectionsTab';
import { NcrTab } from './_components/NcrTab';

export default function QualityPage() {
  const { user } = useAuth();
  const sp = useSearchParams();
  const tab = sp.get('tab') === 'ncr' ? 'ncr' : 'insp';
  const { data: summary, mutate } = useApi<any>('/quality/inspections/summary');
  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Quality' }, { label: tab === 'ncr' ? 'NCR & CAPA' : 'Inspections' }]}
        title={tab === 'ncr' ? 'NCR & CAPA' : 'Quality Inspections'}
        sub={tab === 'ncr'
          ? 'Nonconformances, disposition and 8D corrective actions'
          : 'Incoming and final inspection · accepted stock moves to store, rejected quantity raises an NCR'}
      />
      <Tabs
        active={tab}
        items={[
          { key: 'insp', label: 'Inspections', href: '/quality', count: summary?.lotsPending },
          { key: 'ncr', label: 'NCR & CAPA', href: '/quality?tab=ncr', count: summary?.openNcrs },
        ]}
      />
      {tab === 'ncr' ? <NcrTab focus={sp.get('focus')} onChanged={() => mutate()} /> : <InspectionsTab summary={summary} />}
    </>
  );
}
