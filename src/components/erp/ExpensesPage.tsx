import React, { useMemo, useState } from 'react';
import { Trash2, Plus, Download, Search } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { useErpData } from './ErpData';
import { card, DateInput, inputCls, labelCls, MonthInput, PageHeader } from './ui';
import { downloadCSV, money, monthLabel, prettyDate, today } from './util';

export const ExpensesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { showToast } = useStudio();
  const { expenses, employees, saveExpense, removeExpense, loading, error } = useErpData();

  const [sal, setSal] = useState({ date: today(), month: today().slice(0, 7), name: '', amount: '', mode: 'Cash', notes: '' });
  const [mat, setMat] = useState({ date: today(), name: '', amount: '', vendor: '', qty: '', notes: '' });
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const payroll = expenses.filter(e => e.type === 'salary').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const material = expenses.filter(e => e.type === 'material').reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return [...expenses]
      .filter(e => !q || `${e.type} ${e.name} ${e.vendor} ${e.notes} ${e.mode} ${e.month}`.toLowerCase().includes(q))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id.localeCompare(a.id));
  }, [expenses, filter]);

  const addSalary = async () => {
    if (!sal.name.trim() || !(Number(sal.amount) > 0)) return showToast('Staff ka naam aur amount likhein.');
    setBusy(true);
    const ok = await saveExpense({
      type: 'salary',
      date: sal.date || today(),
      month: sal.month || (sal.date || today()).slice(0, 7),
      name: sal.name.trim(),
      amount: Number(sal.amount),
      mode: sal.mode,
      vendor: '',
      qty: '',
      notes: sal.notes.trim()
    });
    setBusy(false);
    if (ok) setSal({ ...sal, name: '', amount: '', notes: '' });
  };

  const addMaterial = async () => {
    if (!mat.name.trim() || !(Number(mat.amount) > 0)) return showToast('Item ka naam aur cost likhein.');
    setBusy(true);
    const ok = await saveExpense({
      type: 'material',
      date: mat.date || today(),
      month: (mat.date || today()).slice(0, 7),
      name: mat.name.trim(),
      amount: Number(mat.amount),
      mode: 'Cash',
      vendor: mat.vendor.trim(),
      qty: mat.qty.trim(),
      notes: mat.notes.trim()
    });
    setBusy(false);
    if (ok) setMat({ ...mat, name: '', amount: '', vendor: '', qty: '', notes: '' });
  };

  const exportCsv = () =>
    downloadCSV('expenses.csv', [
      ['ID', 'Type', 'Date', 'Month', 'Staff / Item', 'Amount', 'Mode', 'Supplier', 'Qty', 'Notes'],
      ...shown.map(e => [e.id, e.type === 'salary' ? 'Salary' : 'Material', e.date, e.month, e.name, e.amount, e.mode, e.vendor, e.qty, e.notes])
    ]);

  return (
    <div>
      <PageHeader title="Expense Command Center" subtitle={'Staff salary aur saman ka kharcha – Google Sheet "Expenses" tab mein'} onBack={onBack} />
      {error && <div className="mb-3 rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-300">{error}</div>}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`${card} border-l-2 border-l-indigo-400 p-4`}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payroll Distributed</div>
          <div className="mt-1 text-xl font-extrabold text-white">{money(payroll)}</div>
        </div>
        <div className={`${card} border-l-2 border-l-amber-400 p-4`}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Material Procurement</div>
          <div className="mt-1 text-xl font-extrabold text-white">{money(material)}</div>
        </div>
        <div className={`${card} border-l-2 border-l-rose-400 p-4`}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Grand Total Expense</div>
          <div className="mt-1 text-xl font-extrabold text-rose-400">{money(payroll + material)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4">
          {/* Salary */}
          <div className={`${card} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-white">Staff Salary Log</h3>
              <button onClick={addSalary} disabled={busy} className="rounded-md bg-indigo-500 p-1.5 text-white hover:bg-indigo-400 cursor-pointer" title="Add">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Date</label>
                <DateInput value={sal.date} onChange={v => setSal({ ...sal, date: v, month: v ? v.slice(0, 7) : sal.month })} />
              </div>
              <div>
                <label className={labelCls}>Month</label>
                <MonthInput value={sal.month} onChange={v => setSal({ ...sal, month: v })} />
              </div>
              <div>
                <label className={labelCls}>Staff Name</label>
                <input list="erp-staff-names" value={sal.name} onChange={e => setSal({ ...sal, name: e.target.value })} placeholder="Staff Name" className={inputCls} />
                <datalist id="erp-staff-names">
                  {employees.map(e => (
                    <option key={e.id} value={e.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Amount (₹)</label>
                <input inputMode="numeric" value={sal.amount} onChange={e => setSal({ ...sal, amount: e.target.value.replace(/[^\d]/g, '') })} placeholder="Amount" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cash / UPI</label>
                <select value={sal.mode} onChange={e => setSal({ ...sal, mode: e.target.value })} className={inputCls}>
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input value={sal.notes} onChange={e => setSal({ ...sal, notes: e.target.value })} placeholder="Notes" className={inputCls} />
              </div>
            </div>
            <button onClick={addSalary} disabled={busy} className="mt-3 w-full rounded-lg bg-indigo-500 py-2 text-xs font-bold text-white hover:bg-indigo-400 cursor-pointer disabled:opacity-60">
              Salary Save Karo
            </button>
          </div>

          {/* Material */}
          <div className={`${card} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-white">Material Procurement</h3>
              <button onClick={addMaterial} disabled={busy} className="rounded-md bg-amber-500 p-1.5 text-black hover:bg-amber-400 cursor-pointer" title="Add">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Date</label>
                <DateInput value={mat.date} onChange={v => setMat({ ...mat, date: v })} />
              </div>
              <div>
                <label className={labelCls}>Item Name</label>
                <input value={mat.name} onChange={e => setMat({ ...mat, name: e.target.value })} placeholder="Item Name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cost (₹)</label>
                <input inputMode="numeric" value={mat.amount} onChange={e => setMat({ ...mat, amount: e.target.value.replace(/[^\d]/g, '') })} placeholder="Cost" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Supplier / Vendor</label>
                <input value={mat.vendor} onChange={e => setMat({ ...mat, vendor: e.target.value })} placeholder="Supplier" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Qty</label>
                <input value={mat.qty} onChange={e => setMat({ ...mat, qty: e.target.value })} placeholder="Qty" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input value={mat.notes} onChange={e => setMat({ ...mat, notes: e.target.value })} placeholder="Notes" className={inputCls} />
              </div>
            </div>
            <button onClick={addMaterial} disabled={busy} className="mt-3 w-full rounded-lg bg-amber-500 py-2 text-xs font-bold text-black hover:bg-amber-400 cursor-pointer disabled:opacity-60">
              Material Save Karo
            </button>
          </div>
        </div>

        {/* History */}
        <div className={`${card} flex max-h-[760px] flex-col p-4`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-white">Expense History</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..." className={`${inputCls} w-44 pl-8`} />
            </div>
          </div>
          <div className="min-h-[200px] flex-1 overflow-y-auto">
            {shown.length === 0 && <div className="py-12 text-center text-xs text-slate-500">{loading ? 'Load ho raha hai...' : 'Abhi koi expense entry nahi hai.'}</div>}
            {shown.map(e => (
              <div key={e.id} className="flex items-center gap-3 border-b border-slate-800 py-2.5">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${e.type === 'salary' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {e.type === 'salary' ? 'Salary' : 'Material'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{e.name}</div>
                  <div className="truncate text-[11px] text-slate-400">
                    {prettyDate(e.date)}
                    {e.type === 'salary' ? ` · ${monthLabel(e.month)} · ${e.mode}` : `${e.vendor ? ' · ' + e.vendor : ''}${e.qty ? ' · Qty ' + e.qty : ''}`}
                    {e.notes ? ` · ${e.notes}` : ''}
                  </div>
                </div>
                <div className="text-sm font-bold text-rose-400">{money(e.amount)}</div>
                <button
                  onClick={() => window.confirm(`"${e.name}" ka ${money(e.amount)} wala expense delete karna hai?`) && removeExpense(e.id)}
                  className="rounded p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${card} mt-4 flex items-center justify-between p-3`}>
        <span className="text-xs text-slate-300">
          Report: <b className="text-white">{shown.length}</b> entries · Total <b className="text-rose-400">{money(shown.reduce((s, e) => s + (Number(e.amount) || 0), 0))}</b>
        </span>
        <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer">
          <Download className="h-3.5 w-3.5" /> Export (.CSV)
        </button>
      </div>
    </div>
  );
};
