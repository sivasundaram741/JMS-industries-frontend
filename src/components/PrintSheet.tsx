'use client';
// A4 document preview that prints as the document itself (purchase bills, debit and credit invoices, challans).
import { FileText } from 'lucide-react';

export const SHEET_CSS = `@media print {
  @page { size: A4; margin: 12mm; }
  .sidebar, .topbar, .ribbon, .no-print, .toasts, .overlay { display: none !important; }
  body, .content, .main { background: #fff !important; }
  .content { padding: 0 !important; max-width: none !important; display: block !important; }
  .sheet-layout { display: block !important; }
  .sheet-wrap { border: 0 !important; box-shadow: none !important; background: #fff !important; }
  .sheet-wrap > .sheet-bar { display: none !important; }
  .sheet-wrap > .sheet-bg { padding: 0 !important; background: #fff !important; }
  .sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; padding: 0 !important; }
}
.sheet { color: #101828; background: #fff; max-width: 794px; margin: 0 auto; padding: 36px 36px 28px; border-radius: 4px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 18px; font-size: 12px; }
.sheet .muted { color: #667085; }
.sheet table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sheet th { text-align: left; font-size: 11px; font-weight: 600; color: #667085; padding: 8px 10px; background: #f7f8fa; border-bottom: 1px solid #e4e7ec; }
.sheet td { padding: 9px 10px; border-bottom: 1px solid #eef1f6; vertical-align: top; }
.sheet .r { text-align: right; }
.sheet .box { border: 1px solid #e4e7ec; border-radius: 8px; padding: 12px 14px; }
.sheet .lbl { font-size: 10px; letter-spacing: .6px; text-transform: uppercase; font-weight: 600; color: #667085; }
.sheet .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 16px; background: #f7f8fa; border-radius: 8px; padding: 12px 14px; }
.sheet .meta .v { font-size: 12px; font-weight: 600; margin-top: 1px; word-break: break-all; }
.sheet .tot { display: grid; grid-template-columns: 1fr auto; gap: 6px 24px; font-size: 12px; min-width: 260px; }
.sheet .grand { font-weight: 700; font-size: 14px; border-top: 1px solid #e4e7ec; padding-top: 6px; }`;

export function SheetFrame({ fileName, children }: { fileName: string; children: React.ReactNode }) {
  return (
    <section className="card sheet-wrap" style={{ overflow: 'hidden' }}>
      <style>{SHEET_CSS}</style>
      <div className="sheet-bar row" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-default)' }}>
        <FileText size={16} className="muted" />
        <span className="strong text-sm">{fileName}</span>
        <span className="text-sm muted">A4 · page 1 of 1</span>
      </div>
      <div className="sheet-bg" style={{ background: 'var(--bg-muted)', padding: 24 }}>
        <div className="sheet">{children}</div>
      </div>
    </section>
  );
}

// Letterhead: company on the left, document title and number on the right
export function SheetHead({ company, title, subtitle, number, date }: { company: { name: string; city?: string | null; gstin?: string | null }; title: string; subtitle?: string; number: string; date: string }) {
  const initials = company.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#155eef', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, flex: 'none' }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{company.name}</div>
        <div className="muted">{company.city || ''}{company.city ? ', ' : ''}Tamil Nadu</div>
        {company.gstin ? <div className="muted">GSTIN {company.gstin}</div> : null}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>{title}</div>
        {subtitle ? <div className="muted">{subtitle}</div> : null}
        <div style={{ fontWeight: 600, marginTop: 4 }}>No. {number}</div>
        <div className="muted">Date {date}</div>
      </div>
    </div>
  );
}
