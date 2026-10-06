'use client';
// Search work orders, customer orders, purchase orders, bills, employees, documents and customers from the top bar (Ctrl K)
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';

type Hit = { group: string; title: string; sub: string; href: string };

export function GlobalSearch() {
  const { can } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const term = useDebounced(q.trim(), 250);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  useEffect(() => {
    if (term.length < 2) { setHits([]); return; }
    let live = true;
    const s = encodeURIComponent(term);
    const jobs: Array<Promise<Hit[]>> = [];
    if (can('wo')) jobs.push(api(`/work-orders?search=${s}&pageSize=4`).then((r) => r.rows.map((x: any) => ({ group: 'Work orders', title: `${x.number} · ${x.itemName}`, sub: `${x.status} · ${x.qtyCompleted} / ${x.qtyPlanned}`, href: `/production/work-orders/${x.id}` }))));
    if (can('sales')) jobs.push(api(`/sales-orders?search=${s}&pageSize=4`).then((r) => r.rows.map((x: any) => ({ group: 'Customer orders', title: `${x.number} · ${x.customerName}`, sub: `${x.status} · ${x.itemsText}`, href: `/sales/orders/${x.id}` }))));
    if (can('purchase')) jobs.push(api(`/purchase-orders?search=${s}&pageSize=4`).then((r) => r.rows.map((x: any) => ({ group: 'Purchase orders', title: `${x.number} · ${x.vendorName}`, sub: `${x.status} · ${x.itemsText}`, href: `/purchase/orders/${x.id}` }))));
    if (can('pbills')) jobs.push(api(`/purchase-bills?search=${s}&pageSize=3`).then((r) => r.rows.map((x: any) => ({ group: 'Purchase bills', title: `${x.number} · ${x.vendorName}`, sub: `${x.status} · invoice ${x.vendorInvoiceNo}`, href: `/purchase/bills/${x.id}` }))));
    if (can('hr')) jobs.push(api(`/hr/employees?search=${s}&pageSize=3`).then((r) => r.rows.map((x: any) => ({ group: 'Employees', title: `${x.name} · ${x.code}`, sub: `${x.designation || ''} · ${x.department || ''}`, href: `/hr?employee=${x.id}` }))));
    if (can('docs')) jobs.push(api(`/documents?search=${s}&pageSize=3`).then((r) => r.rows.map((x: any) => ({ group: 'Documents', title: x.fileName, sub: `${x.docType}${x.entityNo ? ' · ' + x.entityNo : ''}`, href: `/documents/${x.id}` }))));
    if (can('customers')) jobs.push(api(`/customers?search=${s}&pageSize=3`).then((r) => r.rows.map((x: any) => ({ group: 'Customers', title: x.name, sub: `${x.code} · ${x.city || ''}`, href: `/sales/customers?focus=${x.id}` }))));
    Promise.all(jobs.map((j) => j.catch(() => []))).then((all) => { if (live) { setHits(all.flat()); setSel(0); } });
    return () => { live = false; };
  }, [term, can]);

  const go = (h?: Hit) => { if (!h) return; setOpen(false); setQ(''); router.push(h.href); };
  let lastGroup = '';
  return (
    <div className="search">
      <Search size={18} className="ic" />
      <input ref={input} value={q} placeholder="Search orders, POs, bills, people, documents…" aria-label="Search"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
          if (e.key === 'Enter') go(hits[sel]);
          if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
        }} />
      <kbd>Ctrl K</kbd>
      {open && term.length >= 2 ? (
        <div className="search-results" role="listbox">
          {hits.length ? hits.map((h, i) => {
            const head = h.group !== lastGroup ? <div className="group">{h.group}</div> : null;
            lastGroup = h.group;
            return (
              <div key={h.href + i}>
                {head}
                <Link href={h.href} className={i === sel ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); go(h); }}>
                  <div style={{ minWidth: 0 }}><div className="strong text-sm truncate">{h.title}</div><div className="text-xs muted truncate">{h.sub}</div></div>
                </Link>
              </div>
            );
          }) : <div className="empty text-sm">No matches for “{term}”</div>}
        </div>
      ) : null}
    </div>
  );
}
