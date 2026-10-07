'use client';
// One document: preview, details, the record it is linked to, versions and activity. Verify, replace with a new
// version, edit its details or delete it.
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Download, ExternalLink, FileSearch, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import { api, downloadDocument, fetchBlob, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useTenantHref } from '@/lib/hooks';
import { ago, date, dateTime, fileSize } from '@/lib/format';
import { hrefFor } from '@/lib/links';
import { Badge, Button, Card, EmptyState, ErrorBox, KeyValue, ListItem, Loading, Modal, PageHeader, SelectField, StatusBadge, TextField, useToast } from '@/components/ui';
import { DOC_MODULE_LABEL, docStatus, fileIcon, type Doc } from '@/components/docs/Attachments';
import { UploadModal, useDocMeta } from '@/components/docs/UploadModal';

interface DocDetail extends Doc {
  verifiedByName: string | null; verifiedAt: string | null;
  versions: Array<{ id: number; number: string; version: number; fileName: string; sizeBytes: number; status: string; createdAt: string; isLatest: boolean; addedBy: string | null }>;
  events: Array<{ id: number; action: string; note: string | null; userName: string | null; createdAt: string }>;
}

function Preview({ doc }: { doc: DocDetail }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const kind = (doc.mime || '').startsWith('image/') ? 'image' : doc.mime === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : (doc.mime || '').startsWith('text/') ? 'text' : 'other';
  useEffect(() => {
    if (kind === 'other') return;
    let u: string | null = null, live = true;
    setUrl(null); setErr('');
    fetchBlob(`/documents/${doc.id}/file?inline=1`)
      .then((b) => { if (!live) return; u = URL.createObjectURL(kind === 'pdf' ? new Blob([b], { type: 'application/pdf' }) : b); setUrl(u); })
      .catch((e) => live && setErr(e.message));
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [doc.id, kind]);
  if (err) return <EmptyState icon={FileSearch} title="Preview not available">{err}</EmptyState>;
  if (kind === 'other') return <EmptyState icon={FileSearch} title="No preview for this file type">Download it to open in {doc.fileName.split('.').pop()?.toUpperCase()} software.</EmptyState>;
  if (!url) return <Loading rows={6} />;
  if (kind === 'image') return <div style={{ background: 'var(--bg-muted)', borderRadius: 8, padding: 16, textAlign: 'center' }}><img src={url} alt={doc.fileName} style={{ maxWidth: '100%', maxHeight: 700, borderRadius: 4 }} /></div>;
  return <iframe className="doc-frame" src={url} title={doc.fileName} />;
}

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: doc, error, mutate } = useApi<DocDetail>(`/documents/${id}`);
  const { data: meta } = useDocMeta();
  const [replace, setReplace] = useState(false);
  const [edit, setEdit] = useState<null | { docType: string; expiresOn: string; notes: string }>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState('');

  if (error) return <ErrorBox error={error} />;
  if (!doc) return <Loading rows={8} />;

  const status = docStatus(doc);
  const linkHref = doc.entityId ? hrefFor({ type: doc.entityType, id: doc.entityId }) : null;
  const entityLabel = meta?.entityTypes.find((t) => t.key === doc.entityType)?.label || (doc.entityType === 'GENERAL' ? 'Company' : doc.entityType);
  const I = fileIcon(doc.fileName, doc.mime);

  async function verify(s: 'Verified' | 'Rejected' | 'Pending') {
    setBusy(s);
    try { await post(`/documents/${id}/verify`, { status: s }); toast.ok(s === 'Verified' ? 'Marked verified' : s === 'Rejected' ? 'Marked rejected' : 'Back to waiting for verification'); mutate(); }
    catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  async function saveEdit() {
    if (!edit) return;
    setBusy('edit');
    try { await patch(`/documents/${id}`, { docType: edit.docType, expiresOn: edit.expiresOn || null, notes: edit.notes.trim() || null }); toast.ok('Details saved'); setEdit(null); mutate(); }
    catch (e) { toast.err(e); } finally { setBusy(''); }
  }
  async function remove() {
    setBusy('delete');
    try {
      await api(`/documents/${id}`, { method: 'DELETE' });
      toast.ok(`${doc!.fileName} deleted`);
      // Open the version that is current now, if any is left
      const others = doc!.versions.filter((v) => v.id !== doc!.id);
      const next = others.find((v) => v.isLatest) || others[0];
      router.replace(tenantHref(next ? `/documents/${next.id}` : '/documents'));
    } catch (e) { toast.err(e); setBusy(''); }
  }

  return (
    <>
      <PageHeader back="/documents"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Document Tracking', href: '/documents' }, { label: doc.number }]}
        title={doc.fileName}
        tags={<><StatusBadge kind="doc" status={status} label={status === 'Pending' ? 'Pending verification' : status} /><Badge tone="neutral" dot={false}>v{doc.version}</Badge></>}
        sub={`${doc.docType} · linked to ${doc.entityNo || 'the company'}`}
        actions={<>
          <Button icon={Download} onClick={() => downloadDocument(doc.id, doc.fileName).catch(toast.err)}>Download</Button>
          {can('docs', 'create') ? <Button icon={RefreshCw} onClick={() => setReplace(true)}>Replace</Button> : null}
          {can('docs', 'edit') && doc.status !== 'Verified' ? <Button variant="primary" icon={Check} loading={busy === 'Verified'} onClick={() => verify('Verified')}>Mark verified</Button> : null}
        </>} />

      <div className="grid main-side">
        <Card pad={false}>
          <div className="row" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-default)', gap: 10 }}>
            <I size={16} className="muted" /><span className="strong text-sm truncate">{doc.fileName}</span><span className="text-sm muted">{fileSize(doc.sizeBytes)}</span>
          </div>
          <div className="card-body"><Preview doc={doc} /></div>
        </Card>

        <div className="stack">
          <Card title="Details" right={can('docs', 'edit') ? <Button size="sm" icon={Pencil} onClick={() => setEdit({ docType: doc.docType, expiresOn: doc.expiresOn || '', notes: doc.notes || '' })}>Edit</Button> : null}>
            <KeyValue cols={1} items={[
              ['Type', doc.docType],
              ['Document no.', doc.number],
              ['Module', DOC_MODULE_LABEL[doc.module] || doc.module],
              ['Added by', `${doc.addedBy || 'System'} · ${dateTime(doc.createdAt)}`],
              ['Size', `${fileSize(doc.sizeBytes)} · ${(doc.fileName.split('.').pop() || '').toUpperCase()}`],
              ['Expiry', doc.expiresOn ? `${date(doc.expiresOn)}${doc.daysLeft !== null && doc.daysLeft !== undefined ? (doc.daysLeft < 0 ? ` · expired ${-doc.daysLeft} d ago` : ` · ${doc.daysLeft} d left`) : ''}` : 'Does not expire'],
              ['Verification', doc.status === 'Pending' ? 'Waiting' : `${doc.status}${doc.verifiedByName ? ' by ' + doc.verifiedByName : ''}${doc.verifiedAt ? ' · ' + dateTime(doc.verifiedAt) : ''}`],
              ['Note', doc.notes || '—'],
            ]} />
            {can('docs', 'edit') ? (
              <div className="row" style={{ gap: 8, marginTop: 14 }}>
                {doc.status !== 'Rejected' ? <Button size="sm" variant="danger-outline" icon={X} loading={busy === 'Rejected'} onClick={() => verify('Rejected')}>Reject</Button> : null}
                {doc.status !== 'Pending' ? <Button size="sm" loading={busy === 'Pending'} onClick={() => verify('Pending')}>Back to pending</Button> : null}
              </div>
            ) : null}
          </Card>

          <Card title="Linked to">
            <div className="list">
              <ListItem icon={ExternalLink} tone="info" title={doc.entityNo || 'Company document'} sub={entityLabel} href={linkHref} />
            </div>
          </Card>

          <Card title="Versions" sub={`${doc.versions.length} version${doc.versions.length === 1 ? '' : 's'}`}>
            <div className="list">
              {doc.versions.map((v) => (
                <ListItem key={v.id} icon={fileIcon(v.fileName)} tone={v.id === doc.id ? 'info' : 'neutral'} title={`v${v.version}${v.isLatest ? ' · current' : ''}`} sub={`${v.addedBy || 'System'} · ${dateTime(v.createdAt)} · ${fileSize(v.sizeBytes)}`}
                  right={v.id === doc.id ? <Badge tone="info" dot={false}>Viewing</Badge> : <Link href={`/documents/${v.id}`} className="text-sm">View</Link>} />
              ))}
            </div>
          </Card>

          <Card title="Activity">
            <div className="timeline">
              {doc.events.length ? doc.events.map((e) => (
                <div key={e.id} className="ev">
                  <span className={`s-${e.action === 'Verified' ? 'success' : e.action === 'Rejected' ? 'danger' : 'info'}`} style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm strong">{e.action}</div>
                    <div className="text-xs muted">{e.userName || 'System'}{e.note ? ' · ' + e.note : ''}</div>
                  </div>
                  <span className="text-xs muted nowrap">{ago(e.createdAt)}</span>
                </div>
              )) : <div className="text-sm muted">No activity yet</div>}
            </div>
          </Card>

          {can('docs', 'delete') ? <div><Button variant="danger-outline" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete this version</Button></div> : null}
        </div>
      </div>

      <UploadModal open={replace} onClose={() => setReplace(false)} replace={{ id: doc.id, docType: doc.docType, fileName: doc.fileName }} entityType={doc.entityType} entityId={doc.entityId} entityNo={doc.entityNo}
        onDone={async () => {
          // Open the new version
          const fresh = await api<DocDetail>(`/documents/${id}`).catch(() => null);
          const latest = fresh?.versions.find((v) => v.isLatest);
          if (latest && latest.id !== doc.id) router.push(tenantHref(`/documents/${latest.id}`)); else mutate();
        }} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit document details"
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy === 'edit'} onClick={saveEdit}>Save</Button></>}>
        {edit ? (
          <div className="form c2">
            <SelectField label="Document type" value={edit.docType} onChange={(v) => setEdit({ ...edit, docType: v })} options={(meta?.docTypes || [doc.docType]).map((d) => ({ value: d, label: d }))} />
            <TextField label="Expiry date" type="date" value={edit.expiresOn} onChange={(v) => setEdit({ ...edit, expiresOn: v })} hint="Leave empty if it does not expire" />
            <TextField className="full" label="Note" value={edit.notes} onChange={(v) => setEdit({ ...edit, notes: v })} />
          </div>
        ) : null}
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${doc.fileName}?`} sub={doc.versions.length > 1 ? 'The previous version becomes the current one again' : 'The file is removed for good'}
        footer={<><Button onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" icon={Trash2} loading={busy === 'delete'} onClick={remove}>Delete</Button></>}>
        <div className="text-sm secondary">Version {doc.version} of this {doc.docType.toLowerCase()} and its activity are deleted. This cannot be undone.</div>
      </Modal>
    </>
  );
}
