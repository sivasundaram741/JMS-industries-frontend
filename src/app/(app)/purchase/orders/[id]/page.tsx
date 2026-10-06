'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Check, CircleCheck, ClipboardList, FileCheck, Handshake, PackagePlus, Receipt, Send, ShoppingCart, X } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, dateShort, dateTime, inr, inrShort, num, todayIso } from '@/lib/format';
import { toneOf } from '@/lib/status';
import { Alert, Button, Card, Chip, DataTable, ErrorBox, KeyValue, ListItem, Loading, Modal, PageHeader, StatStrip, StatusBadge, Stepper, TextField, Two, useToast } from '@/components/ui';
import { ReceiveModal } from '../_components/ReceiveModal';
import { Attachments } from '@/components/docs/Attachments';

const FLOW = ['Requisition', 'Approved', 'Sent', 'Acknowledged', 'Received', 'Billed'];
const STEP: Record<string, number> = { Draft: 0, 'Pending approval': 1, Approved: 2, Sent: 3, Acknowledged: 4, 'Partially received': 4, Received: 5, Billed: 6, Cancelled: 0 };

export default function PurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: po, error, mutate } = useApi<any>(`/purchase-orders/${id}`);
  const { data: meta } = useApi<any>('/meta');
  const [busy, setBusy] = useState('');
  const [dlg, setDlg] = useState<'' | 'receive' | 'bill' | 'cancel'>('');
  const [bill, setBill] = useState({ billNo: '', amount: '' });
  const [reason, setReason] = useState('');

  const canEdit = can('purchase', 'edit') || can('subcon', 'edit');
  const canReceive = can('stockentry', 'create') || can('purchase', 'create');

  // Open the receive dialog when arriving from GRN & Stock Entry (?receive=1)
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !po || sp.get('receive') !== '1') return;
    autoOpened.current = true;
    if (po.actions.includes('receive') && canReceive) setDlg('receive');
  }, [po, sp, canReceive]);

  async function act(action: string, body: any = {}, msg?: (r: any) => string) {
    setBusy(action);
    try {
      const r = await post(`/purchase-orders/${id}/actions/${action}`, body);
      await mutate(r, { revalidate: false });
      toast.ok(msg ? msg(r) : `${r.number} · ${r.status}`);
      setDlg('');
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  if (error) return <ErrorBox error={error} />;
  if (!po) return <Loading rows={6} />;

  const jw = po.type === 'JOB_WORK';
  const has = (a: string) => po.actions.includes(a);
  const userName = (uid?: number | null) => meta?.users?.find((u: any) => u.id === uid)?.name;
  const ordered = po.lines.reduce((a: number, l: any) => a + l.qty, 0);
  const received = po.lines.reduce((a: number, l: any) => a + l.qtyReceived, 0);
  const pct = ordered ? Math.round((received / ordered) * 100) : 0;
  const late = !!po.needBy && po.needBy < todayIso() && ['Approved', 'Sent', 'Acknowledged', 'Partially received'].includes(po.status);
  const decided = [...po.approvals].reverse().find((a: any) => a.status === 'Approved');
  const lastGrn = po.grns[po.grns.length - 1];
  const at = (s: string) => (po.status === s ? dateShort(po.statusAt) : undefined);
  const listHref = jw ? '/purchase/subcontracting' : '/purchase/orders';
  const step = STEP[po.status] ?? 0;

  return (
    <>
      <PageHeader
        back={listHref}
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Purchase' }, { label: jw ? 'Subcontracting' : 'Purchase Orders', href: listHref }, { label: po.number }]}
        title={po.number}
        tags={<><StatusBadge kind="po" status={po.status} /><Chip tone={jw ? 'purple' : undefined}>{jw ? 'Job work' : 'Purchase order'}</Chip></>}
        sub={[po.vendorName, `ordered ${date(po.orderDate)}`, `need by ${date(po.needBy)}`, po.salesOrderNo, po.workOrderNo].filter(Boolean).join(' · ')}
        actions={<>
          {has('cancel') && canEdit ? <Button variant="danger-outline" icon={X} onClick={() => { setReason(''); setDlg('cancel'); }}>Cancel</Button> : null}
          {has('submit') && canEdit ? <Button variant="primary" icon={Send} loading={busy === 'submit'} onClick={() => act('submit', {}, (r) => (r.status === 'Pending approval' ? `${r.number} sent for approval` : `${r.number} approved`))}>Submit for approval</Button> : null}
          {has('approve') && can('purchase', 'approve') ? <Button variant="success" icon={Check} loading={busy === 'approve'} onClick={() => act('approve', {}, (r) => `${r.number} approved`)}>Approve</Button> : null}
          {has('send') && canEdit ? <Button variant="primary" icon={Send} loading={busy === 'send'} onClick={() => act('send', {}, (r) => `${r.number} sent to ${r.vendorName}`)}>Send to vendor</Button> : null}
          {has('acknowledge') && canEdit ? <Button icon={Handshake} loading={busy === 'acknowledge'} onClick={() => act('acknowledge', {}, (r) => `${r.number} acknowledged by vendor`)}>Mark acknowledged</Button> : null}
          {has('receive') && canReceive ? <Button variant="primary" icon={PackagePlus} onClick={() => setDlg('receive')}>Receive goods</Button> : null}
          {has('bill') && canEdit ? <Button variant={has('receive') ? 'secondary' : 'primary'} icon={Receipt} onClick={() => { setBill({ billNo: '', amount: String(po.total) }); setDlg('bill'); }}>Book vendor bill</Button> : null}
        </>}
      />
      {po.status === 'Cancelled' ? <Alert tone="neutral" title="This order was cancelled">It stays on record · no goods can be received against it.</Alert> : null}
      {po.status === 'Pending approval' && !can('purchase', 'approve') ? <Alert tone="warning" title="Waiting for a manager's approval">The order value is above the approval limit.</Alert> : null}
      <StatStrip items={[
        { label: 'Order value', value: inr(po.total) },
        { label: 'Ordered', value: num(ordered) },
        { label: jw ? 'Returned' : 'Received', value: num(received), tag: pct + '%', tone: pct >= 100 ? 'success' : pct ? 'warning' : 'neutral' },
        { label: jw ? 'Due back' : 'Need by', value: date(po.needBy), color: late ? 'danger' : undefined },
        { label: 'Vendor bill', value: po.vendorBillNo ? <span className="truncate" style={{ fontSize: 16 }} title={po.vendorBillNo}>{po.vendorBillNo}</span> : <span className="text-sm muted">Not booked</span>, tag: po.vendorBillNo ? inrShort(po.billedAmount) : undefined, tone: 'success' },
      ]} />
      <Card title={jw ? 'Job-work tracking' : 'Procure-to-pay tracking'}>
        <Stepper current={po.status === 'Cancelled' ? -1 : step} steps={[
          { label: FLOW[0], sub: `${po.number} · ${dateShort(po.orderDate)}` },
          { label: FLOW[1], sub: decided ? `${userName(decided.decidedBy) || 'Manager'} · ${dateShort(decided.decidedAt)}` : po.status === 'Pending approval' ? 'Waiting for a manager' : step > 1 ? 'Within the approval limit' : undefined },
          { label: FLOW[2], sub: at('Sent') || (step > 2 ? po.vendorEmail || 'Sent' : undefined) },
          { label: FLOW[3], sub: at('Acknowledged') },
          { label: FLOW[4], sub: po.grns.length ? `${po.grns.length} GRN · ${dateShort(lastGrn.receivedDate)}` : undefined },
          { label: FLOW[5], sub: po.vendorBillNo || undefined },
        ]} />
      </Card>
      <div className="grid main-side">
        <div className="stack">
          <DataTable
            toolbar={<div className="toolbar"><div><div className="tt">Items</div><div className="ts">Quantities ordered vs {jw ? 'returned' : 'received'}</div></div></div>}
            rows={po.lines}
            columns={[
              { key: 'item', header: 'Item', width: '34%', render: (l) => <Two a={l.itemName} b={l.itemCode} /> },
              { key: 'qty', header: 'Ordered', align: 'right', render: (l) => <span className="nowrap">{num(l.qty, 3)} {l.uom}</span> },
              { key: 'rec', header: jw ? 'Returned' : 'Received', align: 'right', render: (l) => <span className={l.qtyReceived >= l.qty ? 'f-success strong' : ''}>{num(l.qtyReceived, 3)}</span> },
              { key: 'open', header: 'Open', align: 'right', render: (l) => <span className={l.qty - l.qtyReceived > 0 ? 'strong' : 'muted'}>{num(Math.max(0, l.qty - l.qtyReceived), 3)}</span> },
              { key: 'rate', header: 'Rate', align: 'right', render: (l) => inr(l.rate, 2) },
              { key: 'tax', header: 'GST', align: 'right', render: (l) => l.taxPct + '%' },
              { key: 'amount', header: 'Amount', align: 'right', render: (l) => inr(l.amount, 2) },
            ]}
            footer={<div className="tfoot"><span>Subtotal {inr(po.subtotal, 2)} · GST {inr(po.tax, 2)}</span><span className="strong" style={{ color: 'var(--text-primary)' }}>Total {inr(po.total, 2)}</span></div>}
          />
          <Card title={jw ? 'Returns · GRNs' : 'Goods receipts'} sub="Stock lands in QC Hold until incoming inspection"
            right={has('receive') && canReceive ? <Button size="sm" icon={PackagePlus} onClick={() => setDlg('receive')}>Receive goods</Button> : null}>
            <div className="list">
              {po.grns.length ? po.grns.map((g: any) => (
                <ListItem key={g.id} icon={PackagePlus} tone={toneOf('grn', g.status)} title={`${g.number} · ${date(g.receivedDate)}`}
                  sub={[g.vendorInvoiceNo ? 'Invoice ' + g.vendorInvoiceNo : null, g.vehicleNo].filter(Boolean).join(' · ') || 'No invoice recorded'}
                  right={<StatusBadge kind="grn" status={g.status} />} href={`/warehouse/grn/${g.id}`} />
              )) : <div className="empty text-sm">Nothing received yet</div>}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Vendor">
            <KeyValue items={[['Name', po.vendorName], ['Code', po.vendorCode], ['City', po.vendorCity], ['GSTIN', po.vendorGstin], ['Email', po.vendorEmail ? <a href={`mailto:${po.vendorEmail}`}>{po.vendorEmail}</a> : null], ['Notes', po.notes]]} />
          </Card>
          <Card title="Approvals" sub={po.approvals.length ? undefined : `Needed above the approval limit`}>
            <div className="list">
              {po.approvals.length ? po.approvals.map((a: any) => (
                <ListItem key={a.id} icon={a.status === 'Approved' ? CircleCheck : FileCheck} tone={toneOf('approval', a.status)}
                  title={`${a.number} · ${a.amountText || ''}`}
                  sub={a.decidedAt ? `${a.status} by ${userName(a.decidedBy) || 'manager'} · ${dateTime(a.decidedAt)}${a.comment ? ' · ' + a.comment : ''}` : `Raised ${dateTime(a.createdAt)}${userName(a.createdBy) ? ' by ' + userName(a.createdBy) : ''}`}
                  right={<StatusBadge kind="approval" status={a.status} />} />
              )) : <div className="empty text-sm" style={{ padding: '12px 0' }}>{['Draft', 'Cancelled'].includes(po.status) ? 'Not submitted yet' : 'Approved within the limit'}</div>}
            </div>
          </Card>
          <Card title="Linked records">
            <div className="list">
              {po.salesOrderId ? <ListItem icon={ShoppingCart} tone="info" title={po.salesOrderNo} sub="Customer order" href={`/sales/orders/${po.salesOrderId}`} /> : null}
              {po.workOrderId ? <ListItem icon={ClipboardList} tone="danger" title={po.workOrderNo} sub={jw ? 'Work order this job work is for' : 'Work order'} href={`/production/work-orders/${po.workOrderId}`} /> : null}
              {!po.salesOrderId && !po.workOrderId ? <div className="empty text-sm" style={{ padding: '12px 0' }}>Not linked to an order · raised for stock</div> : null}
            </div>
          </Card>
          <Attachments entityType="PO" entityId={po.id} entityNo={po.number} />
        </div>
      </div>

      <ReceiveModal po={po} open={dlg === 'receive'} onClose={() => setDlg('')} onDone={(r) => { setDlg(''); mutate(r.purchaseOrder, { revalidate: false }); }} />
      <Modal open={dlg === 'bill'} onClose={() => setDlg('')} title="Book vendor bill" sub={`${po.vendorName} · matched against ${po.number} and its GRNs`}
        footer={<><Button onClick={() => setDlg('')}>Cancel</Button><Button variant="primary" icon={Receipt} loading={busy === 'bill'} disabled={!bill.billNo.trim()} onClick={() => act('bill', { billNo: bill.billNo.trim(), amount: Number(bill.amount) || undefined }, (r) => `${r.vendorBillNo} booked on ${r.number}`)}>Book bill</Button></>}>
        <div className="form c2">
          <TextField label="Vendor bill no" value={bill.billNo} onChange={(v) => setBill({ ...bill, billNo: v })} placeholder="e.g. SF/26/9921" required />
          <TextField label="Bill amount (₹)" type="number" value={bill.amount} onChange={(v) => setBill({ ...bill, amount: v })} hint={`Order total ${inr(po.total, 2)}`} />
        </div>
      </Modal>
      <Modal open={dlg === 'cancel'} onClose={() => setDlg('')} title={`Cancel ${po.number}?`} sub="The order stays on record as cancelled"
        footer={<><Button onClick={() => setDlg('')}>Keep order</Button><Button variant="danger" loading={busy === 'cancel'} onClick={() => act('cancel', { reason: reason || undefined }, (r) => `${r.number} cancelled`)}>Cancel order</Button></>}>
        <TextField label="Reason" value={reason} onChange={setReason} placeholder="e.g. Vendor cannot meet the date" />
      </Modal>
    </>
  );
}
