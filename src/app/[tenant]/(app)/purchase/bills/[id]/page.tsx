'use client';
// Purchase bill: A4 office copy (prints as the bill), 3-way match against the PO and GRN, ledger postings, vendor
// payments, debit invoices and approvals. Post a draft, release a bill on hold, record a payment.
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, CircleCheck, CircleAlert, FileMinus, HandCoins, PackageCheck, Printer, Receipt, Send, Undo2, Wallet, X } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, dateTime, inr, num, rupeesInWords, todayIso } from '@/lib/format';
import { billStatus, toneOf } from '@/lib/status';
import { Alert, Badge, Button, ButtonLink, Card, ErrorBox, Field, ListItem, Loading, Modal, PageHeader, SelectField, StatusBadge, TextAreaField, TextField, useToast } from '@/components/ui';
import { SheetFrame, SheetHead } from '@/components/PrintSheet';
import { Attachments } from '@/components/docs/Attachments';

const MODES = ['NEFT', 'RTGS', 'Cheque', 'UPI', 'Cash'];

export default function PurchaseBillPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: b, error, mutate } = useApi<any>(`/purchase-bills/${id}`);
  const [pay, setPay] = useState<null | { amount: string; paymentDate: string; mode: string; reference: string }>(null);
  const [reason, setReason] = useState<null | { action: 'reject' | 'cancel'; text: string }>(null);
  const [busy, setBusy] = useState('');

  if (error) return <ErrorBox error={error} />;
  if (!b) return <Loading rows={8} />;

  const status = billStatus(b);
  const company = user?.company;
  const inter = b.gst.igst > 0;
  const actions: string[] = b.actions || [];
  const canEdit = can('pbills', 'edit'), canApprove = can('pbills', 'approve');

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      const r = await post(`/purchase-bills/${id}/actions/${action}`, body);
      await mutate(r, { revalidate: false });
      setReason(null);
      toast.ok(action === 'post' ? (r.status === 'On hold' ? `Posted · on hold (${r.matchStatus})` : r.matchStatus === '3-way OK' ? 'Posted · 3-way match OK' : `Posted · approved with ${r.matchStatus}`) : action === 'approve' ? 'Bill released for payment' : action === 'reject' ? 'Bill sent back to draft' : 'Bill cancelled');
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  async function recordPayment() {
    if (!pay) return;
    setBusy('pay');
    try {
      const r = await post(`/purchase-bills/${id}/payments`, { amount: Number(pay.amount), paymentDate: pay.paymentDate || undefined, mode: pay.mode, reference: pay.reference.trim() || undefined });
      await mutate(r, { revalidate: false });
      setPay(null);
      toast.ok(r.status === 'Paid' ? `${r.number} paid in full` : `Payment recorded · balance ${inr(r.balance)}`);
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  const amount = Number(pay?.amount || 0);
  const amountErr = !pay?.amount ? null : amount <= 0 ? 'Enter an amount above zero' : amount > b.balance + 0.5 ? `Balance is only ${inr(b.balance, 2)}` : null;
  const billedByPoLine: Record<number, number> = {};
  for (const l of b.lines) if (l.poLineId) billedByPoLine[l.poLineId] = (billedByPoLine[l.poLineId] || 0) + l.qty;

  return (
    <>
      <div className="no-print">
        <PageHeader back="/purchase/bills"
          crumbs={[{ label: company?.shortName || '' }, { label: 'Purchase' }, { label: 'Purchase Bills', href: '/purchase/bills' }, { label: b.number }]}
          title={`Purchase bill ${b.number}`}
          tags={<><StatusBadge kind="pb" status={status} />{b.matchStatus ? <Badge tone={toneOf('match', b.matchStatus)}>{b.matchStatus}</Badge> : null}{b.balance > 0 && ['Approved', 'Part paid'].includes(b.status) ? <Badge tone={b.overdueDays ? 'danger' : 'neutral'} dot={false}>Due {date(b.dueDate)}</Badge> : null}</>}
          sub={`${b.vendorName} · ${b.vendorCode} · vendor invoice ${b.vendorInvoiceNo}`}
          actions={<>
            <Button icon={Printer} onClick={() => window.print()}>Print</Button>
            {actions.includes('cancel') && canEdit ? <Button variant="danger-outline" icon={X} onClick={() => setReason({ action: 'cancel', text: '' })}>Cancel bill</Button> : null}
            {actions.includes('approve') && canApprove ? <Button icon={Undo2} onClick={() => setReason({ action: 'reject', text: '' })}>Send back</Button> : null}
            {actions.includes('approve') && canApprove ? <Button variant="success" icon={Check} loading={busy === 'approve'} onClick={() => act('approve')}>Release for payment</Button> : null}
            {actions.includes('post') && canEdit ? <Button variant="primary" icon={Send} loading={busy === 'post'} onClick={() => act('post')}>Post bill</Button> : null}
            {['Approved', 'Part paid', 'Paid'].includes(b.status) && can('debitinv', 'create') ? <ButtonLink icon={FileMinus} href={`/purchase/debit-notes/new?bill=${b.id}`}>Debit invoice</ButtonLink> : null}
            {actions.includes('pay') && can('pbills', 'create') ? <Button variant="primary" icon={HandCoins} onClick={() => setPay({ amount: String(b.balance), paymentDate: todayIso(), mode: 'NEFT', reference: '' })}>Record payment</Button> : null}
          </>} />
        {b.status === 'On hold' ? <div style={{ marginTop: 16 }}><Alert tone="warning" title={`On hold · ${b.matchStatus}`}>{b.matchNote}. {canApprove ? 'Release it for payment or send it back to the buyer.' : 'Waiting for a manager in Approvals.'}</Alert></div> : null}
        {b.status === 'Draft' ? <div style={{ marginTop: 16 }}><Alert tone="info" title="Draft">Post the bill to run the 3-way match against {b.poNumber || 'the PO'}{b.grnNumber ? ' and ' + b.grnNumber : ''}.</Alert></div> : null}
      </div>

      <div className="grid main-side sheet-layout">
        <SheetFrame fileName={`${b.number}.pdf`}>
          <SheetHead company={{ name: company?.name || '', city: company?.city, gstin: company?.gstin }} title="PURCHASE BILL" subtitle="Office copy · booked in KCERP" number={b.number} date={date(b.billDate)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="box">
              <div className="lbl">Vendor</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{b.vendorName}</div>
              <div className="muted">Vendor code {b.vendorCode}</div>
              <div className="muted">{b.vendorCity || '—'}</div>
              <div>GSTIN {b.vendorGstin || 'Unregistered'}</div>
            </div>
            <div className="box">
              <div className="lbl">Received at</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{company?.name}</div>
              <div className="muted">RM Store · {company?.city}</div>
              <div>GSTIN {company?.gstin || '—'}</div>
            </div>
          </div>
          <div className="meta">
            <div><div className="lbl">Vendor invoice</div><div className="v">{b.vendorInvoiceNo}{b.vendorInvoiceDate ? ' · ' + date(b.vendorInvoiceDate) : ''}</div></div>
            <div><div className="lbl">Against PO</div><div className="v">{b.poNumber || '—'}</div></div>
            <div><div className="lbl">GRN</div><div className="v">{b.grnNumber || '—'}</div></div>
            <div><div className="lbl">Payment terms</div><div className="v">Net {b.paymentTermsDays}</div></div>
            <div><div className="lbl">Due date</div><div className="v">{date(b.dueDate)}</div></div>
            <div><div className="lbl">3-way match</div><div className="v">{b.matchStatus || 'Not posted'}</div></div>
          </div>
          <table>
            <thead><tr><th style={{ width: 24 }}>#</th><th>Description</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Disc</th><th className="r">Taxable</th><th className="r">GST</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {b.lines.map((l: any, i: number) => {
                const taxable = l.amount;
                return (
                  <tr key={l.id}>
                    <td>{i + 1}</td>
                    <td><div style={{ fontWeight: 600 }}>{l.itemName}</div><div className="muted" style={{ fontSize: 11 }}>{l.itemCode}{l.hsn ? ' · HSN ' + l.hsn : ''}{l.lotNo ? ' · Heat / lot ' + l.lotNo : ''}</div></td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>{num(l.qty, 3)} {l.uom}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>{inr(l.rate, 2)}</td>
                    <td className="r">{l.discPct ? l.discPct + '%' : '—'}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>{inr(taxable, 2)}</td>
                    <td className="r">{l.taxPct}%</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>{inr(taxable * (1 + l.taxPct / 100), 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-end' }}>
            <div style={{ maxWidth: 320 }}>
              <div className="lbl">Amount in words</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{rupeesInWords(b.total)}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>• Booked after 3-way match (PO · GRN · invoice).<br />• TDS deducted as shown.<br />• Shortages and rejections are settled through a debit invoice.</div>
            </div>
            <div className="tot">
              <span className="muted">Gross</span><span className="r">{inr(b.gross, 2)}</span>
              {b.discount ? <><span className="muted">Discount</span><span className="r">−{inr(b.discount, 2)}</span></> : null}
              <span className="muted">Taxable value</span><span className="r">{inr(b.taxable, 2)}</span>
              {inter ? <><span className="muted">IGST</span><span className="r">{inr(b.gst.igst, 2)}</span></> : <><span className="muted">CGST</span><span className="r">{inr(b.gst.cgst, 2)}</span><span className="muted">SGST</span><span className="r">{inr(b.gst.sgst, 2)}</span></>}
              {b.tds ? <><span className="muted">TDS ({b.tdsPct}%)</span><span className="r">−{inr(b.tds, 2)}</span></> : null}
              <span className="grand">Payable</span><span className="r grand">{inr(b.total, 2)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eef1f6', paddingTop: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600 }}>For {company?.name}</div>
              <div className="muted" style={{ marginTop: 22 }}>Authorised signatory</div>
            </div>
          </div>
        </SheetFrame>

        <div className="stack no-print">
          <Card title="Summary">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><div className="text-sm muted">Payable</div><div className="h3 num">{inr(b.total)}</div></div>
              <div><div className="text-sm muted">Paid</div><div className="h3 num f-success">{inr(b.amountPaid)}</div></div>
              <div><div className="text-sm muted">Balance</div><div className={'h3 num' + (b.balance > 0 ? '' : ' muted')}>{inr(b.balance)}</div></div>
              <div><div className="text-sm muted">Input GST</div><div className="h3 num">{inr(b.tax)}</div></div>
            </div>
          </Card>

          {b.poLines.length ? (
            <Card title="3-way match" sub={`${b.poNumber} · GRN ${b.grnNumber || 'all receipts'}`}>
              <div className="list">
                {b.poLines.map((p: any) => {
                  const line = b.lines.find((l: any) => l.poLineId === p.id);
                  const netRate = line ? line.rate * (1 - (line.discPct || 0) / 100) : null;
                  const rateOk = netRate === null || !p.rate || Math.abs(netRate - p.rate) / p.rate <= 0.01;
                  const qtyOk = p.qtyBilled <= p.qtyReceived + 0.0005;
                  return (
                    <div key={p.id} className="li" style={{ alignItems: 'flex-start' }}>
                      {rateOk && qtyOk ? <CircleCheck size={18} className="f-success" style={{ marginTop: 2 }} /> : <CircleAlert size={18} className="f-warning" style={{ marginTop: 2 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="lt truncate">{p.itemCode} · {p.itemName}</div>
                        <div className="ls">Ordered {num(p.qty)} · received {num(p.qtyReceived)} · billed {num(p.qtyBilled)} {p.uom}</div>
                        <div className="ls">PO rate {inr(p.rate, 2)}{netRate !== null ? ` · this bill ${inr(netRate, 2)}` : ' · not on this bill'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          <Card title="Ledger postings" sub={b.status === 'Draft' ? 'Created when the bill is posted' : 'Posted with the bill'}>
            <div className="list">
              {b.postings.map((p: any) => (
                <div key={p.ledger} className="li" style={{ padding: '9px 0' }}>
                  <div style={{ flex: 1, minWidth: 0 }} className="text-sm">{p.ledger}</div>
                  <span className={'text-xs strong ' + (p.debit ? 'f-info' : 'f-warning')} style={{ width: 22 }}>{p.debit ? 'Dr' : 'Cr'}</span>
                  <span className="num text-sm strong nowrap" style={{ minWidth: 110, textAlign: 'right' }}>{inr(p.debit || p.credit, 2)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Payments" sub={b.payments.length ? `${b.payments.length} payment${b.payments.length === 1 ? '' : 's'}` : undefined}>
            <div className="list">
              {b.payments.length ? b.payments.map((p: any) => (
                <ListItem key={p.id} icon={p.mode === 'Debit note' ? FileMinus : Wallet} tone={p.mode === 'Debit note' ? 'warning' : 'success'} title={`${inr(p.amount, 2)} · ${p.mode}`} sub={`${p.number}${p.reference && p.reference !== p.number ? ' · ' + p.reference : ''} · ${date(p.paymentDate)}`} />
              )) : <div className="empty text-sm">No payments yet</div>}
            </div>
          </Card>

          {b.debitNotes.length ? (
            <Card title="Debit invoices">
              <div className="list">
                {b.debitNotes.map((d: any) => <ListItem key={d.id} icon={FileMinus} tone="warning" title={`${d.number} · ${inr(d.total)}`} sub={`${d.reason} · ${date(d.noteDate)}`} right={<StatusBadge kind="note" status={d.status} />} href={`/purchase/debit-notes/${d.id}`} />)}
              </div>
            </Card>
          ) : null}

          <Card title="Linked to">
            <div className="list">
              {b.purchaseOrderId ? <ListItem icon={Receipt} tone="teal" title={`Purchase order ${b.poNumber}`} sub={b.vendorName} href={`/purchase/orders/${b.purchaseOrderId}`} /> : <div className="empty text-sm">Direct bill · no purchase order</div>}
              {b.grnId ? <ListItem icon={PackageCheck} tone="warning" title={`Goods receipt ${b.grnNumber}`} sub="Received quantities" href={`/warehouse/grn/${b.grnId}`} /> : null}
            </div>
          </Card>

          {b.approvals.length ? (
            <Card title="Approvals">
              <div className="list">
                {b.approvals.map((a: any) => <ListItem key={a.id} icon={Check} tone={toneOf('approval', a.status)} title={a.title} sub={a.status === 'Pending' ? `Requested ${dateTime(a.createdAt)}` : `${a.status} by ${a.decidedByName || '—'} · ${dateTime(a.decidedAt)}${a.comment ? ' · ' + a.comment : ''}`} right={<StatusBadge kind="approval" status={a.status} />} />)}
              </div>
            </Card>
          ) : null}

          <Attachments entityType="PB" entityId={b.id} entityNo={b.number} />
        </div>
      </div>

      <Modal open={!!pay} onClose={() => setPay(null)} title="Record vendor payment" sub={`${b.number} · ${b.vendorName} · balance ${inr(b.balance, 2)}`}
        footer={<><Button onClick={() => setPay(null)}>Cancel</Button><Button variant="primary" loading={busy === 'pay'} disabled={!pay?.amount || !!amountErr} onClick={recordPayment}>Record payment</Button></>}>
        {pay ? (
          <div className="form c2">
            <Field label="Amount (₹)" error={amountErr} hint="Defaults to the full balance">
              {(fid) => <input id={fid} className="input num" type="number" min={0} step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />}
            </Field>
            <TextField label="Payment date" type="date" value={pay.paymentDate} onChange={(v) => setPay({ ...pay, paymentDate: v })} />
            <SelectField label="Mode" value={pay.mode} onChange={(v) => setPay({ ...pay, mode: v })} options={MODES.map((m) => ({ value: m, label: m }))} />
            <TextField label="Reference" value={pay.reference} onChange={(v) => setPay({ ...pay, reference: v })} placeholder="UTR or cheque number" />
          </div>
        ) : null}
      </Modal>

      <Modal open={!!reason} onClose={() => setReason(null)} title={reason?.action === 'cancel' ? `Cancel ${b.number}?` : `Send ${b.number} back?`}
        sub={reason?.action === 'cancel' ? 'The bill is kept for the record but can no longer be paid' : 'It goes back to draft so the buyer can correct it and post again'}
        footer={<><Button onClick={() => setReason(null)}>Keep</Button><Button variant="danger" loading={!!busy} disabled={!reason || reason.text.trim().length < 3} onClick={() => reason && act(reason.action, reason.action === 'cancel' ? { reason: reason.text.trim() } : { comment: reason.text.trim() })}>{reason?.action === 'cancel' ? 'Cancel bill' : 'Send back'}</Button></>}>
        <TextAreaField label="Reason" value={reason?.text || ''} onChange={(v) => reason && setReason({ ...reason, text: v })} rows={3} placeholder={reason?.action === 'cancel' ? 'e.g. duplicate of PB-1180' : 'e.g. ask the vendor for a revised invoice at the PO rate'} />
      </Modal>
    </>
  );
}
