// QueueUp for Campus Core Types & Interfaces

import type { FirestoreTimestamp } from '../types';

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
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
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
  createdAt: FirestoreTimestamp;
  verifiedAt?: FirestoreTimestamp;
  // Written by reviewParentChildLink when staff decide the request.
  verifiedBy?: string;
  verifiedByName?: string;
  reviewNote?: string;
  revokedBy?: string;
  revokedAt?: FirestoreTimestamp;
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
  approvedAt?: FirestoreTimestamp;
  rejectionReason?: string;
  submittedAt: FirestoreTimestamp;
}

export interface StaffSupervisor {
  staffId: string;
  name: string;
  role: 'TEACHER' | 'CANTEEN_HEAD' | 'ADMINISTRATOR';
  assignedZones: string[];
  schoolId: string;
  canApproveVendors: boolean;
  canEmergencyLookup: boolean;
  createdAt: FirestoreTimestamp;
}
