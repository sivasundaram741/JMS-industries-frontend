// Where each kind of record opens in the app
export type LinkRef = { type: string; id: number } | null | undefined;

export function hrefFor(l: LinkRef): string | null {
  if (!l) return null;
  switch (l.type) {
    case 'SO': return `/sales/orders/${l.id}`;
    case 'PO': return `/purchase/orders/${l.id}`;
    case 'GRN': return `/warehouse/grn/${l.id}`;
    case 'WO': return `/production/work-orders/${l.id}`;
    case 'IL': return `/quality/inspections/${l.id}`;
    case 'NCR': return `/quality?tab=ncr&focus=${l.id}`;
    case 'DC': return `/dispatch/${l.id}`;
    case 'INV': return `/finance/invoices/${l.id}`;
    case 'MACHINE': return '/production/shop-floor';
    case 'PB': return `/purchase/bills/${l.id}`;
    case 'DN': return `/purchase/debit-notes/${l.id}`;
    case 'CN': return `/finance/credit-notes/${l.id}`;
    case 'SR': return `/warehouse/returns/${l.id}`;
    case 'EMP': return `/hr?employee=${l.id}`;
    case 'PAYROLL': return `/hr?tab=payroll&run=${l.id}`;
    case 'DOC': return `/documents/${l.id}`;
    case 'CUSTOMER': return `/sales/customers?focus=${l.id}`;
    case 'VENDOR': return `/purchase/vendors?focus=${l.id}`;
    case 'JW': return `/purchase/orders/${l.id}`;
    case 'APPROVALS': return '/approvals';
    case 'INVOICES_OVERDUE': return '/finance?status=Overdue';
    case 'ITEM': return '/warehouse/stock?low=1';
    case 'ADJ': return '/tracking';
    default: return null;
  }
}
