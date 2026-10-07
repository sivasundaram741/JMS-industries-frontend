'use client';
// One stock return: lines with condition, the stock moves it made, and Send / Receive / Cancel.
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, PackageCheck, Printer, Send, X } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, dateTime, inr, num } from '@/lib/format';
import { Alert, Button, Card, DataTable, ErrorBox, KeyValue, ListItem, Loading, Modal, PageHeader, StatStrip, StatusBadge, Two, useToast } from '@/components/ui';
import { Attachments } from '@/components/docs/Attachments';

const WH: Record<string, string> = { RM: 'RM Store', FG: 'FG Store', QC: 'QC Hold', WIP: 'Shop floor', TRN: 'In transit' };

export default function StockReturnPage() {
  const { id } = useParams<{ id: string }>();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: r, error, mutate } = useApi<any>(`/stock-returns/${id}`);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(false);

  if (error) return <ErrorBox error={error} />;
  if (!r) return <Loading rows={8} />;
  const actions: string[] = r.actions || [];
  const canEdit = can('stockreturns', 'edit');
  const units = r.lines.reduce((a: number, l: any) => a + l.qty, 0);
  const bad = r.lines.filter((l: any) => l.condition !== 'Resaleable').reduce((a: number, l: any) => a + l.qty, 0);

  async function act(action: string) {
    setBusy(action);
    try {
      const x = await post(`/stock-returns/${id}/actions/${action}`);
      await mutate(x, { revalidate: false });
      setConfirm(false);
      toast.ok(action === 'send' ? 'Sent · stock is in transit' : action === 'receive' ? 'Received · stock is back' : 'Stock return cancelled');
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  return (
    <>
      <PageHeader back="/warehouse/returns"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Warehouse' }, { label: 'Stock Returns', href: '/warehouse/returns' }, { label: r.number }]}
        title={`Stock return ${r.number}`} tags={<StatusBadge kind="sr" status={r.status} />}
        sub={<span className="row" style={{ gap: 6 }}>{r.fromName}<ArrowRight size={14} />{r.toName} · {r.reason} · {date(r.returnDate)}</span>}
        actions={<>
          <Button icon={Printer} onClick={() => window.print()}>Print</Button>
          {actions.includes('cancel') && canEdit ? <Button variant="danger-outline" icon={X} onClick={() => setConfirm(true)}>Cancel</Button> : null}
          {actions.includes('send') && canEdit ? <Button variant="primary" icon={Send} loading={busy === 'send'} onClick={() => act('send')}>Send</Button> : null}
          {actions.includes('receive') && canEdit ? <Button variant="primary" icon={PackageCheck} loading={busy === 'receive'} onClick={() => act('receive')}>Receive at {WH[r.toWarehouse]}</Button> : null}
        </>} />
      {r.status === 'In transit' ? <Alert tone="warning" title="In transit">Stock left {r.fromName} and waits in transit. Receive it when it reaches {r.toName}{bad ? ` · ${num(bad)} damaged / expired units go to QC Hold` : ''}.</Alert> : null}
      <StatStrip items={[
        { label: 'Products', value: r.lines.length },
        { label: 'Units', value: num(units, 3) },
        { label: 'Value at standard cost', value: inr(r.value) },
        { label: 'To QC Hold on receipt', value: num(bad, 3), color: bad ? 'danger' : undefined },
      ]} />
      <div className="grid main-side">
        <div className="stack">
          <DataTable
            toolbar={<div className="toolbar"><div><div className="tt">Products</div><div className="ts">Lines without a lot were split per lot, oldest first, when sent</div></div></div>}
            rows={r.lines}
            columns={[
              { key: 'item', header: 'Item', render: (l: any) => <Two a={l.itemName} b={l.itemCode} /> },
              { key: 'lot', header: 'Lot', render: (l: any) => <span className="num">{l.lotNo || '—'}</span> },
              { key: 'qty', header: 'Qty', align: 'right', render: (l: any) => `${num(l.qty, 3)} ${l.uom}` },
              { key: 'reason', header: 'Reason', render: (l: any) => <span className="secondary">{l.reason || r.reason}</span> },
              { key: 'cond', header: 'Condition', render: (l: any) => <StatusBadge kind="cond" status={l.condition} /> },
              { key: 'land', header: 'Lands in', render: (l: any) => (l.condition === 'Resaleable' ? WH[r.toWarehouse] : 'QC Hold') },
            ]}
          />
          <Card title="Stock movement" sub={r.stockMoves.length ? 'Posted to the stock ledger' : 'Stock moves when the return is sent'}>
            <div className="list">
              {r.stockMoves.length ? r.stockMoves.map((m: any) => (
                <ListItem key={m.id} icon={m.qty < 0 ? ArrowUpRight : ArrowDownLeft} tone={m.qty < 0 ? 'danger' : 'success'} title={`${m.qty < 0 ? '' : '+'}${num(m.qty, 3)} · ${m.itemCode}`} sub={`${WH[m.warehouse] || m.warehouse}${m.lotNo ? ' · lot ' + m.lotNo : ''} · ${dateTime(m.createdAt)}`} />
              )) : <div className="empty text-sm">Nothing moved yet</div>}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Details">
            <KeyValue cols={1} items={[
              ['From', r.fromName], ['To', r.toName], ['Return date', date(r.returnDate)], ['Reason', r.reason], ['Requested by', r.requestedBy || '—'],
              ['Vehicle', r.vehicleNo || '—'], ['Challan', r.challanNo || '—'], ['Notes', r.notes || '—'], ['Created', dateTime(r.createdAt)],
            ]} />
          </Card>
          <Attachments entityType="SR" entityId={r.id} entityNo={r.number} />
        </div>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Cancel ${r.number}?`} sub={r.status === 'In transit' ? 'Stock in transit goes back to ' + r.fromName : 'Nothing has moved yet'}
        footer={<><Button onClick={() => setConfirm(false)}>Keep</Button><Button variant="danger" icon={X} loading={busy === 'cancel'} onClick={() => act('cancel')}>Cancel return</Button></>}>
        <div className="text-sm secondary">The return stays in the list as Cancelled.</div>
      </Modal>
    </>
  );
}
