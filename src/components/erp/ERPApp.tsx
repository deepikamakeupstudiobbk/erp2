import React, { useMemo, useState } from 'react';
import { Bell, CalendarDays, FileText, HardDrive, LogOut, Users, Wallet, BarChart3, UserCog, X } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { STUDIO_LOGO } from '../../data/initialData';
import { ErpDataProvider, useErpData } from './ErpData';
import { LedgerPage } from './LedgerPage';
import { ExpensesPage } from './ExpensesPage';
import { ReportsPage } from './ReportsPage';
import { EmployeesPage } from './EmployeesPage';
import { InvoicePage } from './InvoicePage';
import { BackupPage } from './BackupPage';
import { NotificationsPage } from './NotificationsPage';
import { card, Kpi } from './ui';
import { cleanPhone, entryMonth, money, rowPaid, rowPending, today } from './util';

type Page = 'home' | 'bookings' | 'customers' | 'expenses' | 'reports' | 'employees' | 'invoice' | 'backup' | 'notifications';

const MODULES: { id: Page; label: string; icon: React.ElementType; ownerOnly?: boolean }[] = [
  { id: 'bookings', label: 'Booking', icon: CalendarDays },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'expenses', label: 'Expenses', icon: Wallet, ownerOnly: true },
  { id: 'reports', label: 'Reports', icon: BarChart3, ownerOnly: true },
  { id: 'employees', label: 'Employee', icon: UserCog, ownerOnly: true },
  { id: 'invoice', label: 'Invoice', icon: FileText, ownerOnly: true },
  { id: 'backup', label: 'Backup Center', icon: HardDrive, ownerOnly: true },
  { id: 'notifications', label: 'Notifications', icon: Bell, ownerOnly: true }
];

const Home: React.FC<{ go: (p: Page) => void }> = ({ go }) => {
  const { session, bookingEntries, dailyEntries } = useStudio();
  const { expenses } = useErpData();
  const isOwner = session.role === 'owner';

  const m = useMemo(() => {
    const all = [...bookingEntries, ...dailyEntries];
    const t = today();
    const ym = t.slice(0, 7);
    const revenue = all.reduce((s, e) => s + (Number(e.totalAmount) || 0), 0);
    const received = all.reduce((s, e) => s + rowPaid(e), 0);
    const pending = all.reduce((s, e) => s + rowPending(e), 0);
    const expense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const monthReceived = all.filter(e => entryMonth(e) === ym).reduce((s, e) => s + rowPaid(e), 0);
    const monthExpense = expenses.filter(e => e.month === ym).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const customers = new Set(all.map(e => cleanPhone(e.mobile) || e.clientName.toLowerCase())).size;
    const todayBookings = bookingEntries.filter(e => e.eventDate === t).length;
    const dues = all
      .filter(e => rowPending(e) > 0)
      .sort((a, b) => rowPending(b) - rowPending(a))
      .slice(0, 5);
    return { revenue, received, pending, expense, profit: received - expense, monthProfit: monthReceived - monthExpense, customers, todayBookings, dues, outflow: received > 0 ? (expense / received) * 100 : 0 };
  }, [bookingEntries, dailyEntries, expenses]);

  const visible = MODULES.filter(x => isOwner || !x.ownerOnly);

  return (
    <div>
      {isOwner ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Total Revenue" value={money(m.revenue)} />
            <Kpi label="Total Received" value={money(m.received)} />
            <Kpi label="Net Profit" value={money(m.profit)} tone="green" accent />
            <div className={`${card} border-amber-500/70 p-4`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Pending</div>
              <div className="mt-1 text-xl font-extrabold text-amber-400 sm:text-2xl">{money(m.pending)}</div>
            </div>
            <Kpi label="Today's Booking" value={m.todayBookings} />
            <Kpi label="Total Customers" value={m.customers} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className={`${card} p-5`}>
              <div className="text-xs font-extrabold uppercase text-amber-400">Monthly Profit</div>
              <div className={`mt-1 text-3xl font-extrabold ${m.monthProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{money(m.monthProfit)}</div>
              <div className="mt-1 text-[11px] text-slate-400">Is mahine ki received amount − expenses</div>
            </div>
            <div className={`${card} flex flex-col items-center justify-center p-5`}>
              <div className="text-3xl font-extrabold text-rose-500">{money(m.expense)}</div>
              <div className="mt-1 text-[11px] uppercase text-slate-400">Outflow rate: {m.outflow.toFixed(1)}%</div>
            </div>
            <div className={`${card} p-5`}>
              <div className="mb-2 text-xs font-extrabold uppercase text-amber-400">Pending Customers</div>
              {m.dues.length === 0 && <div className="text-xs text-slate-500">Koi payment baaki nahi 🎉</div>}
              {m.dues.map(d => (
                <div key={d.id} className="flex justify-between py-1 text-xs">
                  <span className="truncate text-slate-200">{d.clientName}</span>
                  <b className="text-rose-400">{money(rowPending(d))}</b>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className={`${card} mb-2 p-5`}>
          <div className="text-lg font-extrabold text-white">Namaste, {session.name} 👋</div>
          <div className="text-xs text-slate-400">Neeche se Booking ya Customers chuniye.</div>
        </div>
      )}

      <div className={`mt-8 grid gap-3 ${isOwner ? 'grid-cols-2 md:grid-cols-4 xl:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {visible.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            className={`${card} flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold text-white transition hover:border-[#ffd700]/70 hover:bg-[#131c33] cursor-pointer`}
          >
            <Icon className="h-4 w-4 text-[#ffd700]" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
};

const Shell: React.FC = () => {
  const { session, closeERPModal, logoutToGuest } = useStudio();
  const isOwner = session.role === 'owner';
  const [page, setPage] = useState<Page>('home');

  const back = () => setPage('home');
  // Staff sirf Booking / Customers dekh sakta hai
  const allowed = isOwner || page === 'home' || page === 'bookings' || page === 'customers';
  const cur: Page = allowed ? page : 'home';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0b1120] text-white">
      <div className="mx-auto max-w-[1500px] px-3 pb-10 pt-4 sm:px-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <button onClick={back} className="flex items-center gap-3 text-left cursor-pointer">
            <img src={STUDIO_LOGO} alt="Logo" className="h-12 w-12 rounded-full border border-[#ffd700]/60 object-cover" />
            <div>
              <div className="text-xl font-extrabold text-[#ffd700] sm:text-2xl">Deepika Studio ERP</div>
              <div className="text-xs text-slate-400">
                {isOwner ? 'Business Dashboard' : `Staff: ${session.name}`}
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={logoutToGuest} className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-400 cursor-pointer">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
            <button onClick={closeERPModal} title="ERP band karo" className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:bg-slate-800 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {cur === 'home' && <Home go={setPage} />}
        {cur === 'bookings' && <LedgerPage kind="booking" onBack={back} />}
        {cur === 'customers' && <LedgerPage kind="daily" onBack={back} />}
        {cur === 'expenses' && <ExpensesPage onBack={back} />}
        {cur === 'reports' && <ReportsPage onBack={back} />}
        {cur === 'employees' && <EmployeesPage onBack={back} />}
        {cur === 'invoice' && <InvoicePage onBack={back} />}
        {cur === 'backup' && <BackupPage onBack={back} />}
        {cur === 'notifications' && <NotificationsPage onBack={back} />}
      </div>
    </div>
  );
};

export const ERPApp: React.FC = () => (
  <ErpDataProvider>
    <Shell />
  </ErpDataProvider>
);
