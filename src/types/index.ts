/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Deepika Sharma Makeup Studio & Academy - Core Type Definitions
 */

export interface ServiceItem {
  id: string;
  title: string;
  category: 'bridal' | 'party' | 'pre_bridal' | 'hair_draping';
  price: number;
  advanceRequired: number;
  duration: string;
  description: string;
  inclusions: string[];
  bestFor: string;
  image: string;
  popular?: boolean;
}

export type BookingStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentStatus = 'advance_paid' | 'partially_paid' | 'fully_paid' | 'pending';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cash';

export interface PartPayment {
  id: string;
  partNumber: number;
  title: string; // e.g. "Part 1: Advance Token to Lock Date", "Part 2: Trial Session", "Part 3: Final Wedding Balance"
  serviceName: string;
  date: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId: string;
  receivedBy: string;
  status: 'paid' | 'pending';
  notes?: string;
}

export interface Booking {
  id: string;
  clientName: string;
  phone: string;
  email: string;
  serviceId: string;
  serviceName: string;
  date: string;
  timeSlot: string;
  artistId: string;
  artistName: string;
  locationType: 'studio' | 'venue';
  venueAddress?: string;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  paymentMethod: PaymentMethod;
  transactionId: string;
  notes?: string;
  createdAt: string;
  partPayments?: PartPayment[];
}

export type LeadStatus = 'new' | 'contacted' | 'trial_booked' | 'converted' | 'lost';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  weddingDate: string;
  serviceInterest: string;
  guestCount?: number;
  venueCity: string;
  status: LeadStatus;
  notes: string;
  createdAt: string;
  lastContactedAt?: string;
}

export interface EmployeePermissions {
  canViewClients: boolean;
  canViewPhones: boolean;
  canManageBookings: boolean;
  canAccessERP: boolean;
  canManagePhotos: boolean;
  /** Daily Customers sheet mein entry/update ka access (Owner deta hai) */
  canManageDailyCustomers?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  avatar: string;
  specialty: string;
  monthlySalary: number;
  commissionRate: number; // percentage e.g. 10%
  assignedBookingsCount: number;
  socialHandle: string;
  instagramUrl: string;
  active: boolean;
  password: string;
  pin?: string;
  permissions: EmployeePermissions;
}

export type ShiftStatus = 'clocked_in' | 'clocked_out' | 'on_break';

export interface ShiftAttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  date: string;
  clockInTime: string;
  clockOutTime?: string;
  totalHours?: number;
  status: ShiftStatus;
  stationOrDuty: string;
  notes?: string;
}

export interface ClientPhoto {
  id: string;
  url: string;
  title: string;
  date: string;
  category: string;
  verifiedConsent: boolean;
  /** Google Drive file id (jab photo Drive par upload ho chuki ho) */
  fileId?: string;
}

export interface ClientProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  clientType: 'bride' | 'regular_vip' | 'first_time';
  weddingDate?: string;
  totalBookings: number;
  totalSpent: number;
  skinType: string;
  undertone: string;
  allergies: string;
  lastVisit: string;
  notes: string;
  photos: ClientPhoto[];
}

export interface FinancialExpense {
  id: string;
  date: string;
  category: 'cosmetics_purchase' | 'studio_rent' | 'salary' | 'marketing' | 'utilities' | 'equipment';
  title: string;
  amount: number;
  vendorOrStaff: string;
  paymentMethod: string;
  invoiceNumber?: string;
}

export interface Testimonial {
  id: string;
  brideName: string;
  eventDate: string;
  location: string;
  makeoverType: string;
  rating: number;
  review: string;
  image: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: 'bridal' | 'reception' | 'haldi_mehendi' | 'engagement' | 'editorial' | 'academy';
  imageBefore?: string;
  imageAfter: string;
  artistName: string;
  tags: string[];
  description: string;
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'studio' | 'system';
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

export interface PushNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'reminder' | 'booking' | 'payment' | 'prep';
  scheduledFor: string;
  sentAt?: string;
  targetClientPhone: string;
  targetClientName: string;
  status: 'sent' | 'scheduled';
}

export interface UserSession {
  role: 'owner' | 'employee' | 'client';
  employeeId?: string;
  name: string;
  email: string;
}

export interface OwnerCredentials {
  username: string;
  email: string;
  password: string;
  updatedAt: string;
}

/** Bookings aur Daily Customers dono sheets ki ek row (Google Sheet se sync hoti hai) */
export type LedgerKind = 'booking' | 'daily';
export type LedgerStatus = 'Payment Pending' | 'Completed';

export interface LedgerEntry {
  id: string;
  clientName: string;
  mobile: string;
  eventDate: string;
  packageName: string;
  totalAmount: number;
  advanceDate: string;
  advanceAmount: number;
  s1Date: string;
  s1Desc: string;
  s1Paid: number;
  s2Date: string;
  s2Desc: string;
  s2Paid: number;
  /** S3 sirf Bookings mein hota hai */
  s3Date?: string;
  s3Desc?: string;
  s3Paid?: number;
  pending: number;
  status: LedgerStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Daily Customers mein: kis staff ne service di */
  staff?: string;
  /** false = abhi Google Sheet mein save nahi hua (retry hoga) */
  synced?: boolean;
}

export type LedgerInput = Omit<LedgerEntry, 'id' | 'pending' | 'createdAt' | 'updatedAt' | 'createdBy' | 'synced'>;

/** Expenses sheet ki row: staff salary ya material purchase */
export interface ErpExpense {
  id: string;
  type: 'salary' | 'material';
  date: string;
  month: string;
  /** salary mein staff ka naam, material mein item ka naam */
  name: string;
  amount: number;
  mode: string;
  vendor: string;
  qty: string;
  notes: string;
  createdAt: string;
  createdBy: string;
}

/** Employees sheet ki row (profile + login ek hi jagah) */
export interface ErpEmployee {
  id: string;
  name: string;
  mobile: string;
  loginId: string;
  designation: string;
  salary: number;
  joinDate: string;
  address: string;
  photoUrl: string;
  photoFileId: string;
  active: string;
  createdAt: string;
  hasPassword?: boolean;
}
