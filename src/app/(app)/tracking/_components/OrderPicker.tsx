'use client';
// Searchable dropdown of customer orders for Order Tracking (GET /tracking/orders?search=)
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { qs } from '@/lib/api';
import { useApi, useDebounced } from '@/lib/hooks';
import { dateShort } from '@/lib/format';
import { StatusBadge } from '@/components/ui';

export interface PickerOrder { id: number; number: string; status: string; promisedDate: string | null; customerName: string }

export function OrderPicker({ current, onPick }: { current?: { number: string; customerName: string } | null; onPick: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const box = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useApi<PickerOrder[]>(open ? '/tracking/orders' + qs({ search: dq || undefined }) : null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" className="pill" style={{ cursor: 'pointer', maxWidth: 320 }} aria-haspopup="listbox" aria-expanded={open} onClick={() => { setQ(''); setOpen((o) => !o); }}>
        <Search size={16} className="muted" />
        <span className="truncate">{current ? `${current.number} · ${current.customerName}` : 'Choose an order…'}</span>
        <ChevronDown size={16} className="muted" />
      </button>
      {open ? (
        <div className="dropdown" style={{ width: 360 }} role="listbox">
          <div style={{ padding: 4 }}>
            <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order, customer, PO…" aria-label="Search orders" style={{ height: 36 }} />
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {data?.length ? data.map((o) => (
              <button key={o.id} type="button" className="di" role="option" aria-selected={current?.number === o.number} onClick={() => { setOpen(false); onPick(o.id); }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="strong" style={{ display: 'block' }}>{o.number}</span>
                  <span className="text-xs muted truncate" style={{ display: 'block' }}>{o.customerName} · promised {dateShort(o.promisedDate)}</span>
                </span>
                <StatusBadge kind="so" status={o.status} />
              </button>
            )) : <div className="text-sm muted" style={{ padding: '10px' }}>{isLoading || !data ? 'Loading…' : 'No orders match'}</div>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
