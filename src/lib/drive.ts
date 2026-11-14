/**
 * Google Apps Script (Drive + Sheets) API helpers.
 * Sab calls "text/plain" POST se hoti hain taaki browser CORS preflight na maange.
 */
import { GOOGLE_APPS_SCRIPT_URL, DRIVE_UPLOAD_KEY, MAX_IMAGE_SIDE_PX, IMAGE_QUALITY } from '../config';

export interface DrivePhotoRow {
  photoId: string;
  clientId: string;
  clientName: string;
  title: string;
  category: string;
  date: string;
  fileId: string;
  url: string;
}

interface ApiResponse {
  status: 'success' | 'error';
  message?: string;
  [key: string]: any;
}

async function post(payload: Record<string, unknown>): Promise<ApiResponse> {
  const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, key: DRIVE_UPLOAD_KEY })
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}

/** Image file ko resize + JPEG mein convert karke base64 (data URL) deta hai. */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File padh nahi paye'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ye image file valid nahi hai'));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_SIDE_PX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas available nahi'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadPhotoToDrive(args: {
  photoId: string;
  clientId: string;
  clientName: string;
  title: string;
  category: string;
  date: string;
  dataUrl: string;
}): Promise<{ fileId: string; url: string }> {
  const data = await post({
    action: 'uploadPhoto',
    ...args,
    fileName: `${args.clientName.replace(/[^\w]+/g, '_')}_${args.photoId}.jpg`,
    mimeType: 'image/jpeg',
    base64Content: args.dataUrl
  });
  if (data.status !== 'success') throw new Error(data.message || 'Upload fail ho gaya');
  return { fileId: data.fileId, url: data.url };
}

export async function deletePhotoFromDrive(photoId: string, fileId?: string): Promise<void> {
  const data = await post({ action: 'deletePhoto', photoId, fileId });
  if (data.status !== 'success') throw new Error(data.message || 'Delete fail ho gaya');
}

export async function fetchPhotosFromDrive(): Promise<DrivePhotoRow[]> {
  const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getPhotos&key=${encodeURIComponent(DRIVE_UPLOAD_KEY)}`);
  const data: ApiResponse = await res.json();
  if (data.status !== 'success') throw new Error(data.message || 'Photos load nahi hui');
  return data.photos as DrivePhotoRow[];
}

import type { LedgerEntry, LedgerKind } from '../types';

/** Google Sheet se Bookings + Daily Customers dono ki list laata hai */
export async function fetchLedger(): Promise<{ bookings: LedgerEntry[]; daily: LedgerEntry[] }> {
  const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getLedger&key=${encodeURIComponent(DRIVE_UPLOAD_KEY)}`);
  const data: ApiResponse = await res.json();
  if (data.status !== 'success') throw new Error(data.message || 'Sheet se data nahi aaya');
  return { bookings: data.bookings as LedgerEntry[], daily: data.daily as LedgerEntry[] };
}

/** Entry save/update. Naya ho to server final ID bata deta hai (duplicate se bachne ke liye). */
export async function saveLedgerEntry(kind: LedgerKind, entry: LedgerEntry, isNew: boolean): Promise<string> {
  const { synced, ...clean } = entry;
  const data = await post({ action: 'saveEntry', kind, isNew, entry: clean });
  if (data.status !== 'success') throw new Error(data.message || 'Sheet mein save nahi hua');
  return data.id as string;
}

export async function deleteLedgerEntry(kind: LedgerKind, id: string): Promise<void> {
  const data = await post({ action: 'deleteEntry', kind, id });
  if (data.status !== 'success') throw new Error(data.message || 'Sheet se delete nahi hua');
}

/* ---------------- Staff logins (Google Sheet ke "Staff" tab se) ---------------- */
export interface StaffAccount {
  loginId: string;
  name: string;
  createdAt: string;
}

export async function staffLoginRemote(loginId: string, password: string): Promise<{ loginId: string; name: string }> {
  const data = await post({ action: 'staffLogin', loginId, password });
  if (data.status !== 'success') throw new Error(data.message || 'Login ID ya password galat hai');
  return { loginId: data.loginId, name: data.name };
}

export async function fetchStaff(): Promise<StaffAccount[]> {
  const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=listStaff&key=${encodeURIComponent(DRIVE_UPLOAD_KEY)}`);
  const data: ApiResponse = await res.json();
  if (data.status !== 'success') throw new Error(data.message || 'Staff list nahi aayi');
  return data.staff as StaffAccount[];
}

export async function addStaffRemote(name: string, loginId: string, password: string): Promise<void> {
  const data = await post({ action: 'addStaff', name, loginId, password });
  if (data.status !== 'success') throw new Error(data.message || 'Staff add nahi hua');
}

export async function setStaffPasswordRemote(loginId: string, password: string): Promise<void> {
  const data = await post({ action: 'setStaffPassword', loginId, password });
  if (data.status !== 'success') throw new Error(data.message || 'Password change nahi hua');
}

export async function removeStaffRemote(loginId: string): Promise<void> {
  const data = await post({ action: 'removeStaff', loginId });
  if (data.status !== 'success') throw new Error(data.message || 'Staff remove nahi hua');
}

/* ---------------- Employees, Expenses, Backup ---------------- */
import type { ErpEmployee, ErpExpense } from '../types';

export async function fetchEmployeesRemote(): Promise<ErpEmployee[]> {
  const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=listEmployees&key=${encodeURIComponent(DRIVE_UPLOAD_KEY)}`);
  const data: ApiResponse = await res.json();
  if (data.status !== 'success') throw new Error(data.message || 'Employees list nahi aayi');
  return data.employees as ErpEmployee[];
}

export async function saveEmployeeRemote(entry: Partial<ErpEmployee>, password?: string): Promise<string> {
  const data = await post({ action: 'saveEmployee', entry, password: password || '' });
  if (data.status !== 'success') throw new Error(data.message || 'Employee save nahi hua');
  return data.id as string;
}

export async function deleteEmployeeRemote(id: string): Promise<void> {
  const data = await post({ action: 'deleteEmployee', id });
  if (data.status !== 'success') throw new Error(data.message || 'Employee delete nahi hua');
}

export async function fetchExpensesRemote(): Promise<ErpExpense[]> {
  const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getExpenses&key=${encodeURIComponent(DRIVE_UPLOAD_KEY)}`);
  const data: ApiResponse = await res.json();
  if (data.status !== 'success') throw new Error(data.message || 'Expenses nahi aaye');
  return data.expenses as ErpExpense[];
}

export async function saveExpenseRemote(entry: ErpExpense): Promise<string> {
  const data = await post({ action: 'saveExpense', entry });
  if (data.status !== 'success') throw new Error(data.message || 'Expense save nahi hua');
  return data.id as string;
}

export async function deleteExpenseRemote(id: string): Promise<void> {
  const data = await post({ action: 'deleteExpense', id });
  if (data.status !== 'success') throw new Error(data.message || 'Expense delete nahi hua');
}

export async function getBackupRemote(): Promise<any> {
  const data = await post({ action: 'getBackup' });
  if (data.status !== 'success') throw new Error(data.message || 'Backup nahi bana');
  return data.backup;
}

export async function driveBackupRemote(): Promise<{ name: string; url: string; folderUrl: string }> {
  const data = await post({ action: 'driveBackup' });
  if (data.status !== 'success') throw new Error(data.message || 'Drive backup nahi hua');
  return { name: data.name, url: data.url, folderUrl: data.folderUrl };
}

export async function restoreBackupRemote(backup: any): Promise<number> {
  const data = await post({ action: 'restoreBackup', backup });
  if (data.status !== 'success') throw new Error(data.message || 'Restore nahi hua');
  return data.restored as number;
}

export async function resetAllRemote(): Promise<string> {
  const data = await post({ action: 'resetAll' });
  if (data.status !== 'success') throw new Error(data.message || 'Reset nahi hua');
  return data.backupUrl as string;
}
