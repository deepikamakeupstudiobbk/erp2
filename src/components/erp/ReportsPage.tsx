import React, { useMemo, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { useErpData } from './ErpData';
import { btnGold, card, inputCls, Kpi, PageHeader } from './ui';
import { cleanPhone, downloadCSV, entryDate, entryMonth, escapeHtml, money, monthLabel, prettyDate, printHTML, rowPaid, rowPending } from './util';
import type { Row } from './util';

export const ReportsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { bookingEntries, dailyEntries } = useStudio();
  const { expenses, employees } = useErpData();

  const all: Row[] = useMemo(
    () => [...bookingEntries.map(e => ({ ...e, kind: 'booking' as const })), ...dailyEntries.map(e => ({ ...e, kind: 'daily' as const }))],
    [bookingEntries, dailyEntries]
  );

  const [month, setMonth] = useState('all');
  const [staff, setStaff] = useState('all');
  const [service, setService] = useState('all');
  const [applied, setApplied] = useState({ month: 'all', staff: 'all', service: 'all' });

  const months = useMemo(() => {
    const set = new Set<string>();
    all.forEach(e => entryMonth(e) && set.add(entryMonth(e)));
    expenses.forEach(e => e.month && set.add(e.month));
    return [...set].sort().reverse();
  }, [all, expenses]);

  const staffList = useMemo(() => {
    const set = new Set<string>(employees.map(e => e.name));
    all.forEach(e => (e.staff || e.createdBy) && set.add(e.staff || e.createdBy));
    return [...set].filter(Boolean).sort();
  }, [all, employees]);

  const services = useMemo(() => [...new Set(all.map(e => e.packageName).filter(Boolean))].sort(), [all]);

  const staffOf = (e: Row) => e.staff || (e.kind === 'booking' ? e.createdBy : '') || '-';

  const rows = useMemo(
    () =>
      all
        .filter(e => (applied.month === 'all' || entryMonth(e) === applied.month) && (applied.staff === 'all' || staffOf(e) === applied.staff) && (applied.service === 'all' || e.packageName === applied.service))
        .sort((a, b) => entryDate(b).localeCompare(entryDate(a))),
    [all, applied]
  );

  const revenue = rows.reduce((s, e) => s + (Number(e.totalAmount) || 0), 0);
  const received = rows.reduce((s, e) => s + rowPaid(e), 0);
  const pending = rows.reduce((s, e) => s + rowPending(e), 0);
  const expense = expenses.filter(e => applied.month === 'all' || e.month === applied.month).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const profit = received - expense;
  const clients = new Set(rows.map(e => cleanPhone(e.mobile) || e.clientName.toLowerCase())).size;

  const exportData = () =>
    downloadCSV(`report_${applied.month}.csv`, [
      ['Date', 'Type', 'ID', 'Customer', 'Mobile', 'Service', 'Staff', 'Total', 'Paid', 'Pending'],
      ...rows.map(e => [entryDate(e), e.kind === 'booking' ? 'Booking' : 'Daily', e.id, e.clientName, e.mobile, e.packageName, staffOf(e), e.totalAmount, rowPaid(e), rowPending(e)])
    ]);

  const print = () =>
    printHTML(
      'Monthly Report',
      `<h2>Deepika Sharma Makeup Studio – Report (${applied.month === 'all' ? 'All Months' : monthLabel(applied.month)})</h2>
       <p>Revenue ${money(revenue)} | Received ${money(received)} | Expense ${money(expense)} | Profit ${money(profit)} | Pending ${money(pending)} | Clients ${clients}</p>
       <table><tr><th>Date</th><th>Customer</th><th>Service</th><th>Staff</th><th>Total</th><th>Paid</th><th>Pending</th></tr>
       ${rows.map(e => `<tr><td>${prettyDate(entryDate(e))}</td><td>${escapeHtml(e.clientName)}</td><td>${escapeHtml(e.packageName)}</td><td>${escapeHtml(staffOf(e))}</td><td>${e.totalAmount}</td><td>${rowPaid(e)}</td><td>${rowPending(e)}</td></tr>`).join('')}</table>`
    );

  return (
    <div>
      <PageHeader title="Monthly Report" subtitle="Bookings + Daily Customers + Expenses ka poora hisaab" onBack={onBack} />

      <div className={`${card} mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]`}>
        <select value={month} onChange={e => setMonth(e.target.value)} className={inputCls}>
          <option value="all">All Months</option>
          {months.map(m => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select value={staff} onChange={e => setStaff(e.target.value)} className={inputCls}>
          <option value="all">All Staff</option>
          {staffList.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={service} onChange={e => setService(e.target.value)} className={inputCls}>
          <option value="all">All Services</option>
          {services.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button onClick={() => setApplied({ month, staff, service })} className={btnGold}>
          Generate
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Revenue" value={money(revenue)} tone="blue" />
        <Kpi label="Received" value={money(received)} tone="green" />
        <Kpi label="Expense" value={money(expense)} tone="red" />
        <Kpi label="Profit" value={money(profit)} tone="gold" />
        <Kpi label="Pending" value={money(pending)} tone="gold" />
        <Kpi label="Clients" value={clients} />
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead className="sticky top-0 bg-[#0f172a]">
              <tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Is filter mein koi entry nahi mili.
                  </td>
                </tr>
              )}
              {rows.map(e => (
                <tr key={e.kind + e.id} className="border-b border-slate-800/70 text-slate-200">
                  <td className="px-4 py-2.5 whitespace-nowrap">{prettyDate(entryDate(e))}</td>
                  <td className="px-4 py-2.5">{e.clientName}</td>
                  <td className="px-4 py-2.5">{e.packageName}</td>
                  <td className="px-4 py-2.5">{staffOf(e)}</td>
                  <td className="px-4 py-2.5">{money(e.totalAmount)}</td>
                  <td className="px-4 py-2.5 text-emerald-400">{money(rowPaid(e))}</td>
                  <td className={`px-4 py-2.5 ${rowPending(e) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>{money(rowPending(e))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-slate-800 p-3">
          <button onClick={print} className="rounded-lg bg-slate-800 py-2.5 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer">
            Print Report
          </button>
          <button onClick={exportData} className="rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer">
            Export Data (CSV)
          </button>
        </div>
      </div>
    </div>
  );
};
