'use client';
// Overview · Document Tracking: every file attached to every entry — where it is linked, who added it, and what is
// missing (by the mandatory document rules) or expiring.
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useEffect, useState } from 'react';
import { CalendarClock, Download, FileCheck2, FileClock, FileWarning, FolderOpen, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api, put, qs, saveBlob, toCsv, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { ago, dateShort, dateTime, fileSize, num } from '@/lib/format';
import { hrefFor } from '@/lib/links';
import { Alert, Badge, Button, Card, Checkbox, Chip, DataTable, ErrorBox, Kpi, ListItem, ListToolbar, Loading, Modal, PageHeader, Pagination, ProgressBar, SelectField, StatusBadge, TextField, Toggle, Two, useToast } from '@/components/ui';
import { DOC_MODULE_LABEL as MODULE_LABEL, docStatus, fileIcon, type Doc } from '@/components/docs/Attachments';
import { UploadModal, useDocMeta } from '@/components/docs/UploadModal';

const MODULE_TONE: Record<string, 'info' | 'teal' | 'warning' | 'danger' | 'neutral' | 'purple' | 'success'> = { sales: 'info', purchase: 'teal', store: 'warning', prod: 'danger', quality: 'neutral', dispatch: 'info', finance: 'teal', hr: 'purple', general: 'neutral' };
const STATUS = [{ key: '', label: 'All' }, { key: 'Pending', label: 'Waiting for verification' }, { key: 'Verified', label: 'Verified' }, { key: 'Rejected', label: 'Rejected' }, { key: 'Expiring', label: 'Expiring' }];

interface Summary { stored: number; thisMonth: number; thisWeek: number; lastWeek: number; pendingVerification: number; expiring30: number; expired: number; missing: number; byModule: Array<{ module: string; count: number }> }
interface Missing { rule: string; ruleType: string; entityType: string; entityId: number; entityNo: string; sub: string | null; date: string | null; missing: string[] }
interface Rule { id?: number; entityType: string; label: string; docTypes: string[]; isActive: boolean }
interface DocEvent { id: number; attachmentId: number; action: string; note: string | null; userName: string | null; createdAt: string; fileName: string; entityNo: string | null }

export default function DocumentsPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const L = useListState();
  const [module, setModule] = useState('');
  const [entity, setEntity] = useState<{ type: string; id: string } | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('entityType') && sp.get('entityId')) setEntity({ type: sp.get('entityType')!, id: sp.get('entityId')! });
  }, []);
  const listPath = '/documents' + qs({ ...L.params, module: module || undefined, entityType: entity?.type, entityId: entity?.id });
  const { data, error, isLoading, mutate } = useApi<Page<Doc>>(listPath);
  const { data: sum, mutate: mutateSum } = useApi<Summary>('/documents/summary');
  const { data: missing, mutate: mutateMissing } = useApi<Missing[]>('/documents/missing');
  const { data: expiring } = useApi<Doc[]>('/documents/expiring');
  const { data: events, mutate: mutateEvents } = useApi<DocEvent[]>('/documents/events?limit=8');
  const { data: rules, mutate: mutateRules } = useApi<Rule[]>('/documents/rules');
  const { data: meta } = useDocMeta();
  const [upload, setUpload] = useState<null | { entityType?: string; entityId?: number; entityNo?: string; docType?: string }>(null);
  const [editRules, setEditRules] = useState<Rule[] | null>(null);
  const [saving, setSaving] = useState(false);

  const refreshAll = () => { mutate(); mutateSum(); mutateMissing(); mutateEvents(); };

  async function exportCsv() {
    try {
      const all = await api<Page<Doc>>('/documents' + qs({ search: L.params.search, status: L.params.status, module: module || undefined, entityType: entity?.type, entityId: entity?.id, pageSize: 200 }));
      const rows = all.rows.map((d) => ({ ...d, linked: d.entityNo || 'Company', module: MODULE_LABEL[d.module] || d.module, status: docStatus(d), size: fileSize(d.sizeBytes), added: dateTime(d.createdAt) }));
      saveBlob(new Blob([toCsv([
        { key: 'number', label: 'Document no.' }, { key: 'fileName', label: 'File' }, { key: 'docType', label: 'Type' }, { key: 'linked', label: 'Linked entry' },
        { key: 'module', label: 'Module' }, { key: 'addedBy', label: 'Added by' }, { key: 'added', label: 'Added' }, { key: 'version', label: 'Version' },
        { key: 'expiresOn', label: 'Expires' }, { key: 'status', label: 'Status' }, { key: 'size', label: 'Size' },
      ], rows)], { type: 'text/csv;charset=utf-8' }), 'documents.csv');
    } catch (e) { toast.err(e); }
  }

  async function saveRules() {
    if (!editRules) return;
    setSaving(true);
    try {
      await put('/documents/rules', { rules: editRules.filter((r) => r.label.trim()).map((r) => ({ entityType: r.entityType, label: r.label.trim(), docTypes: r.docTypes, isActive: r.isActive })) });
      toast.ok('Document rules saved');
      setEditRules(null);
      mutateRules();
      mutateMissing();
      mutateSum();
    } catch (e) { toast.err(e); } finally { setSaving(false); }
  }

  const weekDelta = sum ? (sum.lastWeek ? Math.round(((sum.thisWeek - sum.lastWeek) / sum.lastWeek) * 100) : null) : null;
  const moduleTotal = sum ? Math.max(1, ...sum.byModule.map((m) => m.count)) : 1;

  return (
    <>
      <PageHeader crumbs={[{ label: user?.company.shortName || '' }, { label: 'Document Tracking' }]} title="Document Tracking"
        sub="Every file attached to every entry — where it is linked, who added it, and what is missing or expiring"
        actions={<>
          <Button icon={Download} onClick={exportCsv}>Export</Button>
          {can('docs', 'create') ? <Button variant="primary" icon={Upload} onClick={() => setUpload({})}>Upload documents</Button> : null}
        </>} />

      {sum ? (
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <Kpi label="Documents stored" value={num(sum.stored)} icon={FolderOpen} tone="info" delta={`+${num(sum.thisMonth)}`} trend="up" note="this month" />
          <Kpi label="Attached this week" value={num(sum.thisWeek)} icon={Paperclip} tone="teal" delta={weekDelta === null ? undefined : `${weekDelta > 0 ? '+' : ''}${weekDelta}%`} trend={weekDelta === null ? 'flat' : weekDelta >= 0 ? 'up' : 'down'} note={sum.lastWeek ? 'vs last week' : 'none last week'} />
          <Kpi label="Missing mandatory" value={num(sum.missing)} icon={FileWarning} tone="danger" note="entries waiting for a file" />
          <Kpi label="Expiring in 30 days" value={num(sum.expiring30)} icon={CalendarClock} tone="warning" delta={sum.expired ? `${sum.expired} expired` : undefined} trend="up" good={false} note="certificates & licences" />
          <Kpi label="Waiting for verification" value={num(sum.pendingVerification)} icon={FileClock} tone="purple" note="check and mark verified" href={undefined} />
        </div>
      ) : <Card><Loading rows={2} /></Card>}

      <div className="grid main-side">
        <div className="stack">
          {entity ? (
            <Alert tone="info" title={`Showing the files of one entry`} action={<Button size="sm" onClick={() => { setEntity(null); window.history.replaceState(null, '', '/documents'); }}>Show all</Button>}>
              {data?.rows[0]?.entityNo || `${entity.type} #${entity.id}`}
            </Alert>
          ) : null}
          <ErrorBox error={error} />
          <DataTable
            loading={isLoading}
            toolbar={<ListToolbar title="All documents" sub="Latest first · click a row to open the document" search={L.search} onSearch={L.setSearch} placeholder="Search file, document no. or entry…"
              chips={{ options: STATUS, value: L.status, onChange: L.setStatus }}
              right={<select className="select" style={{ width: 170, height: 36 }} value={module} onChange={(e) => { setModule(e.target.value); L.setPage(1); }} aria-label="Module">
                <option value="">Module: All</option>
                {(meta?.modules || Object.keys(MODULE_LABEL)).map((m) => <option key={m} value={m}>{MODULE_LABEL[m] || m}</option>)}
              </select>} />}
            rows={data?.rows}
            rowHref={(r) => `/documents/${r.id}`}
            empty="No documents match"
            columns={[
              {
                key: 'file', header: 'Document', render: (r) => {
                  const I = fileIcon(r.fileName, r.mime);
                  return <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}><span className="icon-tile t-info" style={{ width: 30, height: 30, flex: 'none' }}><I size={15} /></span><Two a={<span className="truncate" style={{ display: 'block', maxWidth: 280 }} title={r.fileName}>{r.fileName}</span>} b={`${r.docType} · ${fileSize(r.sizeBytes)} · v${r.version}`} /></div>;
                },
              },
              {
                key: 'entry', header: 'Linked entry', render: (r) => {
                  const h = r.entityId ? hrefFor({ type: r.entityType, id: r.entityId }) : null;
                  const a = r.entityNo ? (h ? <Link href={h} onClick={(e) => e.stopPropagation()} className="strong nowrap">{r.entityNo}</Link> : <span className="strong nowrap">{r.entityNo}</span>) : <span className="secondary">Company</span>;
                  return <div className="stack tight" style={{ gap: 3, alignItems: 'flex-start' }}>{a}<Chip tone={MODULE_TONE[r.module]}>{MODULE_LABEL[r.module] || r.module}</Chip></div>;
                },
              },
              { key: 'by', header: 'Added', render: (r) => <Two a={<span className="nowrap" style={{ fontWeight: 500 }}>{r.addedBy || 'System'}</span>} b={<span className="nowrap">{dateTime(r.createdAt)}</span>} /> },
              {
                key: 'status', header: 'Status', render: (r) => (
                  <div className="stack tight" style={{ gap: 3, alignItems: 'flex-start' }}>
                    <StatusBadge kind="doc" status={docStatus(r)} />
                    {r.expiresOn ? <span className={'text-xs nowrap ' + ((r.daysLeft ?? 99) <= 7 ? 'f-danger' : 'muted')}>{r.daysLeft !== null && r.daysLeft !== undefined && r.daysLeft < 0 ? `Expired ${dateShort(r.expiresOn)}` : `Expires ${dateShort(r.expiresOn)}`}</span> : null}
                  </div>
                ),
              },
            ]}
            footer={data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={L.setPage} noun="documents" /> : null}
          />

          <Card title="Activity log" sub="Every upload, view, download and change">
            {!events ? <Loading rows={3} /> : events.length ? (
              <div className="timeline">
                {events.map((e) => (
                  <Link key={e.id} href={`/documents/${e.attachmentId}`} className="ev" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <span className={`s-${e.action === 'Verified' ? 'success' : e.action === 'Rejected' || e.action === 'Deleted' ? 'danger' : e.action.startsWith('Replaced') ? 'warning' : 'info'}`} style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, flex: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-sm"><span className="strong">{e.action}</span> · {e.fileName}</div>
                      <div className="text-xs muted">{e.userName || 'System'}{e.note ? ' · ' + e.note : e.entityNo ? ' · ' + e.entityNo : ''}</div>
                    </div>
                    <span className="text-xs muted nowrap">{ago(e.createdAt)}</span>
                  </Link>
                ))}
              </div>
            ) : <div className="empty text-sm">No activity yet</div>}
          </Card>
        </div>

        <div className="stack">
          <Card title={<span className="row" style={{ gap: 8 }}>Missing mandatory documents{missing?.length ? <Badge tone="danger" dot={false}>{missing.length}</Badge> : null}</span>} sub="Entries waiting for a required file">
            {!missing ? <Loading rows={3} /> : missing.length ? (
              <div className="list">
                {missing.slice(0, 8).map((m) => (
                  <ListItem key={m.entityType + m.entityId} icon={FileWarning} tone="danger" title={`${m.entityNo} · ${m.missing.join(' + ')} missing`} sub={`${m.sub || m.rule}${m.date ? ' · ' + dateShort(m.date) : ''}`}
                    right={can('docs', 'create') ? <Button size="xs" icon={Paperclip} onClick={() => setUpload({ entityType: m.entityType, entityId: m.entityId, entityNo: m.entityNo, docType: m.missing[0] })}>Attach</Button> : null} />
                ))}
                {missing.length > 8 ? <div className="text-xs muted" style={{ paddingTop: 8 }}>+ {missing.length - 8} more</div> : null}
              </div>
            ) : <Alert tone="success" title="Nothing missing">Every entry has the documents its rule asks for.</Alert>}
          </Card>

          <Card title="Expiring soon" sub="Licences, certificates and calibration">
            {!expiring ? <Loading rows={2} /> : expiring.length ? (
              <div className="list">
                {expiring.map((d) => (
                  <ListItem key={d.id} icon={CalendarClock} tone={(d.daysLeft ?? 99) <= 7 ? 'danger' : 'warning'} title={`${d.docType}${d.entityNo ? ' — ' + d.entityNo : ''}`} sub={d.fileName}
                    right={<span className={'text-xs strong nowrap ' + ((d.daysLeft ?? 99) < 0 ? 'f-danger' : (d.daysLeft ?? 99) <= 7 ? 'f-danger' : 'f-warning')}>{(d.daysLeft ?? 0) < 0 ? `Expired ${-(d.daysLeft ?? 0)} d ago` : `Expires in ${d.daysLeft} d`}</span>} href={`/documents/${d.id}`} />
                ))}
              </div>
            ) : <div className="empty text-sm">Nothing expires in the next 60 days</div>}
          </Card>

          <Card title="Documents by module" sub="Stored files · all time">
            {!sum ? <Loading rows={3} /> : (
              <div className="stack tight" style={{ gap: 10 }}>
                {[...sum.byModule].sort((a, b) => b.count - a.count).map((m) => (
                  <div key={m.module}>
                    <div className="row between text-sm"><span>{MODULE_LABEL[m.module] || m.module}</span><span className="num strong">{num(m.count)}</span></div>
                    <ProgressBar pct={(m.count / moduleTotal) * 100} tone={MODULE_TONE[m.module] || 'info'} />
                  </div>
                ))}
                {!sum.byModule.length ? <div className="empty text-sm">No documents yet</div> : null}
              </div>
            )}
          </Card>

          <Card title="Mandatory document rules" sub="What each entry must have attached"
            right={can('settings', 'edit') ? <Button size="sm" icon={Pencil} onClick={() => setEditRules((rules || []).map((r) => ({ ...r, docTypes: [...r.docTypes] })))}>Edit rules</Button> : null}>
            {!rules ? <Loading rows={3} /> : (
              <div className="list">
                {rules.map((r) => (
                  <ListItem key={r.id} icon={FileCheck2} tone={r.isActive ? 'info' : 'neutral'} title={r.label} sub={`Requires ${r.docTypes.join(' + ')}`} right={r.isActive ? null : <Badge tone="neutral" dot={false}>Off</Badge>} />
                ))}
                {!rules.length ? <div className="empty text-sm">No rules · every entry can complete without files</div> : null}
              </div>
            )}
          </Card>
        </div>
      </div>

      <UploadModal open={!!upload} onClose={() => setUpload(null)} onDone={refreshAll} entityType={upload?.entityType} entityId={upload?.entityId} entityNo={upload?.entityNo} docType={upload?.docType} />

      <Modal open={!!editRules} onClose={() => setEditRules(null)} title="Mandatory document rules" sub="Entries show these as missing until the files are attached" wide
        footer={<><Button onClick={() => setEditRules(null)}>Cancel</Button><Button variant="primary" loading={saving} onClick={saveRules} disabled={!!editRules?.some((r) => r.label.trim() && !r.docTypes.length)}>Save rules</Button></>}>
        <div className="stack">
          {editRules?.map((r, i) => {
            const set = (patch: Partial<Rule>) => setEditRules(editRules.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} className="card" style={{ padding: 14 }}>
                <div className="form c3" style={{ alignItems: 'end' }}>
                  <SelectField label="Entry" value={r.entityType} onChange={(v) => set({ entityType: v })} options={(meta?.ruleTypes || []).map((t) => ({ value: t.key, label: t.label }))} />
                  <TextField label="Rule name" value={r.label} onChange={(v) => set({ label: v })} placeholder="e.g. GRN of steel" />
                  <div className="row" style={{ gap: 10, paddingBottom: 8 }}>
                    <Toggle on={r.isActive} onChange={(v) => set({ isActive: v })} label="Rule active" /><span className="text-sm">{r.isActive ? 'Active' : 'Off'}</span>
                    <span className="spacer" />
                    <button type="button" className="icon-btn" aria-label="Remove rule" onClick={() => setEditRules(editRules.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="text-xs muted" style={{ margin: '10px 0 6px' }}>Requires</div>
                <div className="row" style={{ gap: '6px 16px', flexWrap: 'wrap' }}>
                  {(meta?.docTypes || []).map((d) => (
                    <Checkbox key={d} label={d} checked={r.docTypes.includes(d)} onChange={(v) => set({ docTypes: v ? [...r.docTypes, d] : r.docTypes.filter((x) => x !== d) })} />
                  ))}
                </div>
                {!r.docTypes.length ? <div className="text-xs f-danger" style={{ marginTop: 6 }}>Pick at least one document</div> : null}
              </div>
            );
          })}
          <div><Button size="sm" icon={Plus} onClick={() => setEditRules([...(editRules || []), { entityType: meta?.ruleTypes[0]?.key || 'GRN', label: '', docTypes: [], isActive: true }])}>Add rule</Button></div>
        </div>
      </Modal>
    </>
  );
}

