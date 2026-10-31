'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { Check, ClipboardList, FileMinus, FileText, FileX2, IdCard, Receipt, ShieldAlert, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { post, qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { ago, dateShort, dateTime } from '@/lib/format';
import type { Tone } from '@/lib/status';
import { Button, Chip, DataTable, ErrorBox, IconTile, ListToolbar, Modal, PageHeader, Pagination, StatusBadge, Tabs, TextAreaField, useToast } from '@/components/ui';

interface Approval {
  id: number; number: string; entityType: 'PO' | 'WO' | 'SO_CREDIT' | 'PB' | 'DN' | 'CN' | 'PAYROLL'; entityId: number; entityNo: string; module: string; title: string; detail: string | null;
  amountText: string | null; status: 'Pending' | 'Approved' | 'Rejected'; decidedAt: string | null; comment: string | null; createdAt: string; requestedBy: string | null; canDecide: boolean;
}

const KIND: Record<string, { icon: LucideIcon; tone: Tone; href: (id: number) => string }> = {
  PO: { icon: Receipt, tone: 'teal', href: (id) => `/purchase/orders/${id}` },
  WO: { icon: ClipboardList, tone: 'danger', href: (id) => `/production/work-orders/${id}` },
  PAYROLL: { icon: IdCard, tone: 'success', href: (id) => `/hr?tab=payroll&run=${id}` },
};
// Details carry ISO dates (due 2026-10-04); show them like the rest of the app
const tidy = (t: string) => t.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) => dateShort(d));
const MODULE: Record<string, string> = { purchase: 'Buying', subcon: 'Job work', wo: 'Production', quality: 'Quality', hr: 'People' };

export default function ApprovalsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { mutate: mutateAll } = useSWRConfig();
  const L = useListState({ status: 'Pending' });
  const status = L.status || 'Pending';
  const { data, error, isLoading } = useApi<Page<Approval>>('/approvals' + qs({ ...L.params, status }));
  // Same key as the sidebar badge, so both stay in step
  const { data: pending } = useApi<Page<Approval>>('/approvals?pageSize=1');
  const { data: approved } = useApi<Page<Approval>>('/approvals?status=Approved&pageSize=1');
  const { data: rejected } = useApi<Page<Approval>>('/approvals?status=Rejected&pageSize=1');
  const [busy, setBusy] = useState<string>('');
  const [rejecting, setRejecting] = useState<Approval | null>(null);
  const [comment, setComment] = useState('');

  async function decide(a: Approval, decision: 'approve' | 'reject', body: { comment?: string } = {}) {
    setBusy(decision + a.id);
    try {
      await post(`/approvals/${a.id}/${decision}`, body);
      toast.ok(decision === 'approve' ? `${a.entityNo} approved` : `${a.entityNo} rejected`);
      setRejecting(null);
      // Refresh every approvals list on screen (this page, sidebar badge, notifications)
      await mutateAll((key) => typeof key === 'string' && key.startsWith('/approvals'));
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Approvals' }]}
        title="Approvals"
        sub={`${pending ? `${pending.total} request${pending.total === 1 ? '' : 's'} waiting · ` : ''}purchase orders, work order releases, credit overrides, bills on hold, debit & credit invoices and payroll`}
      />
      <Tabs active={status} items={[
        { key: 'Pending', label: 'Pending', count: pending?.total, onClick: () => L.setStatus('Pending') },
        { key: 'Approved', label: 'Approved', count: approved?.total, onClick: () => L.setStatus('Approved') },
        { key: 'Rejected', label: 'Rejected', count: rejected?.total, onClick: () => L.setStatus('Rejected') },
      ]} />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search requests…" />}
        rows={data?.rows}
        rowHref={(r) => KIND[r.entityType]?.href(r.entityId)}
        empty={status === 'Pending' ? 'Nothing waiting for approval' : `No ${status.toLowerCase()} requests`}
        columns={[
          {
            key: 'title', header: 'Request', render: (r) => {
              const k = KIND[r.entityType];
              return (
                <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                  {k ? <IconTile icon={k.icon} tone={k.tone} size={34} /> : null}
                  <div style={{ minWidth: 0 }}>
                    <div className="strong">{r.title}</div>
                    <div className="text-xs muted">{r.detail ? tidy(r.detail) : r.number}</div>
                    {r.status !== 'Pending' && r.comment ? <div className="text-xs secondary" style={{ marginTop: 2 }}>“{r.comment}”</div> : null}
                  </div>
                </div>
              );
            },
          },
          { key: 'module', header: 'Module', render: (r) => <Chip>{MODULE[r.module] || r.module}</Chip> },
          { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="strong nowrap">{r.amountText || '—'}</span> },
          { key: 'by', header: 'Requested by', render: (r) => <span className="secondary nowrap">{r.requestedBy || '—'}</span> },
          { key: 'age', header: status === 'Pending' ? 'Waiting' : 'Decided', render: (r) => <span className="secondary nowrap" title={dateTime(r.decidedAt || r.createdAt)}>{ago(status === 'Pending' ? r.createdAt : r.decidedAt || r.createdAt)}</span> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="approval" status={r.status} /> },
          {
            key: 'act', header: '', align: 'right', render: (r) => (r.status !== 'Pending' ? null : r.canDecide ? (
              <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="danger-outline" icon={X} disabled={!!busy} onClick={() => { setComment(''); setRejecting(r); }}>Reject</Button>
                <Button size="sm" variant="success" icon={Check} loading={busy === 'approve' + r.id} disabled={!!busy && busy !== 'approve' + r.id} onClick={() => decide(r, 'approve')}>Approve</Button>
              </div>
            ) : <span className="text-xs muted nowrap">Waiting for approver</span>),
          },
        ]}
        footer={data && data.total > data.pageSize ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="requests" /> : null}
      />

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject ${rejecting?.entityNo || ''}?`} sub={rejecting ? `${rejecting.title} · requested by ${rejecting.requestedBy || '—'}` : undefined}
        footer={<><Button onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" icon={X} loading={!!rejecting && busy === 'reject' + rejecting.id} disabled={comment.trim().length < 3} onClick={() => rejecting && decide(rejecting, 'reject', { comment: comment.trim() })}>Reject request</Button></>}>
        <TextAreaField label="Reason" value={comment} onChange={setComment} placeholder="Tell the requester what to change, e.g. split the PO or get a second quote" rows={3} />
      </Modal>
    </>
  );
}
