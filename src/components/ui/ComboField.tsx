'use client';
// Search-as-you-type combo box: types to search server-side, optional inline create action.
// Replaces bulk-loaded SelectField for lookups that can have many records (vendors, customers, items).
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';

export interface ComboOption { id: number | string; label: string; sub?: string }

export interface ComboFieldProps {
  label: string;
  value: string;
  onChange: (id: string) => void;
  apiPath: string;
  extraQuery?: string;
  toOption: (row: any) => ComboOption;
  selectedLabel?: string;
  canCreate?: boolean;
  createLabel?: string;
  onCreateClick?: () => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  className?: string;
}

export function ComboField({
  label, value, onChange, apiPath, extraQuery, toOption,
  selectedLabel, canCreate, createLabel, onCreateClick,
  placeholder = 'Type to search…', required, disabled, hint, className,
}: ComboFieldProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ComboOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selLabel, setSelLabel] = useState(selectedLabel || '');
  const ref = useRef<HTMLDivElement>(null);
  const dq = useDebounced(query, 220);

  useEffect(() => { if (selectedLabel) setSelLabel(selectedLabel); }, [selectedLabel]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const parts = ['pageSize=12'];
    if (dq) parts.push(`search=${encodeURIComponent(dq)}`);
    if (extraQuery) parts.push(extraQuery);
    api(`${apiPath}?${parts.join('&')}`).then(r => {
      setOpts((r.rows || r || []).map(toOption));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dq, open, apiPath, extraQuery]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (opt: ComboOption) => {
    setSelLabel(opt.label);
    onChange(String(opt.id));
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={`field${className ? ' ' + className : ''}`} ref={ref} style={{ position: 'relative' }}>
      <label>{label}{required ? <span style={{ color: 'var(--danger-fg)' }}> *</span> : ''}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          value={open ? query : selLabel}
          placeholder={selLabel ? undefined : placeholder}
          disabled={disabled}
          autoComplete="off"
          style={{ paddingRight: 32 }}
          onChange={e => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
            if (!e.target.value && selLabel) { setSelLabel(''); onChange(''); }
          }}
          onFocus={() => { setOpen(true); setQuery(''); }}
        />
        <span style={{ position: 'absolute', right: 10, top: 10, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
          <ChevronDown size={16} />
        </span>
      </div>
      {open && (
        <div className="combo-drop">
          {loading
            ? <div className="combo-opt muted text-sm">Searching…</div>
            : opts.length
              ? opts.map(o => (
                <button key={o.id} type="button" className="combo-opt" onMouseDown={e => { e.preventDefault(); pick(o); }}>
                  <span className="truncate">{o.label}</span>
                  {o.sub ? <span className="text-xs muted">{o.sub}</span> : null}
                </button>
              ))
              : dq
                ? <div className="combo-opt muted text-sm">No results for "{dq}"</div>
                : null}
          {canCreate && (
            <button type="button" className="combo-opt combo-new" onMouseDown={e => { e.preventDefault(); setOpen(false); onCreateClick?.(); }}>
              <Plus size={13} /> {createLabel || 'Add new'}
            </button>
          )}
        </div>
      )}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}
