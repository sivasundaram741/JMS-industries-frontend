// Where each kind of record opens in the app
export type LinkRef = { type: string; id: number } | null | undefined;

export function hrefFor(l: LinkRef): string | null {
  if (!l) return null;
  switch (l.type) {
    case 'PO': return `/purchase/orders/${l.id}`;
    case 'JW': return `/purchase/orders/${l.id}`;
    case 'GRN': return `/warehouse/grn/${l.id}`;
    case 'WO': return `/production/work-orders/${l.id}`;
    case 'IL': return `/quality/inspections/${l.id}`;
    case 'NCR': return `/quality?tab=ncr&focus=${l.id}`;
    case 'MACHINE': return '/production/shop-floor';
    case 'VENDOR': return `/purchase/vendors?focus=${l.id}`;
    case 'EMP': return `/masters/employees?employee=${l.id}`;
    case 'ITEM': return '/warehouse/stock?low=1';
    case 'ADJ': return '/warehouse/ledger';
    case 'APPROVALS': return '/approvals';
    default: return null;
  }
}
