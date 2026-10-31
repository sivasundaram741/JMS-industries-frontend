'use client';
// Pick the record a document belongs to: a GRN, a work order, an employee… Searches that record type's own list.
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';

type Hit = { id: number; label: string; sub?: string };
const pick = (rows: any): any[] => (Array.isArray(rows) ? rows : rows?.rows || []);

// Where each record type is listed, and how a row reads
export const ENTITY_SOURCES: Record<string, { path: (q: string) => string; map: (r: any) => Hit }> = {
  SO: { path: (q) => `/sales-orders?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.number, sub: r.customerName }) },
  CUSTOMER: { path: (q) => `/customers?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.name, sub: r.code }) },
  PO: { path: (q) => `/purchase-orders?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.number, sub: r.vendorName }) },
  PB: { path: (q) => `/purchase-bills?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.number, sub: `${r.vendorName} · ${r.vendorInvoiceNo}` }) },
  DN: { path: (q) => `/debit-notes?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.number, sub: r.partyName }) },
  VENDOR: { path: (q) => `/vendors?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.name, sub: r.code }) },
  GRN: { path: (q) => `/grns?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.number, sub: r.vendorName }) },
  ITEM: { path: (q) => `/items?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.code, sub: r.name }) },
  WO: { path: (q) => `/work-orders?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.number, sub: r.itemName }) },
  MACHINE: { path: () => `/machines`, map: (r) => ({ id: r.id, label: r.code, sub: r.name }) },
  IL: { path: (q) => `/quality/inspections?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.number, sub: r.itemName }) },
  NCR: { path: (q) => `/quality/ncrs?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.number, sub: r.itemName }) },
  EMP: { path: (q) => `/hr/employees?pageSize=20&search=${q}`, map: (r) => ({ id: r.id, label: r.name, sub: r.code }) },
};

export function EntityPicker({ type, value, onChange }: { type: string; value: Hit | null; onChange: (h: Hit | null) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [err, setErr] = useState('');
  const term = useDebounced(q.trim(), 250);
  const src = ENTITY_SOURCES[type];

  useEffect(() => {
    if (!src) return;
    let live = true;
    setErr('');
    api(src.path(encodeURIComponent(term)))
      .then((r) => { if (live) setHits(pick(r).map(src.map).filter((h) => !term || type !== 'MACHINE' || (h.label + ' ' + h.sub).toLowerCase().includes(term.toLowerCase())).slice(0, 20)); })
      .catch((e) => { if (live) { setHits([]); setErr(e.message); } });
    return () => { live = false; };
  }, [type, term]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!src) return null;
  if (value) {
    return (
      <div className="row" style={{ gap: 8, padding: '8px 12px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
        <span className="strong">{value.label}</span>
        {value.sub ? <span className="text-sm muted truncate">{value.sub}</span> : null}
        <span className="spacer" />
        <button type="button" className="btn xs" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }
  return (
    <div className="stack tight" style={{ gap: 6 }}>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number or name…" aria-label="Search the record" />
      <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--border-default)', borderRadius: 8 }}>
        {err ? <div className="empty text-sm">{err}</div> : hits.length ? hits.map((h) => (
          <button key={h.id} type="button" className="di" onClick={() => onChange(h)}
            style={{ display: 'flex', gap: 8, width: '100%', padding: '8px 12px', border: 0, borderBottom: '1px solid var(--border-subtle)', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <span className="strong">{h.label}</span><span className="text-sm muted truncate">{h.sub}</span>
          </button>
        )) : <div className="empty text-sm">No records match</div>}
      </div>
    </div>
  );
}
