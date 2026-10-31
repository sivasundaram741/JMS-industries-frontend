// Colour (tone) for every document status, so the same status looks the same on every page
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' | 'teal' | 'pink';

const MAP: Record<string, Record<string, Tone>> = {
  so: { Received: 'info', 'Credit hold': 'danger', 'Credit OK': 'teal', Quoted: 'purple', Confirmed: 'info', Released: 'warning', Dispatched: 'teal', Invoiced: 'purple', Closed: 'success', Cancelled: 'neutral' },
  po: { Draft: 'neutral', 'Pending approval': 'warning', Approved: 'info', Sent: 'purple', Acknowledged: 'teal', 'Partially received': 'warning', Received: 'success', Billed: 'success', Cancelled: 'neutral' },
  // Work order status colours (same on every Industrial screen)
  wo: { Planned: 'neutral', Released: 'info', 'In Progress': 'warning', 'On Hold': 'purple', 'In Assembly': 'info', Completed: 'success', Closed: 'teal' },
  grn: { 'Pending QC': 'warning', Accepted: 'success', 'Partially accepted': 'warning', Rejected: 'danger' },
  lot: { Pending: 'warning', 'In progress': 'info', Accepted: 'success', 'Accepted w/ deviation': 'teal', 'Partially accepted': 'warning', Rejected: 'danger' },
  ncr: { Open: 'danger', Closed: 'success', Pending: 'warning', Rework: 'info', Scrap: 'danger', 'Use as is': 'teal', 'Return to vendor': 'purple' },
  ship: { Pick: 'neutral', Pack: 'info', Challan: 'purple', Loaded: 'teal', 'In transit': 'warning', Delivered: 'success', Acknowledged: 'success' },
  inv: { Sent: 'info', Due: 'info', 'Part paid': 'warning', Paid: 'success', Overdue: 'danger', Cancelled: 'neutral' },
  sla: { 'On time': 'success', 'At risk': 'warning', Late: 'danger', Done: 'neutral', 'On hold': 'purple' },
  machine: { Running: 'success', Setup: 'warning', Down: 'danger', Idle: 'neutral' },
  approval: { Pending: 'warning', Approved: 'success', Rejected: 'danger' },
  // Purchase bills: 3-way match result and bill status
  pb: { Draft: 'neutral', 'On hold': 'warning', Approved: 'info', 'Part paid': 'purple', Paid: 'success', Overdue: 'danger', Cancelled: 'neutral', Rejected: 'danger' },
  match: { '3-way OK': 'success', 'Rate variance': 'warning', 'Qty variance': 'warning', 'No GRN': 'danger', 'No PO': 'purple', Pending: 'neutral' },
  // Debit and credit invoices
  note: { Draft: 'neutral', 'Pending approval': 'warning', Approved: 'info', Adjusted: 'success', Refunded: 'success', Replaced: 'success', Settled: 'success', Rejected: 'danger', Cancelled: 'neutral' },
  cond: { Resaleable: 'success', Damaged: 'danger', Expired: 'warning', Rejected: 'danger' },
  sr: { Draft: 'neutral', 'In transit': 'warning', Received: 'success', Cancelled: 'neutral' },
  doc: { Pending: 'warning', Verified: 'success', Rejected: 'danger', Expiring: 'warning', Expired: 'danger' },
  emp: { Active: 'success', 'On leave': 'warning', Exited: 'neutral' },
  att: { Present: 'success', Late: 'warning', 'On field': 'info', Leave: 'purple', Absent: 'danger', Holiday: 'teal', 'Week off': 'neutral' },
  payroll: { Draft: 'neutral', Calculated: 'info', 'Pending approval': 'warning', Approved: 'teal', Paid: 'success', Rejected: 'danger' },
};

export type StatusKind = keyof typeof MAP;
export const toneOf = (kind: StatusKind, status?: string | null): Tone => (status && MAP[kind][status]) || 'neutral';
export const WO_STATUSES = Object.keys(MAP.wo);

// A purchase bill past its due date shows as Overdue
export const billStatus = (b: { status: string; overdueDays?: number }) => (['Approved', 'Part paid'].includes(b.status) && (b.overdueDays || 0) > 0 ? 'Overdue' : b.status);
