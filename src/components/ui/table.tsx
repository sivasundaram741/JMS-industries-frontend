'use client';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, Loading } from './layout';

export interface Column<T> { key: string; header: React.ReactNode; align?: 'left' | 'right' | 'center'; width?: number | string; render?: (row: T, i: number) => React.ReactNode }

export function DataTable<T extends Record<string, any>>({ columns, rows, rowHref, onRowClick, loading, empty, footer, toolbar, rowKey = 'id' }: {
  columns: Column<T>[]; rows?: T[] | null; rowHref?: (row: T) => string | null | undefined; onRowClick?: (row: T) => void; loading?: boolean; empty?: React.ReactNode; footer?: React.ReactNode; toolbar?: React.ReactNode; rowKey?: string;
}) {
  const router = useRouter();
  const click = (r: T) => {
    if (onRowClick) return onRowClick(r);
    const h = rowHref?.(r);
    if (h) router.push(h);
  };
  const clickable = !!(onRowClick || rowHref);
  return (
    <div className="card">
      {toolbar}
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'r' : undefined} style={{ width: c.width, textAlign: c.align }}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows?.map((r, i) => (
              <tr key={r[rowKey] ?? i} className={clickable && (onRowClick || rowHref?.(r)) ? 'click' : undefined} onClick={clickable ? () => click(r) : undefined}>
                {columns.map((c) => <td key={c.key} className={c.align === 'right' ? 'r num' : undefined} style={{ textAlign: c.align }}>{c.render ? c.render(r, i) : (r[c.key] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {loading && !rows?.length ? <div className="card-body"><Loading rows={4} /></div> : null}
        {!loading && rows && rows.length === 0 ? (typeof empty === 'string' || !empty ? <EmptyState title={(empty as string) || 'No records match'} /> : empty) : null}
      </div>
      {footer}
    </div>
  );
}

// Two-line cell: bold reference over a muted detail
export function Two({ a, b }: { a: React.ReactNode; b?: React.ReactNode }) {
  return <div className="two"><div className="a">{a}</div>{b ? <div className="b">{b}</div> : null}</div>;
}

export function ListToolbar({ title, sub, search, onSearch, placeholder = 'Search…', chips, right }: {
  title?: React.ReactNode; sub?: React.ReactNode; search?: string; onSearch?: (v: string) => void; placeholder?: string;
  chips?: { options: Array<{ key: string; label: string }>; value: string; onChange: (v: string) => void }; right?: React.ReactNode;
}) {
  return (
    <div className="toolbar">
      {title ? <div><div className="tt">{title}</div>{sub ? <div className="ts">{sub}</div> : null}</div> : null}
      {onSearch ? (
        <label className="tsearch">
          <Search size={16} />
          <input value={search || ''} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        </label>
      ) : null}
      {chips ? (
        <div className="chips">
          {chips.options.map((o) => <button key={o.key} type="button" className={o.key === chips.value ? 'on' : ''} onClick={() => chips.onChange(o.key)}>{o.label}</button>)}
        </div>
      ) : null}
      <div className="spacer" />
      {right}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage, noun = 'records' }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(total, page * pageSize);
  return (
    <div className="tfoot">
      <span>{from}–{to} of {total.toLocaleString('en-IN')} {noun}</span>
      <div className="row" style={{ gap: 8 }}>
        <span>Page {page} of {pages}</span>
        <button className="btn xs" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
        <button className="btn xs" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}
