import { LedgerEntry } from '../../types';
import { ledgerPaid, ledgerPending } from '../../lib/ledger';

export const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const money = (n: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN');

/** 2026-10-26 -> 26 Oct 2026 */
export const prettyDate = (iso?: string) => {
  if (!iso) return '-';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${names[Number(m[2]) - 1]} ${m[1]}`;
};

export const monthLabel = (ym: string) => {
  const m = String(ym).match(/^(\d{4})-(\d{2})/);
  if (!m) return ym;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(m[2]) - 1]} ${m[1]}`;
};

export type Row = LedgerEntry & { kind: 'booking' | 'daily' };

/** Entry kis date ki maani jaye (reports / month filter ke liye) */
export const entryDate = (e: LedgerEntry) => e.eventDate || e.advanceDate || e.createdAt || '';
export const entryMonth = (e: LedgerEntry) => entryDate(e).slice(0, 7);

export const rowPaid = (e: LedgerEntry) => ledgerPaid(e);
export const rowPending = (e: LedgerEntry) => ledgerPending(e);

export const cleanPhone = (p: string) => String(p || '').replace(/\D/g, '').slice(-10);

export const whatsappLink = (mobile: string, text: string) => `https://wa.me/91${cleanPhone(mobile)}?text=${encodeURIComponent(text)}`;

export function downloadFile(name: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadCSV(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  // BOM: Excel mein Hindi / ₹ sahi dikhe
  downloadFile(name, '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n'), 'text/csv');
}

export function printHTML(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('Pop-up block ho gaya. Browser mein pop-up allow karein.');
    return;
  }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
  th{background:#f5c518}h1,h2{margin:0 0 6px}.r{text-align:right}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export const escapeHtml = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
