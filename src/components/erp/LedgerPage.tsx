import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { LedgerEntry, LedgerInput, LedgerKind } from '../../types';
import { LEDGER_STATUSES, ledgerPending, normalizeLedgerStatus } from '../../lib/ledger';
import { useErpData } from './ErpData';
import { btnGhost, btnGold, card, cellInput, DateInput, inputCls, labelCls, PageHeader, StatusBadge } from './ui';
import { money, prettyDate, today } from './util';

interface Props {
  kind: LedgerKind;
  onBack: () => void;
}

type Draft = Partial<LedgerEntry>;

interface FormState {
  clientName: string;
  mobile: string;
  eventDate: string;
  packageName: string;
  total: string;
  advance: string;
  advanceDate: string;
  staff: string;
}

const emptyForm = (kind: LedgerKind, staff = ''): FormState => ({
  clientName: '',
  mobile: '',
  eventDate: kind === 'daily' ? today() : '',
  packageName: '',
  total: '',
  advance: '',
  advanceDate: '',
  staff
});

const n = (v: string | number | undefined) => Number(v) || 0;

/** Booking aur Daily Customers dono ka ek hi page (reference ERP jaisa: upar form, neeche editable table) */
export const LedgerPage: React.FC<Props> = ({ kind, onBack }) => {
  const { session, bookingEntries, dailyEntries, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, refreshLedger, isLedgerSyncing, ledgerPackages, previewLedgerId, showToast } =
    useStudio();
  const { employees } = useErpData();
  const isOwner = session.role === 'owner';
  const isBooking = kind === 'booking';
  const list = isBooking ? bookingEntries : dailyEntries;

  const [form, setForm] = useState<FormState>(() => emptyForm(kind, session.role === 'employee' ? session.name : ''));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const setF = (p: Partial<FormState>) => setForm(f => ({ ...f, ...p }));

  const staffNames = useMemo(() => {
    const names = employees.filter(e => e.active !== 'no').map(e => e.name);
    if (session.name && !names.includes(session.name)) names.push(session.name);
    return names;
  }, [employees, session.name]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...list]
      .filter(e => {
        const okStatus = statusFilter === 'all' || normalizeLedgerStatus(e.status) === statusFilter;
        const okText = !q || `${e.id} ${e.clientName} ${e.mobile} ${e.packageName} ${e.staff || ''}`.toLowerCase().includes(q);
        return okStatus && okText;
      })
      .sort((a, b) => (b.eventDate || b.createdAt || '').localeCompare(a.eventDate || a.createdAt || ''));
  }, [list, search, statusFilter]);

  const merged = (e: LedgerEntry): LedgerEntry => ({ ...e, ...(drafts[e.id] || {}) });
  const totalAmount = rows.reduce((s, e) => s + n(e.totalAmount), 0);
  const totalPending = rows.reduce((s, e) => s + ledgerPending(merged(e)), 0);

  const setDraft = (id: string, p: Draft) => setDrafts(d => ({ ...d, [id]: { ...(d[id] || {}), ...p } }));

  /* ---------- form save (naya ya edit) ---------- */
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.clientName.trim()) return showToast('Client ka naam likhein.');
    if (form.mobile.replace(/\D/g, '').length < 10) return showToast('Sahi 10 digit mobile number likhein.');
    if (!form.packageName.trim()) return showToast(isBooking ? 'Package ka naam likhein.' : 'Service likhein.');
    if (isBooking && !n(form.total)) return showToast('Total amount likhein.');

    const total = n(form.total);
    const adv = n(form.advance);
    const advDate = form.advanceDate || (adv > 0 ? today() : '');
    setSaving(true);
    if (editingId) {
      const old = list.find(e => e.id === editingId);
      if (old) {
        const base = merged(old);
        const upd: LedgerEntry = {
          ...base,
          clientName: form.clientName.trim(),
          mobile: form.mobile.trim(),
          eventDate: form.eventDate,
          packageName: form.packageName.trim(),
          totalAmount: total,
          advanceAmount: adv,
          advanceDate: advDate,
          staff: form.staff
        };
        upd.status = ledgerPending(upd) === 0 && total > 0 ? 'Completed' : normalizeLedgerStatus(base.status);
        await updateLedgerEntry(kind, upd);
        setDrafts(d => {
          const c = { ...d };
          delete c[editingId];
          return c;
        });
      }
      setEditingId(null);
    } else {
      const input: LedgerInput = {
        clientName: form.clientName.trim(),
        mobile: form.mobile.trim(),
        eventDate: form.eventDate,
        packageName: form.packageName.trim(),
        totalAmount: total,
        advanceDate: advDate,
        advanceAmount: adv,
        s1Date: '',
        s1Desc: '',
        s1Paid: 0,
        s2Date: '',
        s2Desc: '',
        s2Paid: 0,
        ...(isBooking ? { s3Date: '', s3Desc: '', s3Paid: 0 } : {}),
        status: total > 0 && adv >= total ? 'Completed' : 'Payment Pending',
        staff: form.staff
      };
      await addLedgerEntry(kind, input);
    }
    setSaving(false);
    setForm(emptyForm(kind, form.staff));
  };

  const startEdit = (e: LedgerEntry) => {
    const m = merged(e);
    setEditingId(e.id);
    setForm({
      clientName: m.clientName,
      mobile: m.mobile,
      eventDate: m.eventDate,
      packageName: m.packageName,
      total: String(m.totalAmount || ''),
      advance: String(m.advanceAmount || ''),
      advanceDate: m.advanceDate,
      staff: m.staff || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('erp-scroll-top')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm(kind, form.staff));
  };

  /* ---------- table row actions ---------- */
  const doUpdate = async (e: LedgerEntry) => {
    const m = merged(e);
    const upd: LedgerEntry = { ...m, status: ledgerPending(m) === 0 && n(m.totalAmount) > 0 ? 'Completed' : normalizeLedgerStatus(m.status) };
    const ok = await updateLedgerEntry(kind, upd);
    if (ok)
      setDrafts(d => {
        const c = { ...d };
        delete c[e.id];
        return c;
      });
  };

  const onAction = (e: LedgerEntry, v: string) => {
    if (v === 'update') doUpdate(e);
    else if (v === 'edit') startEdit(e);
    else if (v === 'delete') {
      if (window.confirm(`"${e.clientName}" (${e.id}) ki entry delete karni hai? Ye Google Sheet se bhi hat jayegi.`)) deleteLedgerEntry(kind, e.id);
    }
  };

  const sInputs = (e: LedgerEntry, k: 's1' | 's2' | 's3') => {
    const m = merged(e) as any;
    return (
      <>
        <td className="px-1.5 py-1.5 min-w-[128px]">
          <DateInput value={m[`${k}Date`] || ''} onChange={v => setDraft(e.id, { [`${k}Date`]: v } as Draft)} className={cellInput} />
        </td>
        {isBooking && (
          <td className="px-1.5 py-1.5 min-w-[120px]">
            <input value={m[`${k}Desc`] || ''} onChange={ev => setDraft(e.id, { [`${k}Desc`]: ev.target.value } as Draft)} className={cellInput} />
          </td>
        )}
        <td className="px-1.5 py-1.5 min-w-[84px]">
          <input
            inputMode="numeric"
            value={m[`${k}Paid`] ? String(m[`${k}Paid`]) : ''}
            onChange={ev => setDraft(e.id, { [`${k}Paid`]: n(ev.target.value.replace(/[^\d]/g, '')) } as Draft)}
            placeholder="0"
            className={cellInput}
          />
        </td>
      </>
    );
  };

  const th = 'px-2 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wide text-black whitespace-nowrap';
  const td = 'px-2 py-2 text-center text-xs text-slate-100 whitespace-nowrap';
  const series = isBooking ? (['s1', 's2', 's3'] as const) : (['s1', 's2'] as const);
  const nextId = !editingId && form.packageName ? previewLedgerId(kind, form.packageName) : editingId;

  return (
    <div>
      <div id="erp-scroll-top" />
      <PageHeader
        title={isBooking ? 'Bookings' : 'Daily Customers'}
        subtitle={isBooking ? 'Bridal / event bookings – Google Sheet "Bookings" tab mein save hoti hain' : 'Roz ke walk-in customers – Google Sheet "DailyCustomers" tab mein save hote hain'}
        onBack={onBack}
      />

      {/* ----- Entry form ----- */}
      <form onSubmit={handleSubmit} className={`${card} mb-4 p-4 ${editingId ? 'border-[#ffd700]/70' : ''}`}>
        {editingId && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-[#ffd700]/10 px-3 py-2 text-xs text-[#ffd700]">
            <span>
              Edit mode: <b>{editingId}</b>
            </span>
            <button type="button" onClick={cancelEdit} className="font-bold underline cursor-pointer">
              Cancel
            </button>
          </div>
        )}

        {isBooking ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls}>ID (khud ban jati hai)</label>
              <input readOnly value={nextId || 'package ke pehle akshar se'} className={`${inputCls} text-slate-400`} />
            </div>
            <div>
              <label className={labelCls}>Client Name *</label>
              <input value={form.clientName} onChange={e => setF({ clientName: e.target.value })} placeholder="Client" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mobile *</label>
              <input inputMode="tel" value={form.mobile} onChange={e => setF({ mobile: e.target.value })} placeholder="+91 98XXXXXXXX" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Event Date</label>
              <DateInput value={form.eventDate} onChange={v => setF({ eventDate: v })} />
            </div>
            <div>
              <label className={labelCls}>Package *</label>
              <input list="erp-packages" value={form.packageName} onChange={e => setF({ packageName: e.target.value })} placeholder="e.g. Bridal Makeup" className={inputCls} />
              <datalist id="erp-packages">
                {ledgerPackages.map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Total Amount (₹) *</label>
              <input inputMode="numeric" value={form.total} onChange={e => setF({ total: e.target.value.replace(/[^\d]/g, '') })} placeholder="Total" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Advance (₹)</label>
              <input inputMode="numeric" value={form.advance} onChange={e => setF({ advance: e.target.value.replace(/[^\d]/g, '') })} placeholder="Advance" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Advance Date</label>
              <DateInput value={form.advanceDate} onChange={v => setF({ advanceDate: v })} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls}>Date</label>
              <DateInput value={form.eventDate} onChange={v => setF({ eventDate: v })} />
            </div>
            <div>
              <label className={labelCls}>Client Name *</label>
              <input value={form.clientName} onChange={e => setF({ clientName: e.target.value })} placeholder="Client Name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mobile *</label>
              <input inputMode="tel" value={form.mobile} onChange={e => setF({ mobile: e.target.value })} placeholder="Mobile" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Service *</label>
              <input list="erp-packages" value={form.packageName} onChange={e => setF({ packageName: e.target.value })} placeholder="e.g. Threading, Facial" className={inputCls} />
              <datalist id="erp-packages">
                {ledgerPackages.map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Staff</label>
              <select value={form.staff} onChange={e => setF({ staff: e.target.value })} className={inputCls}>
                <option value="">Staff select karein</option>
                {staffNames.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Total Amount (₹)</label>
              <input inputMode="numeric" value={form.total} onChange={e => setF({ total: e.target.value.replace(/[^\d]/g, '') })} placeholder="Total Amount" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Paid Amount (₹)</label>
              <input inputMode="numeric" value={form.advance} onChange={e => setF({ advance: e.target.value.replace(/[^\d]/g, '') })} placeholder="Paid Amount" className={inputCls} />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving} className={`${btnGold} w-full`}>
                {saving ? 'Save ho raha hai...' : editingId ? 'Update Customer' : 'Save Customer'}
              </button>
            </div>
          </div>
        )}

        {isBooking && (
          <button type="submit" disabled={saving} className={`${btnGold} mt-3 w-full`}>
            {saving ? 'Save ho raha hai...' : editingId ? 'Update Booking' : 'Save Booking'}
          </button>
        )}
      </form>

      {/* ----- Table ----- */}
      <div className={`${card} p-3 sm:p-4`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search naam / mobile / ID..." className={`${inputCls} max-w-xs`} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputCls} max-w-[190px]`}>
            <option value="all">Sab Status</option>
            {LEDGER_STATUSES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button onClick={() => refreshLedger()} className={`${btnGhost} flex items-center gap-1.5`}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLedgerSyncing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <div className="ml-auto flex gap-4 text-xs text-slate-300">
            <span>
              Total: <b className="text-white">{money(totalAmount)}</b>
            </span>
            <span>
              Pending: <b className="text-amber-400">{money(totalPending)}</b>
            </span>
            <span>
              Entries: <b className="text-white">{rows.length}</b>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg">
          <table className="w-full border-collapse" style={{ minWidth: isBooking ? 1750 : 1250 }}>
            <thead>
              <tr className="bg-[#ffd700]">
                {isBooking ? (
                  <>
                    <th className={th}>ID</th>
                    <th className={th}>Client</th>
                    <th className={th}>Mobile</th>
                    <th className={th}>Event</th>
                    <th className={th}>Pkg</th>
                    <th className={th}>Total</th>
                    <th className={th}>Adv</th>
                    <th className={th}>Adv Dt</th>
                  </>
                ) : (
                  <>
                    <th className={th}>Date</th>
                    <th className={th}>Client</th>
                    <th className={th}>Mobile</th>
                    <th className={th}>Service</th>
                    <th className={th}>Staff</th>
                    <th className={th}>Total</th>
                    <th className={th}>Paid</th>
                  </>
                )}
                {series.map((k, i) => (
                  <React.Fragment key={k}>
                    <th className={th}>{isBooking ? `S${i + 1} Dt` : `S${i + 1} DT`}</th>
                    {isBooking && <th className={th}>{`S${i + 1} Svc`}</th>}
                    <th className={th}>{isBooking ? `Paid${i + 1}` : `S${i + 1} AMT`}</th>
                  </React.Fragment>
                ))}
                <th className={th}>Pending</th>
                <th className={th}>Status</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={30} className="py-10 text-center text-xs text-slate-500">
                    {isLedgerSyncing ? 'Google Sheet se data aa raha hai...' : 'Abhi koi entry nahi hai. Upar form se pehli entry add karein.'}
                  </td>
                </tr>
              )}
              {rows.map(e => {
                const m = merged(e);
                const pend = ledgerPending(m);
                const dirty = !!drafts[e.id];
                return (
                  <tr key={e.id} className={`border-b border-slate-800 ${dirty ? 'bg-[#ffd700]/5' : ''}`}>
                    {isBooking ? (
                      <>
                        <td className={`${td} font-semibold`}>
                          {e.id}
                          {e.synced === false && <span className="ml-1 text-[9px] text-rose-400" title="Sheet mein save nahi hua">●</span>}
                        </td>
                        <td className={td}>{m.clientName}</td>
                        <td className={td}>{m.mobile}</td>
                        <td className={td}>{prettyDate(m.eventDate)}</td>
                        <td className={td}>{m.packageName}</td>
                        <td className={td}>{m.totalAmount}</td>
                        <td className={td}>{m.advanceAmount}</td>
                        <td className={td}>{prettyDate(m.advanceDate)}</td>
                      </>
                    ) : (
                      <>
                        <td className={td}>
                          {prettyDate(m.eventDate)}
                          {e.synced === false && <span className="ml-1 text-[9px] text-rose-400" title="Sheet mein save nahi hua">●</span>}
                        </td>
                        <td className={`${td} font-semibold`}>{m.clientName}</td>
                        <td className={td}>{m.mobile}</td>
                        <td className={`${td} whitespace-normal min-w-[180px] max-w-[280px]`}>{m.packageName}</td>
                        <td className={td}>{m.staff || '-'}</td>
                        <td className={td}>{m.totalAmount}</td>
                        <td className={td}>{m.advanceAmount}</td>
                      </>
                    )}
                    {series.map(k => (
                      <React.Fragment key={k}>{sInputs(e, k)}</React.Fragment>
                    ))}
                    <td className={`${td} font-bold ${pend > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{pend}</td>
                    <td className={td}>
                      <select
                        value={normalizeLedgerStatus(m.status)}
                        onChange={ev => setDraft(e.id, { status: ev.target.value as LedgerEntry['status'] })}
                        className="rounded border border-slate-600 bg-[#0b1120] px-1.5 py-1 text-[10px] font-bold uppercase text-white"
                      >
                        {LEDGER_STATUSES.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={td}>
                      <select
                        value=""
                        onChange={ev => onAction(e, ev.target.value)}
                        className="rounded border border-[#ffd700] bg-[#0b1120] px-2 py-1 text-xs font-semibold text-[#ffd700] cursor-pointer"
                      >
                        <option value="">Select</option>
                        <option value="update">{dirty ? 'Update (save karo)' : 'Update'}</option>
                        <option value="edit">Edit details</option>
                        {isOwner && <option value="delete">Delete</option>}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Tip: S1 / S2{isBooking ? ' / S3' : ''} ki date, amount table mein hi badlo, phir Action → <b>Update</b>. Naam, total jaisi baaki details badalni ho to Action → <b>Edit details</b>.
        </p>
      </div>
    </div>
  );
};
