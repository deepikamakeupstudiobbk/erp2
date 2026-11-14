import { LedgerEntry } from '../types';

export const LEDGER_STATUSES = ['Payment Pending', 'Completed'] as const;

/** Purane sheet ke status (Confirmed / In Progress / Cancelled...) ko bhi sirf 2 status mein badalta hai */
export const normalizeLedgerStatus = (s?: string): 'Payment Pending' | 'Completed' =>
  String(s || '').trim().toLowerCase() === 'completed' ? 'Completed' : 'Payment Pending';

export const ledgerPaid = (e: Pick<LedgerEntry, 'advanceAmount' | 's1Paid' | 's2Paid' | 's3Paid'>) =>
  (Number(e.advanceAmount) || 0) + (Number(e.s1Paid) || 0) + (Number(e.s2Paid) || 0) + (Number(e.s3Paid) || 0);

export const ledgerPending = (e: Pick<LedgerEntry, 'totalAmount' | 'advanceAmount' | 's1Paid' | 's2Paid' | 's3Paid'>) =>
  Math.max(0, (Number(e.totalAmount) || 0) - ledgerPaid(e));

/** Package ke naam ka pehla akshar (A-Z). "Bridal Makeup" -> B, "party look" -> P */
export function packagePrefix(packageName: string): string {
  const m = (packageName || '').match(/[A-Za-z]/);
  return m ? m[0].toUpperCase() : 'X';
}

/** Naya ID: pehla akshar + agla number (B-001, B-002...). Daily customers ke liye "D-" lagta hai (D-B-001). */
export function nextLedgerId(kind: 'booking' | 'daily', packageName: string, existingIds: string[]): string {
  const prefix = (kind === 'daily' ? 'D-' : '') + packagePrefix(packageName);
  let max = 0;
  existingIds.forEach(id => {
    if (id.startsWith(prefix + '-')) {
      const n = parseInt(id.slice(prefix.length + 1), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
