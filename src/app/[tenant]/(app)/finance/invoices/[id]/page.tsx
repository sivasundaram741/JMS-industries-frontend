'use client';
// Sales invoice: an A4 tax invoice preview (prints as the invoice), totals and payments, and recording a payment.
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, FileX2, HandCoins, Printer, ShoppingCart, Truck, Wallet } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, inr, num, todayIso } from '@/lib/format';
import { Badge, Button, ButtonLink, Card, ErrorBox, Field, ListItem, Loading, Modal, PageHeader, SelectField, StatusBadge, TextField, useToast } from '@/components/ui';
import { Attachments } from '@/components/docs/Attachments';

const SELLER_GSTIN = '33AABCF4471K1Z2';
const MODES = ['NEFT', 'RTGS', 'Cheque', 'UPI', 'Cash'];

const PRINT_CSS = `@media print {
  @page { size: A4; margin: 12mm; }
  .sidebar, .topbar, .ribbon, .no-print, .toasts, .overlay { display: none !important; }
  body, .content, .main { background: #fff !important; }
  .content { padding: 0 !important; max-width: none !important; display: block !important; }
  .inv-layout { display: block !important; }
  .inv-sheet-wrap { border: 0 !important; box-shadow: none !important; background: #fff !important; }
  .inv-sheet-wrap > .inv-bar { display: none !important; }
  .inv-sheet-wrap > .inv-bg { padding: 0 !important; background: #fff !important; }
  .inv-sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; padding: 0 !important; }
}
.inv-sheet { color: #101828; background: #fff; }
.inv-sheet .muted { color: #667085; }
.inv-sheet table { width: 100%; border-collapse: collapse; font-size: 12px; }
.inv-sheet th { text-align: left; font-size: 11px; font-weight: 600; color: #667085; padding: 8px 10px; background: #f7f8fa; border-bottom: 1px solid #e4e7ec; }
.inv-sheet td { padding: 9px 10px; border-bottom: 1px solid #eef1f6; vertical-align: top; }
.inv-sheet .r { text-align: right; }
.inv-sheet .box { border: 1px solid #e4e7ec; border-radius: 8px; padding: 12px 14px; }
.inv-sheet .lbl { font-size: 10px; letter-spacing: .6px; text-transform: uppercase; font-weight: 600; color: #667085; }
.inv-sheet .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 16px; background: #f7f8fa; border-radius: 8px; padding: 12px 14px; }
.inv-sheet .meta .v { font-size: 12px; font-weight: 600; margin-top: 1px; word-break: break-all; }
.inv-sheet .tot { display: grid; grid-template-columns: 1fr auto; gap: 6px 24px; font-size: 12px; min-width: 260px; }`;

const shortIrn = (irn?: string | null) => (irn ? irn.slice(0, 12) + '…' + irn.slice(-8) : '—');

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: inv, error, mutate } = useApi<any>(`/finance/invoices/${id}`);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ amount: '', paymentDate: todayIso(), mode: 'NEFT', reference: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  function startPayment() {
    setF({ amount: String(inv.balance), paymentDate: todayIso(), mode: 'NEFT', reference: '' });
    setOpen(true);
  }
  async function pay() {
    setBusy(true);
    try {
      const r = await post(`/finance/invoices/${id}/payments`, { amount: Number(f.amount), paymentDate: f.paymentDate || undefined, mode: f.mode, reference: f.reference.trim() || undefined });
      await mutate();
      setOpen(false);
      toast.ok(r.status === 'Paid' ? `${r.number} paid in full` : `Payment recorded · balance ${inr(r.balance)}`);
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  if (error) return <ErrorBox error={error} />;
  if (!inv) return <Loading rows={6} />;

  const intraState = (inv.customerGstin || '').slice(0, 2) === (user?.company.gstin || SELLER_GSTIN).slice(0, 2);
  const amount = Number(f.amount);
  const amountErr: string | null = !f.amount ? null : amount <= 0 ? 'Enter an amount above zero' : amount > inv.balance + 0.5 ? `Balance is only ${inr(inv.balance, 2)}` : null;
  const canPay = can('finance', 'create') && inv.balance > 0 && inv.status !== 'Cancelled';
  const company = user?.company;

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="no-print">
        <PageHeader
          back="/finance"
          crumbs={[{ label: company?.shortName || '' }, { label: 'Finance' }, { label: 'Invoicing & Payments', href: '/finance' }, { label: inv.number }]}
          title={`Tax invoice ${inv.number}`}
          tags={<><StatusBadge kind="inv" status={inv.displayStatus} />{inv.irn ? <Badge tone="success">e-Invoice IRN generated</Badge> : null}</>}
          sub={`${inv.customerName} · ${inv.salesOrderNo} · due ${date(inv.dueDate)}`}
          actions={<>
            <Button icon={Printer} onClick={() => window.print()}>Print</Button>
            {can('creditinv', 'create') && inv.status !== 'Cancelled' ? <ButtonLink icon={FileX2} href={`/finance/credit-notes/new?invoice=${inv.id}`}>Credit invoice</ButtonLink> : null}
            {canPay ? <Button variant="primary" icon={HandCoins} onClick={startPayment}>Record payment</Button> : null}
          </>}
        />
      </div>

      <div className="grid main-side inv-layout">
        <section className="card inv-sheet-wrap" style={{ overflow: 'hidden' }}>
          <div className="inv-bar row" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-default)' }}>
            <FileText size={16} className="muted" />
            <span className="strong text-sm">{inv.number}.pdf</span>
            <span className="text-sm muted">A4 · page 1 of 1</span>
          </div>
          <div className="inv-bg" style={{ background: 'var(--bg-muted)', padding: 24 }}>
            <div className="inv-sheet" style={{ maxWidth: 794, margin: '0 auto', padding: '36px 36px 28px', borderRadius: 4, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#155eef', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, flex: 'none' }}>FE</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{company?.name || 'Forgetech Engineering Pvt Ltd'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{company?.city || 'Hosur'}, Tamil Nadu</div>
                  <div className="muted" style={{ fontSize: 12 }}>GSTIN {user?.company.gstin || SELLER_GSTIN}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>TAX INVOICE</div>
                  <div className="muted" style={{ fontSize: 12 }}>Original for recipient</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>No. {inv.number}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Date {date(inv.invoiceDate)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="box">
                  <div className="lbl">Bill to</div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{inv.customerName}</div>
                  {inv.customerAddress ? <div className="muted" style={{ fontSize: 12 }}>{inv.customerAddress}</div> : null}
                  <div className="muted" style={{ fontSize: 12 }}>{inv.customerCity || '—'}</div>
                  <div style={{ fontSize: 12 }}>GSTIN {inv.customerGstin || 'Unregistered'}</div>
                </div>
                <div className="box">
                  <div className="lbl">Ship to</div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{inv.customerName}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{inv.customerCity || '—'}</div>
                  <div style={{ fontSize: 12 }}>Delivery challan {inv.shipmentNo || '—'}</div>
                </div>
              </div>

              <div className="meta">
                <div><div className="lbl">Invoice date</div><div className="v">{date(inv.invoiceDate)}</div></div>
                <div><div className="lbl">Due date</div><div className="v">{date(inv.dueDate)}</div></div>
                <div><div className="lbl">Customer order</div><div className="v">{inv.salesOrderNo}</div></div>
                <div><div className="lbl">Customer PO</div><div className="v">{inv.customerPo || '—'}</div></div>
                <div><div className="lbl">Delivery challan</div><div className="v">{inv.shipmentNo || '—'}</div></div>
                <div><div className="lbl">IRN</div><div className="v" title={inv.irn || undefined}>{shortIrn(inv.irn)}</div></div>
              </div>

              <table>
                <thead>
                  <tr><th style={{ width: 28 }}>#</th><th>Description</th><th>HSN</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">GST</th><th className="r">Amount</th></tr>
                </thead>
                <tbody>
                  {inv.lines.map((l: any, i: number) => (
                    <tr key={l.id}>
                      <td>{i + 1}</td>
                      <td><div style={{ fontWeight: 600 }}>{l.itemName}</div><div className="muted" style={{ fontSize: 11 }}>{l.itemCode}</div></td>
                      <td className="nowrap">{l.hsn || '—'}</td>
                      <td className="r nowrap">{num(l.qty)} {l.uom}</td>
                      <td className="r nowrap">{inr(l.rate, 2)}</td>
                      <td className="r">{l.taxPct}%</td>
                      <td className="r nowrap">{inr(l.amount, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-end' }}>
                <div className="muted" style={{ fontSize: 11, maxWidth: 320 }}>
                  Payment within the due date by NEFT / RTGS to the account on file. Interest may apply on overdue balances. This is a computer-generated invoice.
                </div>
                <div className="tot">
                  <span className="muted">Taxable value</span><span className="r">{inr(inv.subtotal, 2)}</span>
                  {intraState ? (
                    <>
                      <span className="muted">CGST</span><span className="r">{inr(inv.tax / 2, 2)}</span>
                      <span className="muted">SGST</span><span className="r">{inr(inv.tax / 2, 2)}</span>
                    </>
                  ) : <><span className="muted">IGST</span><span className="r">{inr(inv.tax, 2)}</span></>}
                  <span style={{ fontWeight: 700, fontSize: 14, borderTop: '1px solid #e4e7ec', paddingTop: 6 }}>Total</span>
                  <span className="r" style={{ fontWeight: 700, fontSize: 14, borderTop: '1px solid #e4e7ec', paddingTop: 6 }}>{inr(inv.total, 2)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #eef1f6', paddingTop: 14 }}>
                <div style={{ fontSize: 12 }}><span className="muted">Amount payable (in figures)</span> <b>{inr(inv.total, 2)}</b></div>
                <div style={{ textAlign: 'right', fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>For {company?.name || 'Forgetech Engineering Pvt Ltd'}</div>
                  <div className="muted" style={{ marginTop: 22 }}>Authorised signatory</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="stack no-print">
          <Card title="Summary">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><div className="text-sm muted">Total</div><div className="h3 num">{inr(inv.total)}</div></div>
              <div><div className="text-sm muted">Paid</div><div className="h3 num f-success">{inr(inv.amountPaid)}</div></div>
              <div><div className="text-sm muted">Balance</div><div className={'h3 num' + (inv.balance > 0 ? '' : ' muted')}>{inr(inv.balance)}</div></div>
              <div><div className="text-sm muted">Overdue</div><div className={'h3 num' + (inv.overdueDays > 0 ? ' f-danger' : ' muted')}>{inv.overdueDays > 0 ? `${inv.overdueDays} d` : 'No'}</div></div>
            </div>
          </Card>
          <Card title="Payments" sub={inv.payments.length ? `${inv.payments.length} receipt${inv.payments.length === 1 ? '' : 's'}` : undefined} right={canPay ? <Button size="sm" icon={HandCoins} onClick={startPayment}>Record</Button> : null}>
            <div className="list">
              {inv.payments.length ? inv.payments.map((p: any) => (
                <ListItem key={p.id} icon={Wallet} tone="success" title={`${inr(p.amount)} · ${p.mode}`} sub={`${p.number}${p.reference ? ' · ' + p.reference : ''} · ${date(p.paymentDate)}`} />
              )) : <div className="empty text-sm">No payments yet</div>}
            </div>
          </Card>
          <Card title="Linked to">
            <div className="list">
              <ListItem icon={ShoppingCart} tone="info" title={`Customer order ${inv.salesOrderNo}`} sub={inv.customerPo ? 'Customer PO ' + inv.customerPo : inv.customerName} href={`/sales/orders/${inv.salesOrderId}`} />
              {inv.shipmentId ? <ListItem icon={Truck} tone="info" title={`Delivery challan ${inv.shipmentNo}`} sub="Invoice raised on delivery" href={`/dispatch/${inv.shipmentId}`} /> : null}
            </div>
          </Card>
          <Attachments entityType="INV" entityId={inv.id} entityNo={inv.number} />
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Record payment" sub={`${inv.number} · ${inv.customerName} · balance ${inr(inv.balance, 2)}`}
        footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!f.amount || !!amountErr} onClick={pay}>Record payment</Button></>}>
        <div className="form c2">
          <Field label="Amount (₹)" error={amountErr} hint="Defaults to the full balance">
            {(fid) => <input id={fid} className="input num" type="number" min={0} step="0.01" value={f.amount} onChange={(e) => set('amount')(e.target.value)} />}
          </Field>
          <TextField label="Payment date" type="date" value={f.paymentDate} onChange={set('paymentDate')} />
          <SelectField label="Mode" value={f.mode} onChange={set('mode')} options={MODES.map((m) => ({ value: m, label: m }))} />
          <TextField label="Reference" value={f.reference} onChange={set('reference')} placeholder="UTR, cheque or UPI reference" />
        </div>
      </Modal>
    </>
  );
}
