'use client';
// People & Masters · Masters · Items: raw material, bought-out, consumables, services and finished goods (with their
// operations and materials).
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { qs, type Page } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useListState } from '@/lib/hooks';
import { inr, num } from '@/lib/format';
import { Button, Chip, DataTable, ErrorBox, ListToolbar, PageHeader, Pagination, Two } from '@/components/ui';
import { ItemModal } from '../_components/ItemModal';
import { TemplateModal } from '../_components/TemplateModal';

const TYPES = [
  { key: '', label: 'All' }, { key: 'FG', label: 'Finished goods' }, { key: 'RM', label: 'Raw material' },
  { key: 'BOUGHT', label: 'Bought-out' }, { key: 'CONSUMABLE', label: 'Consumables' }, { key: 'SERVICE', label: 'Services' },
];
const TYPE_LABEL: Record<string, string> = { FG: 'Finished good', RM: 'Raw material', BOUGHT: 'Bought-out', CONSUMABLE: 'Consumable', SERVICE: 'Service' };
const TYPE_TONE: Record<string, 'info' | 'warning' | 'teal' | 'neutral' | 'purple'> = { FG: 'info', RM: 'warning', BOUGHT: 'teal', CONSUMABLE: 'neutral', SERVICE: 'purple' };

export default function ItemsPage() {
  const { user, can } = useAuth();
  const L = useListState();
  const { data: items, error, isLoading, mutate } = useApi<Page<any>>('/items' + qs({ ...L.params, status: undefined, type: L.status }));
  const [edit, setEdit] = useState<{ item?: any } | null>(null);
  const [fg, setFg] = useState<number | null>(null);

  function openItem(r: any) {
    if (r.type === 'FG') setFg(r.id);
    else if (can('masters', 'edit')) setEdit({ item: r });
  }

  return (
    <>
      <PageHeader
        back="/masters"
        crumbs={[{ label: user?.company.shortName || '' }, { label: 'Masters', href: '/masters' }, { label: 'Items' }]}
        title="Items"
        sub="Every item you buy, make or sell · finished goods open their operations and materials"
        actions={can('masters', 'create') ? <Button variant="primary" icon={Plus} onClick={() => setEdit({})}>New item</Button> : null}
      />
      <ErrorBox error={error} />
      <DataTable
        loading={isLoading}
        toolbar={<ListToolbar search={L.search} onSearch={L.setSearch} placeholder="Search item code or name…" chips={{ options: TYPES, value: L.status, onChange: L.setStatus }} />}
        rows={items?.rows}
        onRowClick={(r) => openItem(r)}
        empty="No items match"
        columns={[
          { key: 'code', header: 'Code', render: (r) => <span className="strong nowrap">{r.code}</span> },
          { key: 'name', header: 'Name', render: (r) => <Two a={r.name} b={r.type === 'FG' ? 'Operations & materials · click to open' : r.isActive === false ? 'Inactive' : undefined} /> },
          { key: 'type', header: 'Type', render: (r) => <Chip tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type] || r.type}</Chip> },
          { key: 'uom', header: 'UoM', render: (r) => r.uom },
          { key: 'hsn', header: 'HSN', render: (r) => <span className="num secondary nowrap">{r.hsn || '—'}</span> },
          { key: 'cost', header: 'Std cost', align: 'right', render: (r) => inr(r.stdCost, 2) },
          { key: 'price', header: 'Sale price', align: 'right', render: (r) => (r.salePrice ? inr(r.salePrice, 2) : <span className="muted">—</span>) },
          { key: 'reorder', header: 'Reorder level', align: 'right', render: (r) => (r.reorderLevel ? num(r.reorderLevel) : <span className="muted">—</span>) },
        ]}
        footer={items ? <Pagination page={items.page} pageSize={items.pageSize} total={items.total} onPage={L.setPage} noun="items" /> : null}
      />
      <ItemModal open={!!edit} item={edit?.item} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); mutate(); }} />
      <TemplateModal open={fg !== null && !edit} itemId={fg} onClose={() => setFg(null)} onEdit={(it) => setEdit({ item: it })} />
    </>
  );
}
