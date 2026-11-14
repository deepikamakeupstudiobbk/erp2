import React, { useRef, useState } from 'react';
import { Camera, Eye, EyeOff, KeyRound, Pencil, Phone, Plus, Trash2, UserRound, X, Copy } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { compressImage, uploadPhotoToDrive } from '../../lib/drive';
import { ErpEmployee } from '../../types';
import { useErpData } from './ErpData';
import { btnGhost, btnGold, card, DateInput, inputCls, labelCls, PageHeader } from './ui';
import { money, prettyDate } from './util';

interface Form {
  id?: string;
  name: string;
  mobile: string;
  loginId: string;
  password: string;
  designation: string;
  salary: string;
  joinDate: string;
  address: string;
  photoUrl: string;
  photoFileId: string;
}

const empty: Form = { name: '', mobile: '', loginId: '', password: '', designation: '', salary: '', joinDate: '', address: '', photoUrl: '', photoFileId: '' };

/** Employee = profile + login ek hi jagah (naam, mobile, login ID, password, photo Drive mein) */
export const EmployeesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { showToast } = useStudio();
  const { employees, saveEmployee, removeEmployee, reload, loading, error } = useErpData();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [oldLoginId, setOldLoginId] = useState('');
  const [showPass, setShowPass] = useState(true);
  const [pendingPhoto, setPendingPhoto] = useState<string>(''); // compress ki hui nayi photo (abhi Drive par nahi gayi)
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ name: string; loginId: string; password: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setF = (p: Partial<Form>) => setForm(f => ({ ...f, ...p }));

  const openNew = () => {
    setForm(empty);
    setOldLoginId('');
    setPendingPhoto('');
    setShowPass(true);
    setCreated(null);
    setOpen(true);
  };

  const openEdit = (e: ErpEmployee) => {
    setForm({
      id: e.id,
      name: e.name,
      mobile: e.mobile,
      loginId: e.loginId,
      password: '',
      designation: e.designation,
      salary: e.salary ? String(e.salary) : '',
      joinDate: e.joinDate,
      address: e.address,
      photoUrl: e.photoUrl,
      photoFileId: e.photoFileId
    });
    setOldLoginId(e.loginId);
    setPendingPhoto('');
    setShowPass(false);
    setCreated(null);
    setOpen(true);
  };

  const onFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return showToast('Sirf image (JPG / PNG) choose karein.');
    try {
      setPendingPhoto(await compressImage(f));
    } catch (err: any) {
      showToast(err?.message || 'Photo load nahi hui');
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const name = form.name.trim();
    const mobile = form.mobile.trim();
    const loginId = (form.loginId.trim() || mobile.replace(/\D/g, '')).toLowerCase();
    if (!name) return showToast('Employee ka naam likhein.');
    if (mobile.replace(/\D/g, '').length < 10) return showToast('Sahi 10 digit mobile number likhein.');
    if (/\s/.test(loginId)) return showToast('Login ID mein space nahi hona chahiye.');
    if (!form.id && form.password.length < 4) return showToast('Password kam se kam 4 akshar ka rakhein.');
    if (form.id && loginId !== oldLoginId.toLowerCase() && form.password.length < 4) return showToast('Login ID badli hai, to naya password bhi likhein.');
    if (form.password && form.password.length < 4) return showToast('Password kam se kam 4 akshar ka rakhein.');

    setSaving(true);
    let photoUrl = form.photoUrl;
    let photoFileId = form.photoFileId;
    if (pendingPhoto) {
      try {
        const up = await uploadPhotoToDrive({
          photoId: `emp-${Date.now()}`,
          clientId: form.id || 'EMPLOYEE',
          clientName: name,
          title: `${name} profile photo`,
          category: 'Employee',
          date: new Date().toISOString().slice(0, 10),
          dataUrl: pendingPhoto
        });
        photoUrl = up.url;
        photoFileId = up.fileId;
      } catch (err: any) {
        setSaving(false);
        return showToast('Photo Drive par upload nahi hui: ' + (err?.message || 'internet check karein'));
      }
    }

    const ok = await saveEmployee(
      { id: form.id, name, mobile, loginId, designation: form.designation.trim(), salary: Number(form.salary) || 0, joinDate: form.joinDate, address: form.address.trim(), photoUrl, photoFileId, active: 'yes' },
      form.password
    );
    setSaving(false);
    if (ok) {
      showToast(form.id ? 'Employee update ho gaya.' : `Employee "${name}" Google Sheet mein add ho gaya.`);
      if (!form.id) setCreated({ name, loginId, password: form.password });
      setOpen(false);
      setPendingPhoto('');
    }
  };

  const copyCreds = (c: { name: string; loginId: string; password: string }) => {
    const text = `Deepika Studio ERP login\nNaam: ${c.name}\nLogin ID: ${c.loginId}\nPassword: ${c.password}`;
    navigator.clipboard?.writeText(text).then(
      () => showToast('Login details copy ho gayi.'),
      () => showToast(text)
    );
  };

  const preview = pendingPhoto || form.photoUrl;

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={'Employee ki details, login ID + password aur photo – sab yahin. Google Sheet "Employees" tab mein save hota hai.'}
        onBack={onBack}
        right={
          <button onClick={openNew} className={`${btnGold} flex items-center gap-1.5`}>
            <Plus className="h-4 w-4" /> Add Employee
          </button>
        }
      />
      {error && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-300">
          <span>{error}</span>
          <button onClick={reload} className={btnGhost}>
            Retry
          </button>
        </div>
      )}

      {created && (
        <div className="mb-4 rounded-xl border border-emerald-600/50 bg-emerald-950/30 p-4 text-sm text-emerald-100">
          <div className="mb-1 font-bold">✅ {created.name} add ho gaya. Ye login details staff ko de dein:</div>
          <div className="font-mono text-xs">
            Login ID: <b>{created.loginId}</b> &nbsp;|&nbsp; Password: <b>{created.password}</b>
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => copyCreds(created)} className={`${btnGhost} flex items-center gap-1.5`}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            <button onClick={() => setCreated(null)} className={btnGhost}>
              Band karo
            </button>
          </div>
          <p className="mt-2 text-[11px] text-emerald-300/80">Password Sheet mein secure (hash) rakha jata hai, baad mein dikh nahi sakta – isliye abhi note kar lein. Bhool jaye to "Password badlo" se naya set karein.</p>
        </div>
      )}

      {employees.length === 0 && <div className={`${card} p-10 text-center text-sm text-slate-400`}>{loading ? 'Employees load ho rahe hain...' : 'Abhi koi employee nahi hai. "Add Employee" dabakar pehla employee jodein.'}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {employees.map(e => (
          <div key={e.id} className={`${card} p-4`}>
            <div className="flex items-start gap-3">
              {e.photoUrl ? (
                <img src={e.photoUrl} alt={e.name} referrerPolicy="no-referrer" className="h-16 w-16 rounded-xl border border-slate-600 object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-500">
                  <UserRound className="h-7 w-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-bold text-white">{e.name}</div>
                <div className="truncate text-xs text-[#ffd700]">{e.designation || 'Staff'}</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-300">
                  <Phone className="h-3 w-3" /> {e.mobile}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-slate-500">Login ID</div>
                <div className="font-mono font-semibold text-white">{e.loginId}</div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-slate-500">Monthly Salary</div>
                <div className="font-semibold text-white">{e.salary ? money(e.salary) : '-'}</div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-slate-500">Joining</div>
                <div className="font-semibold text-white">{prettyDate(e.joinDate)}</div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2">
                <div className="text-slate-500">Address</div>
                <div className="truncate font-semibold text-white">{e.address || '-'}</div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => openEdit(e)} className={`${btnGhost} flex flex-1 items-center justify-center gap-1.5`}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => {
                  openEdit(e);
                  setShowPass(true);
                }}
                className={`${btnGhost} flex flex-1 items-center justify-center gap-1.5`}
              >
                <KeyRound className="h-3.5 w-3.5" /> Password badlo
              </button>
              <button
                onClick={() => window.confirm(`"${e.name}" ko hatana hai? Wo dobara login nahi kar payega.`) && removeEmployee(e.id)}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit popup */}
      {open && (
        <div className="fixed inset-0 z-[80] flex overflow-y-auto bg-black/80 p-3">
          <form onSubmit={submit} className="m-auto flex max-h-[94vh] w-full max-w-2xl flex-col rounded-2xl border border-[#ffd700]/40 bg-[#0f172a] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-700/50 px-5 py-3">
              <h3 className="text-base font-extrabold text-white">{form.id ? 'Employee Edit' : 'Naya Employee Add Karo'}</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {/* Photo */}
              <div className="flex items-center gap-4">
                {preview ? (
                  <img src={preview} alt="Preview" referrerPolicy="no-referrer" className="h-20 w-20 rounded-xl border border-slate-600 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-600 text-slate-500">
                    <UserRound className="h-8 w-8" />
                  </div>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                  <button type="button" onClick={() => fileRef.current?.click()} className={`${btnGhost} flex items-center gap-1.5`}>
                    <Camera className="h-4 w-4" /> Photo choose karo
                  </button>
                  <p className="mt-1 text-[11px] text-slate-400">Gallery, computer ya Google Drive se chun sakte hain. Save karte hi photo aapke Google Drive folder mein chali jayegi.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Employee Name *</label>
                  <input value={form.name} onChange={e => setF({ name: e.target.value })} placeholder="e.g. Neha Sen" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Mobile No. *</label>
                  <input inputMode="tel" value={form.mobile} onChange={e => setF({ mobile: e.target.value })} placeholder="98XXXXXXXX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Login ID *</label>
                  <input
                    autoCapitalize="none"
                    value={form.loginId}
                    onChange={e => setF({ loginId: e.target.value })}
                    placeholder={form.mobile ? `khali chhodo = ${form.mobile.replace(/\D/g, '')}` : 'e.g. neha ya mobile number'}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Password {form.id ? '(badalna ho to hi likho)' : '*'}</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setF({ password: e.target.value })}
                      placeholder="kam se kam 4 akshar"
                      className={`${inputCls} pr-9 font-mono`}
                    />
                    <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Designation / Role</label>
                  <input value={form.designation} onChange={e => setF({ designation: e.target.value })} placeholder="e.g. Hair Stylist" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Monthly Salary (₹)</label>
                  <input inputMode="numeric" value={form.salary} onChange={e => setF({ salary: e.target.value.replace(/[^\d]/g, '') })} placeholder="e.g. 8000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Joining Date</label>
                  <DateInput value={form.joinDate} onChange={v => setF({ joinDate: v })} />
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <input value={form.address} onChange={e => setF({ address: e.target.value })} placeholder="Gaon / mohalla, shehar" className={inputCls} />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-700/50 px-5 py-3">
              <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={btnGold}>
                {saving ? 'Save ho raha hai...' : form.id ? 'Update Employee' : 'Add Employee'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
