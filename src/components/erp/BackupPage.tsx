import React, { useRef, useState } from 'react';
import { AlertTriangle, CloudUpload, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { driveBackupRemote, getBackupRemote, resetAllRemote, restoreBackupRemote } from '../../lib/drive';
import { useErpData } from './ErpData';
import { card, PageHeader } from './ui';
import { downloadCSV, downloadFile } from './util';

const LAST_KEY = 'erp_last_backup';

const daysAgo = (iso: string | null) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'aaj' : `${d} din pehle`;
};

export const BackupPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { bookingEntries, dailyEntries, refreshLedger, showToast } = useStudio();
  const { expenses, employees, reload } = useErpData();
  const [busy, setBusy] = useState('');
  const [driveInfo, setDriveInfo] = useState<{ name: string; url: string; folderUrl: string } | null>(null);
  const [last, setLast] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_KEY);
    } catch {
      return null;
    }
  });
  const [resetText, setResetText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const markBackup = () => {
    const now = new Date().toISOString();
    setLast(now);
    try {
      localStorage.setItem(LAST_KEY, now);
    } catch {
      /* ignore */
    }
  };

  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

  // 1) Computer mein download (Sheet ka latest data; net na ho to is device ka data)
  const downloadBackup = async () => {
    setBusy('download');
    let data: any;
    try {
      data = await getBackupRemote();
    } catch {
      data = { app: 'Deepika Studio ERP', version: 2, note: 'offline-copy (is device ka data)', createdAt: new Date().toISOString(), bookings: bookingEntries, daily: dailyEntries, expenses, employees };
      showToast('Sheet se connect nahi hua, is device ka data download kiya.');
    }
    downloadFile(`deepika_erp_backup_${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
    markBackup();
    setBusy('');
  };

  // 2) Ek click mein Google Drive mein
  const driveBackup = async () => {
    setBusy('drive');
    try {
      const r = await driveBackupRemote();
      setDriveInfo(r);
      markBackup();
      showToast('Backup Google Drive mein save ho gaya.');
    } catch (err: any) {
      showToast('Drive backup nahi hua: ' + (err?.message || 'internet check karein'));
    }
    setBusy('');
  };

  // 3) Excel / CSV
  const csvAll = () => {
    const head = ['ID', 'Client', 'Mobile', 'Event/Date', 'Package/Service', 'Total', 'Advance/Paid', 'S1 Date', 'S1 Paid', 'S2 Date', 'S2 Paid', 'S3 Date', 'S3 Paid', 'Pending', 'Status', 'Staff'];
    const map = (kind: string, e: any) => [kind + ' ' + e.id, e.clientName, e.mobile, e.eventDate, e.packageName, e.totalAmount, e.advanceAmount, e.s1Date, e.s1Paid, e.s2Date, e.s2Paid, e.s3Date || '', e.s3Paid || '', e.pending, e.status, e.staff || ''];
    downloadCSV(`customers_${stamp()}.csv`, [head, ...bookingEntries.map(e => map('Booking', e)), ...dailyEntries.map(e => map('Daily', e))]);
    downloadCSV(`expenses_${stamp()}.csv`, [
      ['ID', 'Type', 'Date', 'Month', 'Staff / Item', 'Amount', 'Mode', 'Supplier', 'Qty', 'Notes'],
      ...expenses.map(e => [e.id, e.type, e.date, e.month, e.name, e.amount, e.mode, e.vendor, e.qty, e.notes])
    ]);
    markBackup();
  };

  // 4) Restore
  const onRestoreFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const backup = JSON.parse(await f.text());
      if (!Array.isArray(backup.bookings) || !Array.isArray(backup.daily)) throw new Error('Ye Deepika ERP ki backup file nahi lagti.');
      const count = backup.bookings.length + backup.daily.length + (backup.expenses?.length || 0) + (backup.employees?.length || 0);
      if (!window.confirm(`Is file mein ${count} entries hain. Inhe Google Sheet mein wapas daalna hai? (Same ID wali entries update ho jayengi, kuch delete nahi hoga.)`)) return;
      setBusy('restore');
      const n = await restoreBackupRemote(backup);
      await refreshLedger();
      await reload();
      showToast(`${n} entries restore ho gayi.`);
    } catch (err: any) {
      showToast('Restore nahi hua: ' + (err?.message || 'file check karein'));
    }
    setBusy('');
  };

  // 5) Reset
  const doReset = async () => {
    if (resetText.trim().toUpperCase() !== 'RESET') return showToast('Reset ke liye box mein RESET likhein.');
    if (!window.confirm('Pakka? Bookings, Daily Customers aur Expenses saaf ho jayenge. (Pehle Drive mein automatic backup ban jayega; Employees safe rahenge.)')) return;
    setBusy('reset');
    try {
      const url = await resetAllRemote();
      await refreshLedger();
      await reload();
      setResetText('');
      showToast('ERP reset ho gaya. Purana backup Drive mein safe hai.');
      if (url) setDriveInfo({ name: 'reset se pehle ka backup', url, folderUrl: url });
    } catch (err: any) {
      showToast('Reset nahi hua: ' + (err?.message || 'internet check karein'));
    }
    setBusy('');
  };

  const ago = daysAgo(last);
  const stale = !last || Date.now() - new Date(last).getTime() > 7 * 86400000;

  const big = `${card} p-5 text-left transition hover:border-[#ffd700]/60 disabled:opacity-60 cursor-pointer`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Backup Center" subtitle="Aapka saara data Google Sheet mein hai. Yahan se uski extra copy rakho." onBack={onBack} />

      <div className={`mb-4 rounded-xl border p-3 text-xs ${stale ? 'border-amber-600/50 bg-amber-950/30 text-amber-200' : 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200'}`}>
        {last ? (
          <>
            Last backup: <b>{ago}</b>. {stale && 'Hafte mein ek baar backup lena achha rehta hai.'}
          </>
        ) : (
          <>Abhi tak koi backup nahi liya. Neeche "Google Drive mein Backup" dabayein – bas ek click.</>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button onClick={driveBackup} disabled={!!busy} className={`${big} sm:col-span-2 !border-[#ffd700]/50`}>
          <CloudUpload className="mb-2 h-6 w-6 text-[#ffd700]" />
          <div className="text-sm font-bold text-white">{busy === 'drive' ? 'Backup ban raha hai...' : 'Google Drive mein Backup (ek click)'}</div>
          <div className="text-xs text-slate-400">Pura data (Bookings, Customers, Expenses, Employees) aapke Drive ke "Deepika ERP Backups" folder mein save hoga. Sabse aasaan tareeka.</div>
        </button>

        <button onClick={downloadBackup} disabled={!!busy} className={big}>
          <Download className="mb-2 h-6 w-6 text-indigo-400" />
          <div className="text-sm font-bold text-white">{busy === 'download' ? 'Ban raha hai...' : 'Computer / Phone mein Download'}</div>
          <div className="text-xs text-slate-400">Ek .json file download hogi (restore ke kaam aati hai).</div>
        </button>

        <button onClick={csvAll} disabled={!!busy} className={big}>
          <FileSpreadsheet className="mb-2 h-6 w-6 text-emerald-400" />
          <div className="text-sm font-bold text-white">Excel (CSV) Download</div>
          <div className="text-xs text-slate-400">Customers aur Expenses ki alag-alag Excel files.</div>
        </button>

        <button onClick={() => fileRef.current?.click()} disabled={!!busy} className={`${big} sm:col-span-2`}>
          <Upload className="mb-2 h-6 w-6 text-sky-400" />
          <div className="text-sm font-bold text-white">{busy === 'restore' ? 'Restore ho raha hai...' : 'Backup se Restore (Import)'}</div>
          <div className="text-xs text-slate-400">Pehle download ki hui .json file chuno. Kuch delete nahi hota – sirf entries wapas judti / update hoti hain.</div>
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onRestoreFile} className="hidden" />
      </div>

      {driveInfo && (
        <div className="mt-4 rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-3 text-xs text-emerald-100">
          ✅ Drive mein save: <b>{driveInfo.name}</b> ·{' '}
          <a href={driveInfo.url} target="_blank" rel="noreferrer" className="underline">
            File kholo
          </a>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-rose-800/60 bg-rose-950/20 p-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-rose-400">
          <AlertTriangle className="h-4 w-4" /> Danger Zone – Reset ERP
        </div>
        <p className="mb-3 text-xs text-slate-400">Bookings, Daily Customers aur Expenses saaf ho jayenge (Employees nahi). Reset se pehle Drive mein apne aap backup ban jata hai.</p>
        <div className="flex flex-wrap gap-2">
          <input value={resetText} onChange={e => setResetText(e.target.value)} placeholder='Yahan "RESET" likhein' className="w-48 rounded-lg border border-rose-900 bg-[#0b1120] px-3 py-2 text-xs text-white focus:outline-none" />
          <button onClick={doReset} disabled={!!busy} className="rounded-lg border border-rose-600 bg-rose-600/20 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-600/30 cursor-pointer disabled:opacity-60">
            {busy === 'reset' ? 'Reset ho raha hai...' : 'Reset ERP'}
          </button>
        </div>
      </div>
    </div>
  );
};
