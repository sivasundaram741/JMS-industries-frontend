// Debit invoices (to vendors, Purchase) and credit invoices (from customers, Finance) share one engine; this is
// what differs between the two.
export type NoteKind = 'debit' | 'credit';

export interface NoteConfig {
  kind: NoteKind; api: string; module: string; entity: 'DN' | 'CN'; href: string; label: string; plural: string; section: string; noteTitle: string;
  party: string; partyApi: string; partyField: 'vendorId' | 'customerId'; sourceField: 'purchaseBillId' | 'invoiceId';
  source: string; sourceApi: (partyId: string) => string; sourceHref: (id: number) => string; base: string;
  whLabel: string; defaultWh: 'RM' | 'FG' | 'QC'; settle: Record<'Adjust' | 'Refund' | 'Replacement', { title: string; sub: (party: string) => string }>;
}

export const NOTES: Record<NoteKind, NoteConfig> = {
  debit: {
    kind: 'debit', api: '/debit-notes', module: 'debitinv', entity: 'DN', href: '/purchase/debit-notes', label: 'Debit invoice', plural: 'Debit Invoices', section: 'Purchase', noteTitle: 'DEBIT NOTE',
    party: 'Vendor', partyApi: '/vendors?pageSize=200', partyField: 'vendorId', sourceField: 'purchaseBillId',
    source: 'Purchase bill', sourceApi: (p) => `/purchase-bills?vendorId=${p}&status=Approved,Part paid,Paid&pageSize=100`, sourceHref: (id) => `/purchase/bills/${id}`, base: 'purchases',
    whLabel: 'Return from location', defaultWh: 'RM',
    settle: {
      Adjust: { title: 'Adjust against payable', sub: (p) => `Reduces the next payment to ${p}` },
      Refund: { title: 'Ask for refund', sub: () => 'Vendor pays back by bank transfer' },
      Replacement: { title: 'Ask for replacement', sub: () => 'Vendor ships replacement goods' },
    },
  },
  credit: {
    kind: 'credit', api: '/credit-notes', module: 'creditinv', entity: 'CN', href: '/finance/credit-notes', label: 'Credit invoice', plural: 'Credit Invoices', section: 'Finance', noteTitle: 'CREDIT NOTE',
    party: 'Customer', partyApi: '/customers?pageSize=200', partyField: 'customerId', sourceField: 'invoiceId',
    source: 'Sales invoice', sourceApi: (p) => `/finance/invoices?customerId=${p}&pageSize=100`, sourceHref: (id) => `/finance/invoices/${id}`, base: 'sales',
    whLabel: 'Return to location', defaultWh: 'FG',
    settle: {
      Adjust: { title: 'Adjust against outstanding', sub: (p) => `Reduces ${p}’s receivable` },
      Refund: { title: 'Refund', sub: () => 'UPI / bank transfer to the customer' },
      Replacement: { title: 'Replace products', sub: () => 'Ship replacement goods at no charge' },
    },
  },
};

export const CONDITIONS = ['Resaleable', 'Damaged', 'Expired', 'Rejected'] as const;
export const WAREHOUSES = [{ value: 'RM', label: 'RM Store · Main Hub' }, { value: 'FG', label: 'FG Store · Main Hub' }, { value: 'QC', label: 'QC Hold' }];
