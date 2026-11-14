import React from 'react';

/** Reference ERP jaisa dark-navy + gold look */
export const card = 'rounded-2xl border border-slate-700/40 bg-[#0f172a]';
export const inputCls =
  'w-full rounded-lg border border-slate-700/60 bg-[#0b1120] px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#ffd700]';
export const cellInput =
  'w-full min-w-[84px] rounded-md border border-[#ffd700]/60 bg-[#0b1120] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#ffd700]';
export const btnGold =
  'rounded-lg bg-[#ffd700] px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-black hover:bg-yellow-300 disabled:opacity-60 cursor-pointer';
export const btnGhost =
  'rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer disabled:opacity-60';
export const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400';

/** Date box: kahin bhi click karo to calendar khulta hai, date chunte hi set ho jati hai */
export const DateInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  className?: string;
  required?: boolean;
}> = ({ value, onChange, className, required }) => (
  <input
    type="date"
    required={required}
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    onClick={e => {
      try {
        (e.currentTarget as any).showPicker?.();
      } catch {
        /* purana browser */
      }
    }}
    className={`${className || inputCls} cursor-pointer [color-scheme:dark]`}
  />
);

export const MonthInput: React.FC<{ value: string; onChange: (v: string) => void; className?: string }> = ({ value, onChange, className }) => (
  <input
    type="month"
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    onClick={e => {
      try {
        (e.currentTarget as any).showPicker?.();
      } catch {
        /* purana browser */
      }
    }}
    className={`${className || inputCls} cursor-pointer [color-scheme:dark]`}
  />
);

export const Kpi: React.FC<{ label: string; value: React.ReactNode; tone?: 'white' | 'green' | 'gold' | 'red' | 'blue'; accent?: boolean }> = ({
  label,
  value,
  tone = 'white',
  accent
}) => {
  const color = { white: 'text-white', green: 'text-emerald-400', gold: 'text-amber-400', red: 'text-rose-400', blue: 'text-sky-400' }[tone];
  return (
    <div className={`${card} p-4 ${accent ? 'border-l-2 border-l-emerald-400' : ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-extrabold sm:text-2xl ${color}`}>{value}</div>
    </div>
  );
};

export const PageHeader: React.FC<{ title: string; subtitle?: string; onBack: () => void; right?: React.ReactNode }> = ({ title, subtitle, onBack, right }) => (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 className="text-xl font-extrabold text-white sm:text-2xl">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-2">
      {right}
      <button onClick={onBack} className="rounded-lg border border-[#ffd700] px-3 py-2 text-xs font-bold text-[#ffd700] hover:bg-[#ffd700]/10 cursor-pointer">
        ← Back to Dashboard
      </button>
    </div>
  </div>
);

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
      status === 'Completed' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
    }`}
  >
    {status}
  </span>
);
