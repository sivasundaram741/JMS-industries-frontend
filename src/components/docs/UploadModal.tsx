'use client';
// Attach documents: drop or browse files, pick the document type and (from Document Tracking) the record it belongs
// to. Each file is uploaded on its own so one bad file does not stop the rest. "Replace" uploads a new version.
import { useEffect, useRef, useState } from 'react';
import { CircleCheck, CircleAlert, FileUp, Loader, X } from 'lucide-react';
import { upload } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fileSize } from '@/lib/format';
import { Button, Field, Modal, SelectField, TextField, useToast } from '@/components/ui';
import { EntityPicker } from './EntityPicker';

export interface DocMeta {
  docTypes: string[]; modules: string[]; entityTypes: Array<{ key: string; label: string; module: string }>;
  ruleTypes: Array<{ key: string; label: string }>; maxUploadMb: number; extensions: string[];
}
export const useDocMeta = () => useApi<DocMeta>('/documents/meta', { revalidateIfStale: false });

type Pending = { file: File; state: 'ready' | 'uploading' | 'done' | 'error'; error?: string };

export function UploadModal({ open, onClose, onDone, entityType, entityId, entityNo, docType, replace }: {
  open: boolean; onClose: () => void; onDone?: () => void;
  entityType?: string; entityId?: number | null; entityNo?: string | null; docType?: string;
  replace?: { id: number; docType: string; fileName: string } | null;
}) {
  const toast = useToast();
  const { data: meta } = useDocMeta();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Pending[]>([]);
  const [f, setF] = useState({ docType: '', expiresOn: '', notes: '', entityType: '' });
  const [target, setTarget] = useState<{ id: number; label: string; sub?: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const fixed = !!entityType;

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setTarget(null);
    setF({ docType: replace?.docType || docType || '', expiresOn: '', notes: '', entityType: entityType || 'GENERAL' });
  }, [open, docType, entityType, replace]);

  const maxBytes = (meta?.maxUploadMb || 20) * 1024 * 1024;
  function add(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map<Pending>((file) => {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (meta && !meta.extensions.includes(ext)) return { file, state: 'error', error: `${ext} files are not allowed` };
      if (file.size > maxBytes) return { file, state: 'error', error: `Larger than ${meta?.maxUploadMb || 20} MB` };
      return { file, state: 'ready' };
    });
    setFiles((cur) => (replace ? next.slice(0, 1) : [...cur, ...next]));
  }

  const type = fixed ? entityType! : f.entityType;
  const needsTarget = type !== 'GENERAL' && !fixed;
  const ready = files.filter((x) => x.state === 'ready');
  const canSend = !!ready.length && f.docType.length >= 2 && (!needsTarget || !!target) && !busy;

  async function send() {
    setBusy(true);
    let ok = 0, failed = 0;
    for (const p of files) {
      if (p.state !== 'ready') { if (p.state === 'error') failed++; continue; }
      setFiles((cur) => cur.map((x) => (x.file === p.file ? { ...x, state: 'uploading' } : x)));
      const form = new FormData();
      form.append('file', p.file);
      form.append('entityType', type);
      const eid = fixed ? entityId : target?.id;
      if (eid) form.append('entityId', String(eid));
      form.append('docType', f.docType);
      if (f.expiresOn) form.append('expiresOn', f.expiresOn);
      if (f.notes.trim()) form.append('notes', f.notes.trim());
      if (replace) form.append('replaceId', String(replace.id));
      try {
        await upload('/documents', form);
        ok++;
        setFiles((cur) => cur.map((x) => (x.file === p.file ? { ...x, state: 'done' } : x)));
      } catch (e: any) {
        failed++;
        setFiles((cur) => cur.map((x) => (x.file === p.file ? { ...x, state: 'error', error: e.message } : x)));
      }
    }
    setBusy(false);
    if (ok) {
      toast.ok(replace ? `New version of ${replace.fileName} uploaded` : `${ok} file${ok === 1 ? '' : 's'} attached`);
      onDone?.();
    }
    if (!failed) onClose();
    else setFiles((cur) => cur.filter((x) => x.state !== 'done'));
  }

  const title = replace ? `Replace ${replace.fileName}` : 'Attach documents';
  const sub = replace ? 'Uploads a new version · the old one stays in the history' : fixed ? `To ${entityNo || 'this record'} · tracked in Document Tracking` : 'Link each file to its record · tracked in Document Tracking';

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title} sub={sub} wide
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" icon={FileUp} loading={busy} disabled={!canSend} onClick={send}>{replace ? 'Upload new version' : `Attach ${ready.length || ''} file${ready.length === 1 ? '' : 's'}`}</Button></>}>
      <div className="stack">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          style={{ border: `1.5px dashed ${drag ? 'var(--brand)' : 'var(--border-strong)'}`, background: drag ? 'var(--brand-subtle)' : 'var(--bg-subtle)', borderRadius: 12, padding: '22px 16px', textAlign: 'center', cursor: 'pointer' }}>
          <FileUp size={22} className="muted" />
          <div className="strong" style={{ marginTop: 6 }}>Drop files here or <span style={{ color: 'var(--text-link)' }}>browse</span></div>
          <div className="text-xs muted">PDF, JPG, PNG, Word, Excel, CSV, ZIP, DWG/DXF/STEP · up to {meta?.maxUploadMb || 20} MB each</div>
          <input ref={input} type="file" hidden multiple={!replace} accept={meta?.extensions.join(',')} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </div>
        {files.length ? (
          <div className="list">
            {files.map((p, i) => (
              <div key={i} className="li">
                {p.state === 'uploading' ? <Loader size={16} className="spin" /> : p.state === 'done' ? <CircleCheck size={16} className="f-success" /> : p.state === 'error' ? <CircleAlert size={16} className="f-danger" /> : <FileUp size={16} className="muted" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lt truncate">{p.file.name}</div>
                  <div className={'ls' + (p.state === 'error' ? ' f-danger' : '')}>{p.state === 'error' ? p.error : `${fileSize(p.file.size)} · ${p.state === 'uploading' ? 'uploading…' : p.state === 'done' ? 'uploaded' : 'ready'}`}</div>
                </div>
                {p.state !== 'uploading' ? <button type="button" className="icon-btn" aria-label={`Remove ${p.file.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}><X size={16} /></button> : null}
              </div>
            ))}
          </div>
        ) : null}
        <div className="form c2">
          {!fixed && !replace ? (
            <>
              <SelectField label="Linked to" value={f.entityType} onChange={(v) => { setF({ ...f, entityType: v }); setTarget(null); }}
                options={[{ value: 'GENERAL', label: 'Company (licences, certificates…)' }, ...(meta?.entityTypes || []).map((t) => ({ value: t.key, label: t.label }))]} />
              <Field label={needsTarget ? 'Record' : 'Record (not needed)'}>
                {() => (needsTarget ? <EntityPicker type={f.entityType} value={target} onChange={setTarget} /> : <input className="input" disabled value="Company-wide document" readOnly />)}
              </Field>
            </>
          ) : null}
          <SelectField label="Document type" value={f.docType} onChange={(v) => setF({ ...f, docType: v })} placeholder="Choose…" disabled={!!replace}
            options={(meta?.docTypes || []).map((d) => ({ value: d, label: d }))} />
          <TextField label="Expiry date (optional)" type="date" value={f.expiresOn} onChange={(v) => setF({ ...f, expiresOn: v })} hint="For certificates, licences and calibration" />
          <TextField className="full" label="Note (optional)" value={f.notes} onChange={(v) => setF({ ...f, notes: v })} placeholder="e.g. heat 44871, clear scan" />
        </div>
      </div>
    </Modal>
  );
}
