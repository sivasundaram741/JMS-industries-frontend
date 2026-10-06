'use client';
// One debit / credit invoice: the printed note (A4), stock moved on approval, approvals and settlement.
import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, FileText, Printer, Send, Undo2, X } from 'lucide-react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { date, dateTime, inr, num, rupeesInWords } from '@/lib/format';
import { toneOf } from '@/lib/status';
import { Alert, Badge, Button, Card, Chip, ErrorBox, ListItem, Loading, Modal, PageHeader, StatusBadge, TextAreaField, useToast } from '@/components/ui';
import { SheetFrame, SheetHead } from '@/components/PrintSheet';
import { Attachments } from '@/components/docs/Attachments';
import { NOTES, type NoteKind } from './config';

const WH: Record<string, string> = { RM: 'RM Store', FG: 'FG Store', QC: 'QC Hold', WIP: 'Shop floor', TRN: 'In transit' };

export function NoteView({ kind, id }: { kind: NoteKind; id: string }) {
  const c = NOTES[kind];
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: n, error, mutate } = useApi<any>(`${c.api}/${id}`);
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState<null | { action: 'reject' | 'cancel'; text: string }>(null);

  if (error) return <ErrorBox error={error} />;
  if (!n) return <Loading rows={8} />;

  const actions: string[] = n.actions || [];
  const canEdit = can(c.module, 'edit'), canApprove = can(c.module, 'approve');
  const company = user?.company;
  const inter = n.gst.igst > 0;

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      const r = await post(`${c.api}/${id}/actions/${action}`, body);
      await mutate(r, { revalidate: false });
      setReason(null);
      const msg: Record<string, string> = { submit: r.status === 'Pending approval' ? 'Sent for approval' : `Approved · ${r.status}`, approve: `Approved · ${r.status}`, reject: 'Sent back to draft', settle: 'Marked settled', cancel: `${c.label} cancelled` };
      toast.ok(msg[action] || 'Done');
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  return (
    <>
      <div className="no-print">
        <PageHeader back={c.href}
          crumbs={[{ label: company?.shortName || '' }, { label: c.section }, { label: c.plural, href: c.href }, { label: n.number }]}
          title={`${c.label} ${n.number}`}
          tags={<><StatusBadge kind="note" status={n.status} /><Chip>{n.settlement}</Chip></>}
          sub={`${n.partyName} · ${n.partyCode}${n.sourceNo ? ` · against ${n.sourceNo}` : ''} · ${n.reason}`}
          actions={<>
            <Button icon={Printer} onClick={() => window.print()}>Print</Button>
            {actions.includes('cancel') && canEdit ? <Button variant="danger-outline" icon={X} onClick={() => setReason({ action: 'cancel', text: '' })}>Cancel</Button> : null}
            {actions.includes('reject') && canApprove ? <Button icon={Undo2} onClick={() => setReason({ action: 'reject', text: '' })}>Send back</Button> : null}
            {actions.includes('approve') && canApprove ? <Button variant="success" icon={Check} loading={busy === 'approve'} onClick={() => act('approve')}>Approve</Button> : null}
            {actions.includes('submit') && canEdit ? <Button variant="primary" icon={Send} loading={busy === 'submit'} onClick={() => act('submit')}>Send for approval</Button> : null}
            {actions.includes('settle') && canEdit ? <Button variant="primary" icon={Check} loading={busy === 'settle'} onClick={() => act('settle')}>Mark {n.settlement === 'Refund' ? 'refunded' : 'replaced'}</Button> : null}
          </>} />
        {n.status === 'Pending approval' ? <div style={{ marginTop: 16 }}><Alert tone="warning" title="Waiting for manager sign-off">{canApprove ? 'Approving moves the stock and settles the value.' : 'A manager approves it in Approvals.'}</Alert></div> : null}
        {n.status === 'Approved' && n.settlement !== 'Adjust' ? <div style={{ marginTop: 16 }}><Alert tone="info" title={n.settlement === 'Refund' ? 'Waiting for the refund' : 'Waiting for the replacement'}>Mark it settled once {n.settlement === 'Refund' ? 'the money is received / paid' : 'the replacement goods are received / shipped'}.</Alert></div> : null}
      </div>

      <div className="grid main-side sheet-layout">
        <SheetFrame fileName={`${n.number}.pdf`}>
          <SheetHead company={{ name: company?.name || '', city: company?.city, gstin: company?.gstin }} title={c.noteTitle} subtitle={kind === 'debit' ? 'Issued to vendor' : 'Issued to customer'} number={n.number} date={date(n.noteDate)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="box">
              <div className="lbl">{c.party}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{n.partyName}</div>
              <div className="muted">{c.party} code {n.partyCode}</div>
              <div className="muted">{n.partyCity || '—'}</div>
              <div>GSTIN {n.partyGstin || 'Unregistered'}</div>
            </div>
            <div className="box">
              <div className="lbl">Against</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{n.sourceNo || 'No original document'}</div>
              <div className="muted">{c.source}</div>
              <div>Reason: {n.reason}</div>
              <div>Settlement: {c.settle[n.settlement as 'Adjust'].title}</div>
            </div>
          </div>
          <table>
            <thead><tr><th style={{ width: 24 }}>#</th><th>Description</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Taxable</th><th className="r">GST</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {n.lines.map((l: any, i: number) => (
                <tr key={l.id}>
                  <td>{i + 1}</td>
                  <td><div style={{ fontWeight: 600 }}>{l.itemName}</div><div className="muted" style={{ fontSize: 11 }}>{l.itemCode}{l.hsn ? ' · HSN ' + l.hsn : ''}{l.lotNo ? ' · Lot ' + l.lotNo : ''} · {l.reason || n.reason} · {l.condition}</div></td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>{num(l.qty, 3)} {l.uom}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>{inr(l.rate, 2)}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>{inr(l.amount, 2)}</td>
                  <td className="r">{l.taxPct}%</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>{inr(l.amount * (1 + l.taxPct / 100), 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-end' }}>
            <div style={{ maxWidth: 320 }}>
              <div className="lbl">Amount in words</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{rupeesInWords(n.total)}</div>
              {n.notes ? <div className="muted" style={{ marginTop: 10 }}>{n.notes}</div> : null}
            </div>
            <div className="tot">
              <span className="muted">Taxable value</span><span className="r">{inr(n.subtotal, 2)}</span>
              {inter ? <><span className="muted">IGST reversal</span><span className="r">{inr(n.gst.igst, 2)}</span></> : <><span className="muted">CGST reversal</span><span className="r">{inr(n.gst.cgst, 2)}</span><span className="muted">SGST reversal</span><span className="r">{inr(n.gst.sgst, 2)}</span></>}
              <span className="grand">{kind === 'debit' ? 'Debit value' : 'Credit value'}</span><span className="r grand">{inr(n.total, 2)}</span>
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
              <div><div className="text-sm muted">{kind === 'debit' ? 'Debit value' : 'Credit value'}</div><div className="h3 num">{inr(n.total)}</div></div>
              <div><div className="text-sm muted">GST reversal</div><div className="h3 num">{inr(n.tax)}</div></div>
              <div><div className="text-sm muted">Products</div><div className="h3 num">{n.lines.length}</div></div>
              <div><div className="text-sm muted">{c.whLabel.replace(' location', '')}</div><div className="h3">{WH[n.warehouse] || n.warehouse}</div></div>
            </div>
          </Card>
          <Card title="Stock movement" sub={n.stockMoves.length ? 'Posted on approval' : 'Stock moves when the invoice is approved'}>
            <div className="list">
              {n.stockMoves.length ? n.stockMoves.map((m: any) => (
                <ListItem key={m.id} icon={m.qty < 0 ? ArrowUpRight : ArrowDownLeft} tone={m.qty < 0 ? 'danger' : 'success'} title={`${m.qty < 0 ? '' : '+'}${num(m.qty, 3)} · ${m.itemCode}`} sub={`${WH[m.warehouse] || m.warehouse}${m.lotNo ? ' · lot ' + m.lotNo : ''} · ${dateTime(m.createdAt)}`} />
              )) : <div className="empty text-sm">Nothing moved yet</div>}
            </div>
          </Card>
          <Card title="Linked to">
            <div className="list">
              {n.sourceId ? <ListItem icon={FileText} tone="info" title={`${c.source} ${n.sourceNo}`} sub={n.partyName} href={c.sourceHref(n.sourceId)} /> : <div className="empty text-sm">Not against a {c.source.toLowerCase()}</div>}
            </div>
          </Card>
          {n.approvals.length ? (
            <Card title="Approvals">
              <div className="list">
                {n.approvals.map((a: any) => <ListItem key={a.id} icon={Check} tone={toneOf('approval', a.status)} title={a.title} sub={a.status === 'Pending' ? `Requested ${dateTime(a.createdAt)}` : `${a.status} by ${a.decidedByName || '—'} · ${dateTime(a.decidedAt)}${a.comment ? ' · ' + a.comment : ''}`} right={<Badge tone={toneOf('approval', a.status)}>{a.status}</Badge>} />)}
              </div>
            </Card>
          ) : null}
          <Attachments entityType={c.entity} entityId={n.id} entityNo={n.number} />
        </div>
      </div>

      <Modal open={!!reason} onClose={() => setReason(null)} title={reason?.action === 'cancel' ? `Cancel ${n.number}?` : `Send ${n.number} back?`}
        sub={reason?.action === 'cancel' ? 'Nothing has moved yet · the invoice is kept for the record' : 'It goes back to draft for changes'}
        footer={<><Button onClick={() => setReason(null)}>Keep</Button><Button variant="danger" loading={!!busy} disabled={!reason || reason.text.trim().length < 3} onClick={() => reason && act(reason.action, { comment: reason.text.trim(), reason: reason.text.trim() })}>{reason?.action === 'cancel' ? 'Cancel invoice' : 'Send back'}</Button></>}>
        <TextAreaField label="Reason" value={reason?.text || ''} onChange={(v) => reason && setReason({ ...reason, text: v })} rows={3} />
      </Modal>
    </>
  );
}
