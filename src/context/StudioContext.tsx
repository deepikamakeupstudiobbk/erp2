import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  ServiceItem,
  Booking,
  Lead,
  Employee,
  ClientProfile,
  FinancialExpense,
  ChatMessage,
  PushNotificationItem,
  UserSession,
  ClientPhoto,
  OwnerCredentials,
  PaymentStatus,
  ShiftAttendanceRecord,
  LedgerEntry,
  LedgerInput,
  LedgerKind
} from '../types';
import {
  INITIAL_SERVICES,
  INITIAL_EMPLOYEES,
  INITIAL_BOOKINGS,
  INITIAL_LEADS,
  INITIAL_CLIENTS,
  INITIAL_EXPENSES,
  INITIAL_CHAT,
  INITIAL_NOTIFICATIONS,
  INITIAL_ATTENDANCE
} from '../data/initialData';
import {
  compressImage,
  uploadPhotoToDrive,
  deletePhotoFromDrive,
  fetchPhotosFromDrive,
  fetchLedger,
  saveLedgerEntry,
  deleteLedgerEntry as deleteLedgerEntryRemote,
  staffLoginRemote,
  fetchStaff,
  addStaffRemote,
  setStaffPasswordRemote,
  removeStaffRemote,
  StaffAccount
} from '../lib/drive';
import { ledgerPaid, ledgerPending, nextLedgerId, normalizeLedgerStatus } from '../lib/ledger';
import { STUDIO_INFO } from '../data/initialData';

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

// localStorage se safe load (corrupt data par app crash nahi hoga)
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked - ignore */
  }
}

const cleanPhone = (p: string) => (p || '').replace(/[^0-9]/g, '').slice(-10);
const todayISO = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\ufeff' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCSV(rows: (string | number | undefined)[][]): string {
  return rows
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

const calcPaymentStatus = (total: number, paid: number): PaymentStatus =>
  paid >= total ? 'fully_paid' : paid > 0 ? 'partially_paid' : 'pending';

// Naye ledger entry ko purane "Booking" shape mein badalte hain, taaki analytics / notifications chalte rahein
const STATUS_MAP: Record<string, Booking['bookingStatus']> = {
  'Payment Pending': 'confirmed',
  Completed: 'completed'
};
const entryToBooking = (e: LedgerEntry, kind: LedgerKind): Booking => {
  const paid = ledgerPaid(e);
  return {
    id: e.id,
    clientName: e.clientName,
    phone: e.mobile,
    email: '',
    serviceId: kind,
    serviceName: e.packageName,
    date: e.eventDate,
    timeSlot: '',
    artistId: 'emp-1',
    artistName: 'Deepika Sharma',
    locationType: 'studio',
    totalAmount: e.totalAmount,
    advancePaid: paid,
    balanceDue: ledgerPending(e),
    paymentStatus: calcPaymentStatus(e.totalAmount, paid),
    bookingStatus: STATUS_MAP[normalizeLedgerStatus(e.status)],
    paymentMethod: 'cash',
    transactionId: '',
    createdAt: e.createdAt,
    partPayments: []
  };
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface GDriveSyncState {
  lastSyncedAt: string;
  syncedFilesCount: number;
  status: 'idle' | 'syncing' | 'synced' | 'error';
  backupVersion: string;
}

interface StudioContextType {
  session: UserSession;
  ownerCredentials: OwnerCredentials;
  loginAsOwner: (password?: string, usernameOrEmail?: string) => boolean;
  loginAsEmployee: (loginId: string, password: string) => Promise<boolean>;
  logoutToGuest: () => void;
  updateOwnerCredentials: (newUsername: string, newEmail: string, newPassword?: string) => boolean;
  updateEmployeeCredentials: (employeeId: string, newEmail: string, newPassword: string) => boolean;

  services: ServiceItem[];
  bookings: Booking[];
  leads: Lead[];
  employees: Employee[];
  clients: ClientProfile[];
  expenses: FinancialExpense[];
  chatMessages: ChatMessage[];
  notifications: PushNotificationItem[];
  gdriveSync: GDriveSyncState;

  /** Bookings + Daily Customers ki sheets (Google Sheet se sync) */
  bookingEntries: LedgerEntry[];
  dailyEntries: LedgerEntry[];
  ledgerPackages: string[];
  previewLedgerId: (kind: LedgerKind, packageName: string) => string;
  addLedgerEntry: (kind: LedgerKind, data: LedgerInput) => Promise<LedgerEntry | null>;
  updateLedgerEntry: (kind: LedgerKind, entry: LedgerEntry) => Promise<boolean>;
  deleteLedgerEntry: (kind: LedgerKind, id: string) => boolean;
  refreshLedger: (silent?: boolean) => Promise<void>;
  isLedgerSyncing: boolean;
  canEditDaily: boolean;

  /** Staff logins (Google Sheet ke "Staff" tab mein) - sirf Owner manage karta hai */
  staffAccounts: StaffAccount[];
  isStaffLoading: boolean;
  refreshStaff: () => Promise<void>;
  addStaff: (name: string, loginId: string, password: string) => Promise<boolean>;
  changeStaffPassword: (loginId: string, newPassword: string) => Promise<boolean>;
  removeStaff: (loginId: string) => Promise<boolean>;

  addLead: (leadData: Omit<Lead, 'id' | 'createdAt' | 'status'>) => Lead;
  updateLeadStatus: (id: string, status: Lead['status'], notes?: string) => void;

  addEmployee: (empData: Omit<Employee, 'id'>) => Employee | null;
  deleteEmployee: (employeeId: string, bypassRoleCheck?: boolean) => boolean;
  updateEmployeePermissions: (employeeId: string, permissions: Employee['permissions']) => void;
  updateEmployeeDetails: (employeeId: string, updates: Partial<Employee>) => void;

  /** Photo ko Google Drive folder mein upload karta hai. true = success */
  addClientPhoto: (clientId: string, photo: Omit<ClientPhoto, 'id'>) => Promise<boolean>;
  deleteClientPhoto: (clientId: string, photoId: string) => boolean;
  updateClientNotes: (clientId: string, notes: string) => void;
  isUploadingPhoto: boolean;
  syncPhotosFromDrive: (silent?: boolean) => Promise<void>;

  addExpense: (expense: Omit<FinancialExpense, 'id'>) => void;
  deleteExpense: (id: string) => void;

  sendChatMessage: (text: string, sender?: 'client' | 'studio') => void;
  sendPushNotification: (notification: Omit<PushNotificationItem, 'id' | 'sentAt' | 'status'>) => void;

  attendanceRecords: ShiftAttendanceRecord[];
  clockInEmployee: (employeeId: string, station?: string, notes?: string) => void;
  clockOutEmployee: (recordId: string, notes?: string) => void;
  toggleEmployeeBreak: (recordId: string) => void;
  exportAttendanceCSV: (weekOnly?: boolean) => void;

  triggerGDriveSync: () => Promise<void>;
  exportBackupJSON: () => void;
  exportClientReportCSV: () => void;
  exportLeadsReportCSV: (statusFilter?: string) => void;

  /** Website ke "Book" buttons: WhatsApp par studio se baat shuru karte hain */
  openBookingModal: (preselectedServiceId?: string) => void;

  isLeadModalOpen: boolean;
  openLeadModal: () => void;
  closeLeadModal: () => void;

  isERPModalOpen: boolean;
  openERPModal: () => void;
  closeERPModal: () => void;

  isNotificationsModalOpen: boolean;
  openNotificationsModal: () => void;
  closeNotificationsModal: () => void;

  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const GUEST_SESSION: UserSession = { role: 'client', name: 'Visiting Client', email: '' };

// Session ke liye keys. ERP khula tha ya nahi, ye sessionStorage mein rakhte hain
// taaki refresh karne par ERP wapas wahi khule (login se bahar na jaye).
const SESSION_KEY = 'deepika_studio_session';
const ERP_OPEN_KEY = 'deepika_erp_open';

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession>(() => {
    const s = load<UserSession | null>(SESSION_KEY, null);
    return s && (s.role === 'owner' || s.role === 'employee' || s.role === 'client') ? s : GUEST_SESSION;
  });

  const [ownerCredentials, setOwnerCredentials] = useState<OwnerCredentials>(() =>
    load<OwnerCredentials>('deepika_owner_creds', {
      username: 'admin',
      email: 'engdksmegasoft@gmail.com',
      password: 'admin',
      updatedAt: '2026-10-30T00:00:00.000Z'
    })
  );

  const [services] = useState<ServiceItem[]>(INITIAL_SERVICES);
  const [bookingEntries, setBookingEntries] = useState<LedgerEntry[]>(() => load('deepika_ledger_bookings', []));
  const [dailyEntries, setDailyEntries] = useState<LedgerEntry[]>(() => load('deepika_ledger_daily', []));
  const [isLedgerSyncing, setIsLedgerSyncing] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(() => load('deepika_studio_leads', INITIAL_LEADS));
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = load<Employee[] | null>('deepika_studio_employees', null);
    if (saved) {
      return saved.map(emp => ({
        ...emp,
        password: emp.password || emp.pin || 'staff@123',
        pin: emp.pin || emp.password || '1234'
      }));
    }
    return INITIAL_EMPLOYEES;
  });
  const [clients, setClients] = useState<ClientProfile[]>(() => load('deepika_studio_clients', INITIAL_CLIENTS));
  const [expenses, setExpenses] = useState<FinancialExpense[]>(() => load('deepika_studio_expenses', INITIAL_EXPENSES));
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => load('deepika_studio_chat', INITIAL_CHAT));
  const [notifications, setNotifications] = useState<PushNotificationItem[]>(() =>
    load('deepika_studio_notifs', INITIAL_NOTIFICATIONS)
  );
  const [attendanceRecords, setAttendanceRecords] = useState<ShiftAttendanceRecord[]>(() =>
    load('deepika_studio_attendance', INITIAL_ATTENDANCE)
  );
  const [gdriveSync, setGdriveSync] = useState<GDriveSyncState>(() =>
    load('deepika_gdrive_sync_v2', {
      lastSyncedAt: 'Not synced yet',
      syncedFilesCount: 0,
      status: 'idle',
      backupVersion: 'v3.0-bbk-gdrive'
    })
  );

  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isERPModalOpen, setIsERPModalOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ERP_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  /* ---------- Persistence: har badlav localStorage mein save ---------- */
  useEffect(() => save(SESSION_KEY, session), [session]);
  useEffect(() => save('deepika_owner_creds', ownerCredentials), [ownerCredentials]);
  useEffect(() => save('deepika_ledger_bookings', bookingEntries), [bookingEntries]);
  useEffect(() => save('deepika_ledger_daily', dailyEntries), [dailyEntries]);
  useEffect(() => save('deepika_studio_leads', leads), [leads]);
  useEffect(() => save('deepika_studio_employees', employees), [employees]);
  useEffect(() => save('deepika_studio_clients', clients), [clients]);
  useEffect(() => save('deepika_studio_expenses', expenses), [expenses]);
  useEffect(() => save('deepika_studio_chat', chatMessages), [chatMessages]);
  useEffect(() => save('deepika_studio_notifs', notifications), [notifications]);
  useEffect(() => save('deepika_studio_attendance', attendanceRecords), [attendanceRecords]);
  useEffect(() => save('deepika_gdrive_sync_v2', gdriveSync), [gdriveSync]);
  useEffect(() => {
    try {
      sessionStorage.setItem(ERP_OPEN_KEY, isERPModalOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [isERPModalOpen]);

  /* ---------- Modals ---------- */
  const openBookingModal = (serviceId?: string) => {
    const svc = services.find(x => x.id === serviceId);
    const text = svc
      ? `Namaste! Mujhe "${svc.title}" ke liye booking karni hai. Kripya details batayein.`
      : 'Namaste! Mujhe makeup booking ke baare mein jaankari chahiye.';
    window.open(`https://wa.me/${STUDIO_INFO.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const openLeadModal = () => setIsLeadModalOpen(true);
  const closeLeadModal = () => setIsLeadModalOpen(false);
  const openERPModal = () => setIsERPModalOpen(true);
  const closeERPModal = () => setIsERPModalOpen(false);
  const openNotificationsModal = () => setIsNotificationsModalOpen(true);
  const closeNotificationsModal = () => setIsNotificationsModalOpen(false);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(prev => (prev === msg ? null : prev)), 4000);
  }, []);

  /* ---------- Auth ---------- */
  const loginAsOwner = (password?: string, usernameOrEmail?: string): boolean => {
    const pass = (password || '').trim();
    const user = (usernameOrEmail || '').trim().toLowerCase();

    const isUserMatch =
      !!user &&
      (user === ownerCredentials.username.toLowerCase() || user === ownerCredentials.email.toLowerCase());
    const isPassMatch = !!pass && pass === ownerCredentials.password;

    if (!isUserMatch || !isPassMatch) {
      showToast('Login failed: Owner username ya password galat hai');
      return false;
    }

    setSession({
      role: 'owner',
      name: 'Deepika Sharma (Owner & Master Artist)',
      email: ownerCredentials.email
    });
    showToast('Owner login ho gaya. Full ERP access active.');
    return true;
  };

  // Staff login Google Sheet ke "Staff" tab se check hota hai (kisi bhi phone / computer se chalega)
  const loginAsEmployee = async (loginId: string, password: string): Promise<boolean> => {
    if (!loginId.trim() || !password) {
      showToast('Login ID aur password dono likhein.');
      return false;
    }
    try {
      const res = await staffLoginRemote(loginId.trim().toLowerCase(), password);
      setSession({ role: 'employee', employeeId: res.loginId, name: res.name, email: res.loginId });
      showToast(`Staff login ho gaya: ${res.name}`);
      return true;
    } catch (err: any) {
      showToast('Staff login fail: ' + (err?.message || 'internet check karein'));
      return false;
    }
  };

  const logoutToGuest = () => {
    setSession(GUEST_SESSION);
    showToast('ERP se logout ho gaya.');
  };

  const updateOwnerCredentials = (newUsername: string, newEmail: string, newPassword?: string): boolean => {
    if (session.role !== 'owner') {
      showToast('Sirf Owner credentials badal sakta hai.');
      return false;
    }
    if (!newUsername.trim() || !newEmail.trim()) {
      showToast('Username aur email khali nahi ho sakte.');
      return false;
    }
    setOwnerCredentials(prev => ({
      username: newUsername.trim(),
      email: newEmail.trim(),
      password: newPassword && newPassword.trim() ? newPassword.trim() : prev.password,
      updatedAt: new Date().toISOString()
    }));
    setSession(prev => ({ ...prev, email: newEmail.trim() }));
    showToast('Owner credentials update ho gaye.');
    return true;
  };

  const updateEmployeeCredentials = (employeeId: string, newEmail: string, newPassword: string): boolean => {
    if (session.role !== 'owner') {
      showToast('Sirf Owner staff credentials badal sakta hai.');
      return false;
    }
    setEmployees(prev =>
      prev.map(e =>
        e.id === employeeId
          ? { ...e, email: newEmail.trim() || e.email, password: newPassword || e.password, pin: newPassword || e.pin }
          : e
      )
    );
    showToast('Staff credentials update ho gaye.');
    return true;
  };

  /* ---------- Bookings & Daily Customers (Google Sheet = asli data) ---------- */
  // Daily Customers sheet sirf Owner ke paas. Bookings: Owner aur Staff dono add/update kar sakte hain.
  const canEditDaily = session.role === 'owner' || session.role === 'employee';
  const canEditBookings = session.role === 'owner' || session.role === 'employee';

  // Package naam khud likha jata hai; ye list sirf suggestion ke liye hai
  const ledgerPackages = services.map(sv => sv.title);

  const setterFor = (kind: LedgerKind) => (kind === 'daily' ? setDailyEntries : setBookingEntries);
  const listFor = (kind: LedgerKind) => (kind === 'daily' ? dailyEntries : bookingEntries);

  const previewLedgerId = (kind: LedgerKind, packageName: string) =>
    nextLedgerId(kind, packageName, listFor(kind).map(e => e.id));

  // Google Sheet mein save; fail ho to synced=false rehta hai aur agle refresh par dobara try hota hai
  const persistEntry = async (kind: LedgerKind, entry: LedgerEntry, isNew: boolean): Promise<boolean> => {
    const setList = setterFor(kind);
    try {
      const finalId = await saveLedgerEntry(kind, entry, isNew);
      setList(prev => prev.map(e => (e.id === entry.id ? { ...e, id: finalId, synced: true } : e)));
      return true;
    } catch (err: any) {
      setList(prev => prev.map(e => (e.id === entry.id ? { ...e, synced: false } : e)));
      showToast('Entry yahan save hui, par Google Sheet mein nahi gayi: ' + (err?.message || 'internet check karein'));
      return false;
    }
  };

  const addLedgerEntry = async (kind: LedgerKind, data: LedgerInput): Promise<LedgerEntry | null> => {
    if (kind === 'booking' && !canEditBookings) {
      showToast('Pehle login karein.');
      return null;
    }
    if (kind === 'daily' && !canEditDaily) {
      showToast('Pehle login karein.');
      return null;
    }
    const today = todayISO();
    const entry: LedgerEntry = {
      ...data,
      id: previewLedgerId(kind, data.packageName),
      pending: ledgerPending(data),
      createdAt: today,
      updatedAt: today,
      createdBy: session.name,
      synced: false
    };
    setterFor(kind)(prev => [entry, ...prev]);

    // Client profile (Photo Vault ke liye) - mobile se match, nahi mila to naya
    setClients(prev => {
      const key = cleanPhone(entry.mobile);
      if (prev.some(c => cleanPhone(c.phone) === key)) return prev;
      return [
        {
          id: `CL-${Date.now().toString().slice(-7)}`,
          name: entry.clientName,
          phone: entry.mobile,
          email: '',
          clientType: 'first_time',
          totalBookings: 1,
          totalSpent: 0,
          skinType: 'To be assessed',
          undertone: 'To be assessed',
          allergies: 'None noted',
          lastVisit: entry.eventDate || today,
          notes: '',
          photos: []
        },
        ...prev
      ];
    });

    const ok = await persistEntry(kind, entry, true);
    if (ok) showToast(`Entry ${entry.clientName} Google Sheet mein save ho gayi.`);
    return entry;
  };

  const updateLedgerEntry = async (kind: LedgerKind, entry: LedgerEntry): Promise<boolean> => {
    if (kind === 'booking' && !canEditBookings) {
      showToast('Pehle login karein.');
      return false;
    }
    if (kind === 'daily' && !canEditDaily) {
      showToast('Pehle login karein.');
      return false;
    }
    const updated: LedgerEntry = { ...entry, pending: ledgerPending(entry), updatedAt: todayISO(), synced: false };
    setterFor(kind)(prev => prev.map(e => (e.id === entry.id ? updated : e)));
    const ok = await persistEntry(kind, updated, false);
    if (ok) showToast(`Entry ${entry.id} update ho gayi.`);
    return ok;
  };

  // Delete: sirf Owner (Employee kabhi delete nahi kar sakta)
  const deleteLedgerEntry = (kind: LedgerKind, id: string): boolean => {
    if (session.role !== 'owner') {
      showToast('Delete ka haq sirf Owner ke paas hai.');
      return false;
    }
    setterFor(kind)(prev => prev.filter(e => e.id !== id));
    deleteLedgerEntryRemote(kind, id).catch(() =>
      showToast('Yahan se hata di, par Sheet se delete nahi hui. Refresh karke dekhein.')
    );
    showToast(`Entry ${id} delete ho gayi.`);
    return true;
  };

  // Sheet se taaza data laao (admin aur employee alag device par ho to bhi dono ko same dikhega)
  const ledgerInFlight = useRef(false);
  const refreshLedger = useCallback(
    async (silent = false) => {
      if (ledgerInFlight.current) return;
      ledgerInFlight.current = true;
      if (!silent) setIsLedgerSyncing(true);
      try {
        const remote = await fetchLedger();
        const merge = (rem: LedgerEntry[], local: LedgerEntry[], kind: LedgerKind) => {
          const unsynced = local.filter(e => e.synced === false);
          const rest = rem.filter(r => !unsynced.some(u => u.id === r.id)).map(r => ({ ...r, synced: true }));
          unsynced.forEach(u => persistEntry(kind, u, false)); // dobara bhejne ki koshish
          return [...unsynced, ...rest].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1));
        };
        setBookingEntries(prev => merge(remote.bookings, prev, 'booking'));
        setDailyEntries(prev => merge(remote.daily, prev, 'daily'));
        if (!silent) showToast('Google Sheet se taaza data aa gaya.');
      } catch (err: any) {
        if (!silent) showToast('Sheet se data nahi aaya: ' + (err?.message || 'Script / internet check karein'));
      } finally {
        ledgerInFlight.current = false;
        setIsLedgerSyncing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showToast]
  );

  /* ---------- Staff accounts (Owner manage karta hai) ---------- */
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);

  const refreshStaff = useCallback(async () => {
    setIsStaffLoading(true);
    try {
      setStaffAccounts(await fetchStaff());
    } catch (err: any) {
      showToast('Staff list nahi aayi: ' + (err?.message || 'Script / internet check karein'));
    } finally {
      setIsStaffLoading(false);
    }
  }, [showToast]);

  const addStaff = async (name: string, loginId: string, password: string): Promise<boolean> => {
    if (session.role !== 'owner') return false;
    try {
      await addStaffRemote(name.trim(), loginId.trim().toLowerCase(), password);
      showToast(`Staff "${name.trim()}" add ho gaya. Ab wo apni ID se login kar sakta hai.`);
      await refreshStaff();
      return true;
    } catch (err: any) {
      showToast(err?.message || 'Staff add nahi hua');
      return false;
    }
  };

  const changeStaffPassword = async (loginId: string, newPassword: string): Promise<boolean> => {
    if (session.role !== 'owner') return false;
    try {
      await setStaffPasswordRemote(loginId, newPassword);
      showToast('Password badal diya gaya.');
      return true;
    } catch (err: any) {
      showToast(err?.message || 'Password change nahi hua');
      return false;
    }
  };

  const removeStaff = async (loginId: string): Promise<boolean> => {
    if (session.role !== 'owner') return false;
    try {
      await removeStaffRemote(loginId);
      showToast('Staff ID hata di gayi.');
      await refreshStaff();
      return true;
    } catch (err: any) {
      showToast(err?.message || 'Staff remove nahi hua');
      return false;
    }
  };

  // Login ke baad turant aur phir har 45 second mein sync (jab tak ERP khula ho)
  useEffect(() => {
    if (session.role === 'client') return;

    const tick = async () => {
      refreshLedger(true);
      // Owner ne staff ID hata di ho to uska login apne aap band
      if (session.role === 'employee') {
        try {
          const list = await fetchStaff();
          if (!list.some(x => x.loginId === session.employeeId)) {
            setSession(GUEST_SESSION);
            showToast('Aapki staff ID hata di gayi hai.');
          }
        } catch {
          /* offline - kuch nahi karna */
        }
      }
    };

    tick();
    if (session.role === 'owner') refreshStaff();
    if (!isERPModalOpen) return;
    const t = setInterval(tick, 45000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.role, session.employeeId, isERPModalOpen, refreshLedger]);

  // Analytics / notifications purane "bookings" format se chalte hain, isliye yahan derive karte hain
  const bookings: Booking[] = [
    ...bookingEntries.map(e => entryToBooking(e, 'booking')),
    ...dailyEntries.map(e => entryToBooking(e, 'daily'))
  ];

  /* ---------- Leads ---------- */
  const addLead = (leadData: Omit<Lead, 'id' | 'createdAt' | 'status'>): Lead => {
    const lead: Lead = { ...leadData, id: `LD-${Date.now().toString().slice(-7)}`, createdAt: todayISO(), status: 'new' };
    setLeads(prev => [lead, ...prev]);
    return lead;
  };

  const updateLeadStatus = (id: string, status: Lead['status'], notes?: string) =>
    setLeads(prev =>
      prev.map(l =>
        l.id === id
          ? { ...l, status, notes: notes ?? l.notes, lastContactedAt: status === 'new' ? l.lastContactedAt : todayISO() }
          : l
      )
    );

  /* ---------- Employees ---------- */
  const addEmployee = (empData: Omit<Employee, 'id'>): Employee | null => {
    if (session.role !== 'owner') {
      showToast('Sirf Owner naya staff add kar sakta hai.');
      return null;
    }
    const emp: Employee = { ...empData, id: `emp-${Date.now().toString().slice(-7)}` };
    setEmployees(prev => [...prev, emp]);
    return emp;
  };

  const deleteEmployee = (employeeId: string, bypassRoleCheck?: boolean): boolean => {
    if (!bypassRoleCheck && session.role !== 'owner') {
      showToast('Sirf Owner staff delete kar sakta hai.');
      return false;
    }
    if (employeeId === 'emp-1') {
      showToast('Founder profile delete nahi ho sakti.');
      return false;
    }
    setEmployees(prev => prev.filter(e => e.id !== employeeId));
    return true;
  };

  const updateEmployeePermissions = (employeeId: string, permissions: Employee['permissions']) =>
    setEmployees(prev => prev.map(e => (e.id === employeeId ? { ...e, permissions } : e)));

  const updateEmployeeDetails = (employeeId: string, updates: Partial<Employee>) =>
    setEmployees(prev => prev.map(e => (e.id === employeeId ? { ...e, ...updates } : e)));

  /* ---------- Client Photos -> Google Drive ---------- */
  const addClientPhoto = async (clientId: string, photo: Omit<ClientPhoto, 'id'>): Promise<boolean> => {
    if (session.role !== 'owner') {
      showToast('Security rule: Sirf Owner client photos upload kar sakta hai.');
      return false;
    }
    const client = clients.find(c => c.id === clientId);
    if (!client) {
      showToast('Pehle client select karein.');
      return false;
    }

    const photoId = `cp-${Date.now()}`;
    const isLocalData = photo.url.startsWith('data:');

    // Agar sirf link hai (Drive/https), to bina upload ke save kar do
    if (!isLocalData) {
      const linkPhoto: ClientPhoto = { ...photo, id: photoId };
      setClients(prev => prev.map(c => (c.id === clientId ? { ...c, photos: [linkPhoto, ...c.photos] } : c)));
      showToast('Photo link vault mein save ho gaya.');
      return true;
    }

    setIsUploadingPhoto(true);
    showToast("Photo Google Drive folder mein upload ho rahi hai...");
    try {
      const { fileId, url } = await uploadPhotoToDrive({
        photoId,
        clientId,
        clientName: client.name,
        title: photo.title,
        category: photo.category,
        date: photo.date,
        dataUrl: photo.url
      });
      const newPhoto: ClientPhoto = { ...photo, url, fileId, id: photoId };
      setClients(prev => prev.map(c => (c.id === clientId ? { ...c, photos: [newPhoto, ...c.photos] } : c)));
      showToast("Photo Drive folder 'Deepika Salon Client Photos' mein upload ho gayi!");
      return true;
    } catch (err: any) {
      showToast('Drive upload fail: ' + (err?.message || 'Script se connect nahi ho paya'));
      return false;
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const deleteClientPhoto = (clientId: string, photoId: string): boolean => {
    if (session.role !== 'owner') {
      showToast('Sirf Owner photo delete kar sakta hai.');
      return false;
    }
    const photo = clients.find(c => c.id === clientId)?.photos.find(p => p.id === photoId);
    setClients(prev => prev.map(c => (c.id === clientId ? { ...c, photos: c.photos.filter(p => p.id !== photoId) } : c)));
    if (photo?.fileId) {
      deletePhotoFromDrive(photoId, photo.fileId).catch(() =>
        showToast('Photo yahan se hat gayi, par Drive se delete nahi ho payi.')
      );
    }
    showToast('Photo vault se hata di gayi.');
    return true;
  };

  const updateClientNotes = (clientId: string, notes: string) =>
    setClients(prev => prev.map(c => (c.id === clientId ? { ...c, notes } : c)));

  // Drive/Sheet se saari photos wapas laao (naye device / refresh ke baad bhi photos dikhengi)
  const syncInFlight = useRef(false);
  const syncPhotosFromDrive = useCallback(
    async (silent = false) => {
      if (syncInFlight.current) return;
      syncInFlight.current = true;
      if (!silent) setGdriveSync(prev => ({ ...prev, status: 'syncing' }));
      try {
        const rows = await fetchPhotosFromDrive();
        setClients(prev =>
          prev.map(c => {
            const remote: ClientPhoto[] = rows
              .filter(r => r.clientId === c.id)
              .map(r => ({
                id: r.photoId,
                url: r.url,
                title: r.title,
                date: r.date,
                category: r.category,
                verifiedConsent: true,
                fileId: r.fileId
              }));
            // Drive wali photos + purani local link-photos (jinke paas fileId nahi)
            const localOnly = c.photos.filter(p => !p.fileId);
            return { ...c, photos: [...remote, ...localOnly] };
          })
        );
        setGdriveSync(prev => ({
          ...prev,
          status: 'synced',
          syncedFilesCount: rows.length,
          lastSyncedAt: new Date().toLocaleString('en-IN')
        }));
        if (!silent) showToast(`Drive sync complete: ${rows.length} photos mili.`);
      } catch (err: any) {
        setGdriveSync(prev => ({ ...prev, status: 'error' }));
        if (!silent) showToast('Drive sync fail: ' + (err?.message || 'Script check karein'));
      } finally {
        syncInFlight.current = false;
      }
    },
    [showToast]
  );

  const triggerGDriveSync = () => syncPhotosFromDrive(false);

  // ERP login hote hi (ya refresh par login bana rahe to) photos sync karo
  useEffect(() => {
    if (session.role === 'owner' || session.role === 'employee') {
      syncPhotosFromDrive(true);
    }
  }, [session.role, syncPhotosFromDrive]);

  /* ---------- Expenses ---------- */
  const addExpense = (expense: Omit<FinancialExpense, 'id'>) => {
    setExpenses(prev => [{ ...expense, id: `exp-${Date.now().toString().slice(-7)}` }, ...prev]);
    showToast('Expense add ho gaya.');
  };
  const deleteExpense = (id: string) => setExpenses(prev => prev.filter(e => e.id !== id));

  /* ---------- Chat & Notifications ---------- */
  const sendChatMessage = (text: string, sender: 'client' | 'studio' = 'client') => {
    const msg: ChatMessage = { id: `msg-${Date.now()}`, sender, text, timestamp: nowTime(), status: 'sent' };
    setChatMessages(prev => [...prev, msg]);
    if (sender === 'client') {
      setTimeout(() => {
        setChatMessages(prev => [
          ...prev,
          {
            id: `msg-${Date.now()}-r`,
            sender: 'studio',
            text: 'Thank you! Hamari team jald hi aapko reply karegi. Turant baat karni ho to WhatsApp karein: +91 95804 94058 ✨',
            timestamp: nowTime(),
            status: 'delivered'
          }
        ]);
      }, 900);
    }
  };

  const sendPushNotification = (n: Omit<PushNotificationItem, 'id' | 'sentAt' | 'status'>) => {
    const item: PushNotificationItem = {
      ...n,
      id: `notif-${Date.now()}`,
      sentAt: new Date().toLocaleString('en-IN'),
      status: 'sent'
    };
    setNotifications(prev => [item, ...prev]);
    showToast(`Notification ${n.targetClientName} ko bhej di gayi.`);
  };

  /* ---------- Attendance ---------- */
  const clockInEmployee = (employeeId: string, station?: string, notes?: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;
    const today = todayISO();
    if (attendanceRecords.some(r => r.employeeId === employeeId && r.date === today && r.status !== 'clocked_out')) {
      showToast(`${emp.name} pehle se clocked-in hai.`);
      return;
    }
    const rec: ShiftAttendanceRecord = {
      id: `att-${Date.now()}`,
      employeeId,
      employeeName: emp.name,
      role: emp.role,
      date: today,
      clockInTime: nowTime(),
      status: 'clocked_in',
      stationOrDuty: station || 'Main Studio',
      notes
    };
    setAttendanceRecords(prev => [rec, ...prev]);
    showToast(`${emp.name} clocked in.`);
  };

  const clockOutEmployee = (recordId: string, notes?: string) => {
    setAttendanceRecords(prev =>
      prev.map(r => {
        if (r.id !== recordId) return r;
        const [startH, startM] = (() => {
          const m = r.clockInTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (!m) return [0, 0];
          let h = parseInt(m[1], 10);
          if (m[3]?.toUpperCase() === 'PM' && h < 12) h += 12;
          if (m[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
          return [h, parseInt(m[2], 10)];
        })();
        const now = new Date();
        const hours = Math.max(0, now.getHours() + now.getMinutes() / 60 - (startH + startM / 60));
        return {
          ...r,
          status: 'clocked_out' as const,
          clockOutTime: nowTime(),
          totalHours: Math.round(hours * 10) / 10,
          notes: notes ?? r.notes
        };
      })
    );
    showToast('Clocked out.');
  };

  const toggleEmployeeBreak = (recordId: string) =>
    setAttendanceRecords(prev =>
      prev.map(r =>
        r.id === recordId && r.status !== 'clocked_out'
          ? { ...r, status: r.status === 'on_break' ? ('clocked_in' as const) : ('on_break' as const) }
          : r
      )
    );

  const exportAttendanceCSV = (weekOnly = false) => {
    const limit = new Date();
    limit.setDate(limit.getDate() - 7);
    const limitStr = limit.toISOString().split('T')[0];
    const rows = attendanceRecords.filter(r => !weekOnly || r.date >= limitStr);
    downloadFile(
      `attendance-${todayISO()}.csv`,
      toCSV([
        ['Date', 'Employee', 'Role', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Station', 'Notes'],
        ...rows.map(r => [r.date, r.employeeName, r.role, r.clockInTime, r.clockOutTime, r.totalHours, r.status, r.stationOrDuty, r.notes])
      ])
    );
  };

  /* ---------- Exports ---------- */
  const exportBackupJSON = () => {
    downloadFile(
      `deepika-erp-backup-${todayISO()}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), bookings, leads, clients, expenses, employees: employees.map(e => ({ ...e, password: undefined, pin: undefined })), attendanceRecords }, null, 2),
      'application/json'
    );
    showToast('Backup JSON download ho gaya.');
  };

  const exportClientReportCSV = () => {
    downloadFile(
      `clients-${todayISO()}.csv`,
      toCSV([
        ['ID', 'Name', 'Phone', 'Email', 'Type', 'Bookings', 'Total Spent', 'Skin Type', 'Undertone', 'Last Visit', 'Photos'],
        ...clients.map(c => [c.id, c.name, c.phone, c.email, c.clientType, c.totalBookings, c.totalSpent, c.skinType, c.undertone, c.lastVisit, c.photos.length])
      ])
    );
  };

  const exportLeadsReportCSV = (statusFilter?: string) => {
    const rows = leads.filter(l => !statusFilter || statusFilter === 'all' || l.status === statusFilter);
    downloadFile(
      `leads-${todayISO()}.csv`,
      toCSV([
        ['ID', 'Name', 'Phone', 'Email', 'Wedding Date', 'Service', 'City', 'Status', 'Created', 'Notes'],
        ...rows.map(l => [l.id, l.name, l.phone, l.email, l.weddingDate, l.serviceInterest, l.venueCity, l.status, l.createdAt, l.notes])
      ])
    );
  };

  return (
    <StudioContext.Provider
      value={{
        session, ownerCredentials, loginAsOwner, loginAsEmployee, logoutToGuest,
        updateOwnerCredentials, updateEmployeeCredentials,
        services, bookings, leads, employees, clients, expenses, chatMessages, notifications, gdriveSync,
        bookingEntries, dailyEntries, ledgerPackages, previewLedgerId, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, refreshLedger, isLedgerSyncing, canEditDaily,
        staffAccounts, isStaffLoading, refreshStaff, addStaff, changeStaffPassword, removeStaff,
        addLead, updateLeadStatus, addEmployee, deleteEmployee, updateEmployeePermissions, updateEmployeeDetails,
        addClientPhoto, deleteClientPhoto, updateClientNotes, isUploadingPhoto, syncPhotosFromDrive,
        addExpense, deleteExpense, sendChatMessage, sendPushNotification,
        attendanceRecords, clockInEmployee, clockOutEmployee, toggleEmployeeBreak, exportAttendanceCSV,
        triggerGDriveSync, exportBackupJSON, exportClientReportCSV, exportLeadsReportCSV,
        openBookingModal,
        isLeadModalOpen, openLeadModal, closeLeadModal,
        isERPModalOpen, openERPModal, closeERPModal,
        isNotificationsModalOpen, openNotificationsModal, closeNotificationsModal,
        toastMessage, showToast
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => {
  const context = useContext(StudioContext);
  if (!context) throw new Error('useStudio must be used within a StudioProvider');
  return context;
};
