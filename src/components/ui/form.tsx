'use client';
import { useId } from 'react';

export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string | null; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={'field ' + (className || '')}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <div className="err">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

// Convenience inputs with a label, for simple forms
export function TextField({ label, value, onChange, type = 'text', placeholder, hint, required, className, disabled, min, step }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: React.ReactNode; required?: boolean; className?: string; disabled?: boolean; min?: number; step?: number | string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => <input id={id} className="input" type={type} value={value ?? ''} placeholder={placeholder} required={required} disabled={disabled} min={min} step={step} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

export function SelectField({ label, value, onChange, options, placeholder, hint, className, disabled, required }: { label: string; value: string | number | null | undefined; onChange: (v: string) => void; options: Array<{ value: string | number; label: string }>; placeholder?: string; hint?: React.ReactNode; className?: string; disabled?: boolean; required?: boolean }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <select id={id} className="select" value={value ?? ''} disabled={disabled} required={required} onChange={(e) => onChange(e.target.value)}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

export function TextAreaField({ label, value, onChange, placeholder, className, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string; rows?: number }) {
  return (
    <Field label={label} className={className}>
      {(id) => <textarea id={id} className="textarea" rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

export function Checkbox({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
  );
}
