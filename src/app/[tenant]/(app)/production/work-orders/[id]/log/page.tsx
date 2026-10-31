'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardList, NotebookPen, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { dateShort, num } from '@/lib/format';
import { Button, ButtonLink, ErrorBox, Loading, PageHeader, StatusBadge } from '@/components/ui';
import { RecordDialog } from '../_components/dialogs';
import { ProductionLogView } from '../../../_components/ProductionLogView';

export default function WorkOrderProductionLogPage() {
  const { id } = useParams<{ id: string }>();
  const { user, can } = useAuth();
  const { data: wo, error, mutate } = useApi<any>(`/work-orders/${id}`);
  const { data: machines } = useApi<any[]>('/machines');
  const [adding, setAdding] = useState(false);
  const [addDate, setAddDate] = useState<string | undefined>();

  if (error) return <ErrorBox error={error} />;
  if (!wo) return <Loading />;

  const canRecord = can('wo', 'edit') && (wo.actions || []).includes('record');

  return (
    <>
      <PageHeader
        back={`/production/work-orders/${id}`}
        crumbs={[
          { label: user?.company.shortName || '' },
          { label: 'Production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: wo.number, href: `/production/work-orders/${id}` },
          { label: 'Production Log' },
        ]}
        title={`${wo.number} \u00b7 Production Log`}
        sub={`${wo.itemName} \u00b7 ${num(wo.qtyCompleted)} of ${num(wo.qtyPlanned)} ${wo.uom} done${wo.startDate && wo.dueDate ? ` \u00b7 ${dateShort(wo.startDate)} to ${dateShort(wo.dueDate)}` : ''}`}
        tags={<StatusBadge kind="wo" status={wo.status} />}
        actions={<>
          <ButtonLink href="/production/log" icon={NotebookPen}>All work orders</ButtonLink>
          <ButtonLink href={`/production/work-orders/${id}`} icon={ClipboardList}>Work order</ButtonLink>
          {canRecord ? <Button variant="primary" icon={Plus} onClick={() => { setAddDate(undefined); setAdding(true); }}>Record Production</Button> : null}
        </>}
      />

      <ProductionLogView wo={wo} canRecord={canRecord} onAdd={(iso) => { setAddDate(iso); setAdding(true); }} />

      {adding ? (
        <RecordDialog
          wo={wo}
          machines={machines || []}
          defaultDate={addDate}
          onClose={() => setAdding(false)}
          onDone={(updated: any) => { mutate(updated); setAdding(false); }}
        />
      ) : null}
    </>
  );
}
