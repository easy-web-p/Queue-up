// QueueUp for Campus Core Types & Interfaces

export type CampusRole = 'customer' | 'student_vendor' | 'staff_supervisor' | 'guardian' | 'admin';

export interface StudentProfile {
  studentId: string;
  name: string;
  class: string;
  room?: string;
  studentCode: string;
  guardianIds: string[];
  allergyInfo?: string[];
  healthNotes?: string;
  schoolId: string;
  createdAt: any;
  updatedAt: any;
}

export interface ParentChildLink {
  id: string;
  guardianId: string;
  studentId: string;
  guardianName: string;
  studentName: string;
  verifiedByGuardian: boolean;
  verifiedBySchool: boolean;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN';
  createdAt: any;
  verifiedAt?: any;
}

export interface StudentWallet {
  studentId: string;
  balanceSatang: number;
  dailyLimitSatang: number;
  weeklyLimitSatang: number;
  spentTodaySatang: number;
  spentThisWeekSatang: number;
  lastSpentDate: string; // YYYY-MM-DD
  blockedCategories: string[];
  guardianIds: string[];
  isLocked: boolean;
  updatedAt: any;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  studentId: string;
  orderId?: string;
  amountSatang: number;
  type: 'TOPUP' | 'SPEND' | 'REFUND' | 'ADJUSTMENT';
  category?: string;
  storeId?: string;
  storeName?: string;
  actorUid: string;
  note?: string;
  timestamp: any;
}

export interface VendorApprovalRequest {
  id: string;
  studentVendorId: string;
  studentName: string;
  studentCode: string;
  class: string;
  shopName: string;
  requestedZone: string;
  productCategories: string[];
  menuPreview: Array<{ name: string; price: number; description?: string }>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: any;
  rejectionReason?: string;
  submittedAt: any;
}

export interface StaffSupervisor {
  staffId: string;
  name: string;
  role: 'TEACHER' | 'CANTEEN_HEAD' | 'ADMINISTRATOR';
  assignedZones: string[];
  schoolId: string;
  canApproveVendors: boolean;
  canEmergencyLookup: boolean;
  createdAt: any;
}
