import React, { useMemo, useState } from 'react';
import { MessageCircle, Printer, Sparkles } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { card, inputCls, labelCls, PageHeader } from './ui';
import { escapeHtml, money, prettyDate, printHTML, rowPaid, rowPending, whatsappLink } from './util';
import type { Row } from './util';

const nextInvoiceNo = (bump: boolean) => {
  const year = new Date().getFullYear();
  let n = 0;
  try {
    n = Number(localStorage.getItem(`erp_invoice_${year}`)) || 0;
    if (bump) localStorage.setItem(`erp_invoice_${year}`, String(n + 1));
  } catch {
    /* ignore */
  }
  return `INV-${year}-${String((bump ? n + 1 : n + 1)).padStart(3, '0')}`;
};

export const InvoicePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { bookingEntries, dailyEntries, showToast } = useStudio();
  const all: Row[] = useMemo(
    () => [...bookingEntries.map(e => ({ ...e, kind: 'booking' as const })), ...dailyEntries.map(e => ({ ...e, kind: 'daily' as const }))],
    [bookingEntries, dailyEntries]
  );
  const [sel, setSel] = useState('');
  const [invNo, setInvNo] = useState(() => nextInvoiceNo(false));
  const row = all.find(e => e.kind + ':' + e.id === sel);

  const total = row ? Number(row.totalAmount) || 0 : 0;
  const paid = row ? rowPaid(row) : 0;
  const pending = row ? rowPending(row) : 0;

  const payments = row
    ? [
        { label: 'Advance', date: row.advanceDate, amt: row.advanceAmount },
        { label: 'S1', date: row.s1Date, amt: row.s1Paid },
        { label: 'S2', date: row.s2Date, amt: row.s2Paid },
        { label: 'S3', date: row.s3Date, amt: row.s3Paid }
      ].filter(p => Number(p.amt) > 0)
    : [];

  const generate = () => {
    if (!row) return showToast('Pehle customer select karein.');
    setInvNo(nextInvoiceNo(true));
    showToast('Invoice taiyar hai. Ab Print ya WhatsApp karein.');
  };

  const invoiceHtml = () =>
    row
      ? `<div style="max-width:420px;margin:auto;border:1px solid #ddd;padding:24px;border-radius:12px">
      <h2 style="text-align:center">DEEPIKA MAKEUP STUDIO</h2>
      <p style="text-align:center;font-size:12px;margin:0 0 4px">Premium Hair &amp; Bridal Makeover Zone</p>
      <p style="text-align:center;font-size:12px;margin:0 0 12px">Invoice: <b>${invNo}</b> &nbsp;|&nbsp; ${prettyDate(new Date().toISOString().slice(0, 10))}</p>
      <table>
        <tr><td>Client</td><td class="r">${escapeHtml(row.clientName)}</td></tr>
        <tr><td>Mobile</td><td class="r">${escapeHtml(row.mobile)}</td></tr>
        <tr><td>Service / Package</td><td class="r">${escapeHtml(row.packageName)}</td></tr>
        ${payments.map(p => `<tr><td>${p.label} ${p.date ? '(' + prettyDate(p.date) + ')' : ''}</td><td class="r">${money(Number(p.amt))}</td></tr>`).join('')}
        <tr><td><b>Total</b></td><td class="r"><b>${money(total)}</b></td></tr>
        <tr><td>Paid</td><td class="r">${money(paid)}</td></tr>
        <tr><td><b>Pending</b></td><td class="r"><b>${money(pending)}</b></td></tr>
      </table>
      <p style="text-align:center;font-size:12px;margin-top:16px"><i>Thank you for letting us make you shine!</i></p></div>`
      : '';

  const print = () => {
    if (!row) return showToast('Pehle customer select karein.');
    printHTML(`Invoice ${invNo}`, invoiceHtml());
  };

  const whatsapp = () => {
    if (!row) return showToast('Pehle customer select karein.');
    const msg =
      `*Deepika Makeup Studio*\nInvoice: ${invNo}\n\nNamaste ${row.clientName},\nService: ${row.packageName}\nTotal: ${money(total)}\nPaid: ${money(paid)}\nPending: ${money(pending)}\n\nDhanyavaad! Hamare saath rehne ke liye shukriya.`;
    window.open(whatsappLink(row.mobile, msg), '_blank');
  };

  return (
    <div>
      <PageHeader title="Invoice Studio" subtitle="Customer chuno, invoice banao, print ya WhatsApp karo" onBack={onBack} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className={`${card} flex flex-col p-4`}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Select Customer</label>
              <select value={sel} onChange={e => setSel(e.target.value)} className={inputCls}>
                <option value="">Select Customer</option>
                {all.map(e => (
                  <option key={e.kind + e.id} value={e.kind + ':' + e.id}>
                    {e.clientName} — {e.packageName || 'service'} ({e.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Mobile</label>
              <input readOnly value={row?.mobile || ''} placeholder="Mobile" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Service / Package</label>
              <input readOnly value={row?.packageName || ''} placeholder="Service" className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={`${labelCls} !text-slate-300`}>Total</label>
                <input readOnly value={row ? total : ''} placeholder="Total" className={inputCls} />
              </div>
              <div>
                <label className={`${labelCls} !text-emerald-400`}>Paid</label>
                <input readOnly value={row ? paid : ''} placeholder="Paid" className={inputCls} />
              </div>
              <div>
                <label className={`${labelCls} !text-rose-400`}>Pending</label>
                <input readOnly value={row ? pending : ''} placeholder="Pending" className={inputCls} />
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <button onClick={generate} className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-500 py-2.5 text-xs font-bold text-white cursor-pointer">
              <Sparkles className="h-4 w-4" /> Generate
            </button>
            <button onClick={print} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-700 py-2.5 text-xs font-bold text-white hover:bg-slate-600 cursor-pointer">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={whatsapp} className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className={`${card} flex items-center justify-center p-4`}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-slate-900 shadow-2xl">
            <h3 className="text-center text-lg font-extrabold">DEEPIKA MAKEUP STUDIO</h3>
            <p className="text-center text-[11px]">Premium Hair &amp; Bridal Makeover Zone</p>
            <div className="mx-auto mt-2 w-fit rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold">Invoice ID: {invNo}</div>
            <div className="my-3 border-t border-dashed border-slate-300" />
            {[
              ['Valued Client', row?.clientName || '-'],
              ['Contact', row?.mobile || '-'],
              ['Service Plan', row?.packageName || '-']
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-200 py-2 text-xs">
                <span className="text-slate-600">{k}</span>
                <b>{v}</b>
              </div>
            ))}
            {payments.map(p => (
              <div key={p.label} className="flex justify-between border-b border-slate-100 py-1.5 text-[11px] text-slate-600">
                <span>
                  {p.label} {p.date ? `· ${prettyDate(p.date)}` : ''}
                </span>
                <span>{money(Number(p.amt))}</span>
              </div>
            ))}
            <div className="flex justify-between border-b border-slate-200 py-2 text-xs">
              <span className="text-slate-600">Total</span>
              <b>{money(total)}</b>
            </div>
            <div className="flex justify-between border-b border-slate-200 py-2 text-xs">
              <span className="text-slate-600">Total Paid</span>
              <b className="text-emerald-600">{money(paid)}</b>
            </div>
            <div className="mt-1 flex justify-between rounded bg-slate-100 px-2 py-2 text-xs">
              <span>Pending</span>
              <b className="text-rose-600">{money(pending)}</b>
            </div>
            <p className="mt-4 text-center text-[11px] italic">Thank you for letting us make you shine! ✨</p>
          </div>
        </div>
      </div>
    </div>
  );
};
