'use client';
// NCR & CAPA tab: nonconformances with their 8D stage and disposition; a row opens the NCR to update the
// 8D stage, root cause and action, or to close it with a disposition. ?focus=<id> opens that NCR.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { get, patch, post, qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { dateShort, dateTime, num } from '@/lib/format';
import { Alert, Button, Chip, DataTable, ErrorBox, KeyValue, ListToolbar, Modal, Pagination, SelectField, StatusBadge, Stepper, TextAreaField, Two, useToast } from '@/components/ui';

const FILTERS = [{ key: '', label: 'All' }, { key: 'Open', label: 'Open' }, { key: 'Closed', label: 'Closed' }];
const EIGHT_D = ['D1–D2 · Team & problem', 'D3 · Containment', 'D4 · Root cause', 'D5–D6 · Corrective action', 'D7 · Prevent', 'D8 · Close'];
const STAGES = [
  { value: 'D1', label: 'D1 · Team formed' }, { value: 'D2', label: 'D2 · Problem described' }, { value: 'D3', label: 'D3 · Containment' },
  { value: 'D4', label: 'D4 · Root cause' }, { value: 'D5', label: 'D5 · Corrective action chosen' }, { value: 'D6', label: 'D6 · Corrective action done' }, { value: 'D7', label: 'D7 · Prevent recurrence' },
];
const stageIdx = (s: string) => ({ D1: 0, D2: 0, D3: 1, D4: 2, D5: 3, D6: 3, D7: 4, D8: 6 } as Record<string, number>)[s] ?? 0;
const DISPOSITION_NOTE: Record<string, string> = {
  Rework: 'The pieces are reworked and a new inspection lot is raised for them.',
  Scrap: 'The pieces are written off from QC Hold.',
  'Use as is': 'The pieces are released from QC Hold to store as they are (concession).',
  'Return to vendor': 'The pieces leave QC Hold and go back to the supplier.',
};

export function NcrTab({ focus, onChanged }: { focus: string | null; onChanged: () => void }) {
  const router = useRouter();
  const L = useListState();
  const { data, error, isLoading, mutate } = useApi<Page<any>>('/quality/ncrs' + qs(L.params));
  const [sel, setSel] = useState<any>(null);
  const tried = useRef<string | null>(null);

  // Open the NCR named in ?focus=<id> (look further than the current page when needed)
  useEffect(() => {
    if (!focus || !data || tried.current === focus) return;
    tried.current = focus;
    const hit = data.rows.find((r) => String(r.id) === focus);
    if (hit) { setSel(hit); return; }
    get<Page<any>>('/quality/ncrs?pageSize=200').then((all) => { const x = all.rows.find((r) => String(r.id) === focus); if (x) setSel(x); }).catch(() => {});
  }, [focus, data]);

  function close() {
    setSel(null);
    if (focus) router.replace('/quality?tab=ncr');
  }
  function changed(n: any) {
    mutate();
    onChanged();
    setSel((s: any) => (s ? { ...s, ...n } : s));
  }

  return (
    <>
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search NCR, item, defect…" chips={{ options: FILTERS, value: L.status, onChange: L.setStatus }} />}
        rows={data?.rows}
        onRowClick={(r) => setSel(r)}
        empty="No NCRs match"
        columns={[
          { key: 'number', header: 'NCR', render: (r) => <Two a={r.number} b={dateShort(r.createdAt)} /> },
          { key: 'item', header: 'Item · defect', render: (r) => <Two a={`${r.itemCode} · ${r.itemName}`} b={r.defect} /> },
          { key: 'qty', header: 'Qty', align: 'right', render: (r) => num(r.qty) },
          { key: 'source', header: 'Source', render: (r) => <div className="stack" style={{ gap: 2 }}><span><Chip tone={r.source === 'Supplier' ? 'teal' : undefined}>{r.source}</Chip></span><span className="text-xs muted nowrap">{r.sourceNo} · {r.lotNoRef}</span></div> },
          { key: 'disp', header: 'Disposition', render: (r) => <StatusBadge kind="ncr" status={r.disposition} /> },
          { key: 'stage', header: '8D stage', render: (r) => <Chip tone="info">{r.stage}</Chip> },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="ncr" status={r.status} /> },
        ]}
        footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="NCRs" /> : null}
      />
      {sel ? <NcrDialog key={sel.id} ncr={sel} onClose={close} onChanged={changed} /> : null}
    </>
  );
}

function NcrDialog({ ncr, onClose, onChanged }: { ncr: any; onClose: () => void; onChanged: (n: any) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [stage, setStage] = useState(ncr.stage === 'D8' ? 'D7' : ncr.stage);
  const [rootCause, setRootCause] = useState(ncr.rootCause || '');
  const [action, setAction] = useState(ncr.action || '');
  const [disposition, setDisposition] = useState('');
  const [busy, setBusy] = useState('');
  const open = ncr.status !== 'Closed';
  const editable = open && can('quality', 'edit');
  const options = ['Rework', 'Scrap', 'Use as is', ...(ncr.source === 'Supplier' ? ['Return to vendor'] : [])];

  async function save() {
    setBusy('save');
    try {
      const r = await patch(`/quality/ncrs/${ncr.id}`, { stage, rootCause, action });
      toast.ok(`${ncr.number} · ${r.stage} saved`);
      onChanged(r);
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  async function closeNcr() {
    setBusy('close');
    try {
      const r = await post(`/quality/ncrs/${ncr.id}/close`, { disposition, rootCause: rootCause || undefined, action: action || undefined });
      toast.ok(`${ncr.number} closed · ${disposition}`);
      onChanged(r);
    } catch (e) { toast.err(e); } finally { setBusy(''); }
  }

  return (
    <Modal open wide onClose={onClose} title={`${ncr.number} · ${ncr.itemName}`}
      sub={<>{num(ncr.qty)} pcs · {ncr.defect} · found at <Link href={`/quality/inspections/${ncr.inspectionLotId}`}>{ncr.lotNoRef}</Link> · from {ncr.sourceNo} · {ncr.source}</>}
      footer={editable ? <>
        <Button onClick={onClose}>Cancel</Button>
        <Button loading={busy === 'save'} onClick={save}>Save progress</Button>
        <Button variant="primary" loading={busy === 'close'} disabled={!disposition} onClick={closeNcr}>Close NCR{disposition ? ' · ' + disposition.toLowerCase() : ''}</Button>
      </> : <Button onClick={onClose}>Done</Button>}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="row" style={{ gap: 8 }}>
          <StatusBadge kind="ncr" status={ncr.status} />
          <StatusBadge kind="ncr" status={ncr.disposition} label={ncr.disposition === 'Pending' ? 'Disposition pending' : ncr.disposition} />
        </div>
        <Stepper current={stageIdx(ncr.stage)} steps={EIGHT_D.map((l) => ({ label: l }))} />
        {editable ? (
          <>
            <div className="form c2">
              <SelectField label="8D stage" value={stage} onChange={setStage} options={STAGES} />
              <div />
              <TextAreaField className="full" label="Root cause (D4)" value={rootCause} onChange={setRootCause} placeholder="e.g. Grinding wheel dressing interval too long" rows={2} />
              <TextAreaField className="full" label="Corrective & preventive action (D5–D7)" value={action} onChange={setAction} placeholder="e.g. Dress wheel every 40 pcs · update control plan" rows={2} />
            </div>
            <div className="divider" />
            <div className="stack" style={{ gap: 10 }}>
              <div className="h4">Close with a disposition</div>
              <div className="chips" role="radiogroup" aria-label="Disposition">
                {options.map((o) => <button key={o} type="button" role="radio" aria-checked={disposition === o} className={disposition === o ? 'on' : ''} onClick={() => setDisposition(o)}>{o}</button>)}
              </div>
              {disposition ? <Alert tone={disposition === 'Scrap' ? 'warning' : 'info'} title={disposition}>{DISPOSITION_NOTE[disposition]} The NCR moves to D8 and closes.</Alert>
                : <div className="text-xs muted">{ncr.source === 'Supplier' ? 'Supplier material can also be returned to the vendor.' : 'Return to vendor is only for supplier NCRs.'}</div>}
            </div>
          </>
        ) : (
          <KeyValue items={[
            ['Disposition', ncr.disposition],
            ['8D stage', ncr.stage],
            ['Root cause', ncr.rootCause],
            ['Action', ncr.action],
            ['Raised', dateTime(ncr.createdAt)],
            ['Closed', ncr.closedAt ? dateTime(ncr.closedAt) : 'Open'],
          ]} />
        )}
      </div>
    </Modal>
  );
}
