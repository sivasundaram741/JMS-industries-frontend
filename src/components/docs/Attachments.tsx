'use client';
// Attachments card for any detail page: files linked to the record, what its document rule still needs, and Attach.
// Everything here is also listed in Overview · Document Tracking.
import { TenantLink as Link } from '@/components/ui/TenantLink';
import { useState } from 'react';
import { Download, File, FileArchive, FileImage, FileSpreadsheet, FileText, Paperclip, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { downloadDocument } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { dateShort, fileSize } from '@/lib/format';
import { Button, Card, Loading, StatusBadge, useToast } from '@/components/ui';
import { UploadModal } from './UploadModal';

export const DOC_MODULE_LABEL: Record<string, string> = { sales: 'Sales', purchase: 'Purchase', store: 'Warehouse', prod: 'Production', quality: 'Quality', dispatch: 'Dispatch', finance: 'Finance', hr: 'HR', general: 'Company' };

export interface Doc {
  id: number; number: string; entityType: string; entityId: number | null; entityNo: string | null; module: string; docType: string;
  fileName: string; mime: string | null; sizeBytes: number; version: number; status: string; expiresOn: string | null; notes: string | null;
  createdAt: string; addedBy?: string | null; daysLeft?: number | null; expiring?: boolean;
}

export function fileIcon(name: string, mime?: string | null): LucideIcon {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if ((mime || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return FileImage;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['zip'].includes(ext)) return FileArchive;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return FileText;
  return File;
}

// Status shown for a document: expired / expiring beat the verification status
export function docStatus(d: Pick<Doc, 'status' | 'daysLeft' | 'expiring'>) {
  if (d.daysLeft !== null && d.daysLeft !== undefined && d.daysLeft < 0) return 'Expired';
  if (d.expiring && d.status !== 'Rejected') return 'Expiring';
  return d.status;
}

export function Attachments({ entityType, entityId, entityNo, title = 'Attachments' }: { entityType: string; entityId: number; entityNo?: string | null; title?: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const allowed = can('docs');
  const { data, mutate } = useApi<{ rows: Doc[]; missing: string[] }>(allowed && entityId ? `/documents/for/${entityType}/${entityId}` : null);
  const [open, setOpen] = useState<{ docType?: string } | null>(null);
  if (!allowed) return null;
  const canAdd = can('docs', 'create');

  return (
    <Card title={<span className="row" style={{ gap: 8 }}>{title}{data?.rows.length ? <span className="chip">{data.rows.length}</span> : null}</span>} sub="Tracked in Document Tracking"
      right={canAdd ? <Button size="sm" icon={Paperclip} onClick={() => setOpen({})}>Attach</Button> : null}>
      {!data ? <Loading rows={2} /> : (
        <div className="stack tight" style={{ gap: 10 }}>
          {data.missing.length ? (
            <div className="alert t-warning" style={{ padding: '10px 12px' }}>
              <TriangleAlert size={16} style={{ flex: 'none', marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="at">Required document{data.missing.length === 1 ? '' : 's'} missing</div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {data.missing.map((m) => canAdd
                    ? <button key={m} type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => setOpen({ docType: m })}>+ {m}</button>
                    : <span key={m} className="chip">{m}</span>)}
                </div>
              </div>
            </div>
          ) : null}
          {data.rows.length ? (
            <div className="list">
              {data.rows.map((d) => {
                const I = fileIcon(d.fileName, d.mime);
                return (
                  <div key={d.id} className="li">
                    <span className="icon-tile t-info" style={{ width: 32, height: 32 }}><I size={16} /></span>
                    <Link href={`/documents/${d.id}`} style={{ flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none' }}>
                      <div className="lt truncate">{d.fileName}</div>
                      <div className="ls truncate">{d.docType} · {fileSize(d.sizeBytes)} · v{d.version} · {dateShort(d.createdAt)}</div>
                    </Link>
                    <StatusBadge kind="doc" status={docStatus(d)} />
                    <button type="button" className="icon-btn" aria-label={`Download ${d.fileName}`} onClick={() => downloadDocument(d.id, d.fileName).catch(toast.err)}><Download size={16} /></button>
                  </div>
                );
              })}
            </div>
          ) : !data.missing.length ? <div className="empty text-sm">No files attached yet</div> : null}
          {data.rows.length ? <Link href={`/documents?entityType=${entityType}&entityId=${entityId}`} className="text-sm" style={{ color: 'var(--text-link)' }}>View all in Document Tracking</Link> : null}
        </div>
      )}
      <UploadModal open={!!open} onClose={() => setOpen(null)} onDone={() => mutate()} entityType={entityType} entityId={entityId} entityNo={entityNo} docType={open?.docType} />
    </Card>
  );
}
