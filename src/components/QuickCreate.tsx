'use client';
// Lightweight modals for creating master records inline from entry forms.
// Open with open=true, get the new record back via onCreated, then auto-select it.
import { useState } from 'react';
import { post } from '@/lib/api';
import { Button, Modal, SelectField, TextField, useToast } from '@/components/ui';
import type { ComboOption } from '@/components/ui/ComboField';

// ── Quick-add Vendor ──────────────────────────────────────────────────────────

export interface QuickVendorProps {
  open: boolean;
  forSubcon?: boolean;
  onClose: () => void;
  onCreated: (opt: ComboOption) => void;
}

export function QuickVendor({ open, forSubcon, onClose, onCreated }: QuickVendorProps) {
  const toast = useToast();
  const blank = () => ({ name: '', city: '', phone: '', isSubcontractor: forSubcon ? '1' : '0' });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ReturnType<typeof blank>) => (v: string) => setF(x => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const r = await post('/vendors', {
        name: f.name.trim(), city: f.city.trim() || undefined,
        phone: f.phone.trim() || undefined, isSubcontractor: f.isSubcontractor === '1',
      });
      toast.ok(`${r.name} added`);
      onCreated({ id: r.id, label: r.name, sub: r.city || r.code });
      setF(blank());
      onClose();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add vendor"
      sub="Basic record — add GSTIN, payment terms and more in Masters later"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={f.name.trim().length < 2} onClick={save}>
            Add vendor
          </Button>
        </>
      }>
      <div className="form c2">
        <TextField className="full" label="Vendor name" value={f.name} onChange={set('name')}
          placeholder="e.g. Apex Steel Works" required />
        <TextField label="City" value={f.city} onChange={set('city')} placeholder="e.g. Pune" />
        <TextField label="Phone" value={f.phone} onChange={set('phone')} placeholder="e.g. 9800001234" />
        <SelectField label="Type" value={f.isSubcontractor} onChange={set('isSubcontractor')}
          options={[{ value: '0', label: 'Supplier / vendor' }, { value: '1', label: 'Subcontractor' }]} />
      </div>
    </Modal>
  );
}

// ── Quick-add Customer ────────────────────────────────────────────────────────

export interface QuickCustomerProps {
  open: boolean;
  onClose: () => void;
  onCreated: (opt: ComboOption) => void;
}

export function QuickCustomer({ open, onClose, onCreated }: QuickCustomerProps) {
  const toast = useToast();
  const blank = () => ({ name: '', city: '', phone: '', creditLimit: '0' });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ReturnType<typeof blank>) => (v: string) => setF(x => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const r = await post('/customers', {
        name: f.name.trim(), city: f.city.trim() || undefined,
        phone: f.phone.trim() || undefined, creditLimit: Number(f.creditLimit) || 0,
      });
      toast.ok(`${r.name} added`);
      onCreated({ id: r.id, label: r.name, sub: r.city || '' });
      setF(blank());
      onClose();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add customer"
      sub="Basic record — add GSTIN, credit terms and address in Masters later"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={f.name.trim().length < 2} onClick={save}>
            Add customer
          </Button>
        </>
      }>
      <div className="form c2">
        <TextField className="full" label="Customer name" value={f.name} onChange={set('name')}
          placeholder="e.g. Bharat Forge Ltd" required />
        <TextField label="City" value={f.city} onChange={set('city')} placeholder="e.g. Pune" />
        <TextField label="Phone" value={f.phone} onChange={set('phone')} placeholder="e.g. 9800001234" />
        <TextField label="Credit limit (₹)" type="number" value={f.creditLimit} onChange={set('creditLimit')}
          placeholder="0 = no limit" />
      </div>
    </Modal>
  );
}

// ── Quick-add Item ────────────────────────────────────────────────────────────

export interface QuickItemResult extends ComboOption {
  uom: string; stdCost: number; salePrice: number; taxPct: number;
}

export interface QuickItemProps {
  open: boolean;
  defaultType?: string;
  onClose: () => void;
  onCreated: (item: QuickItemResult) => void;
}

export function QuickItem({ open, defaultType, onClose, onCreated }: QuickItemProps) {
  const toast = useToast();
  const blank = () => ({ code: '', name: '', type: defaultType || 'RM', uom: 'Nos', stdCost: '', salePrice: '', taxPct: '18' });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ReturnType<typeof blank>) => (v: string) => setF(x => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const r = await post('/items', {
        code: f.code.trim() || undefined, name: f.name.trim(), type: f.type,
        uom: f.uom || 'Nos', stdCost: Number(f.stdCost) || 0,
        salePrice: Number(f.salePrice) || 0, taxPct: Number(f.taxPct) || 18,
      });
      toast.ok(`${r.name} added`);
      onCreated({ id: r.id, label: `${r.code} · ${r.name}`, sub: `${r.uom} · ${r.type}`, uom: r.uom, stdCost: r.stdCost, salePrice: r.salePrice, taxPct: r.taxPct });
      setF(blank());
      onClose();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add item"
      sub="Basic record — add BOM, routing and more in Masters later"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={f.name.trim().length < 2} onClick={save}>
            Add item
          </Button>
        </>
      }>
      <div className="form c2">
        <TextField label="Item code" value={f.code} onChange={set('code')}
          placeholder="Leave blank to auto-generate" />
        <TextField label="Item name" value={f.name} onChange={set('name')}
          placeholder="e.g. M6 Hex Bolt SS" required />
        <SelectField label="Type" value={f.type} onChange={set('type')} options={[
          { value: 'FG', label: 'Finished goods' },
          { value: 'RM', label: 'Raw material' },
          { value: 'BOUGHT', label: 'Bought-out part' },
          { value: 'CONSUMABLE', label: 'Consumable' },
          { value: 'SERVICE', label: 'Service / job work' },
        ]} />
        <TextField label="Unit of measure" value={f.uom} onChange={set('uom')}
          placeholder="Nos, Kg, Mtr…" />
        <TextField label="Std cost (₹)" type="number" value={f.stdCost} onChange={set('stdCost')}
          placeholder="0" />
        <TextField label="Sale price (₹)" type="number" value={f.salePrice} onChange={set('salePrice')}
          placeholder="0" />
        <TextField label="GST %" type="number" value={f.taxPct} onChange={set('taxPct')}
          placeholder="18" />
      </div>
    </Modal>
  );
}
