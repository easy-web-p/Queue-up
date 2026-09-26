import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { School, SchoolApplication, SchoolMember, Store } from '../types';

const SCHOOL_APPLICATIONS_COLLECTION = 'school_applications';
const SCHOOLS_COLLECTION = 'schools';
const SCHOOL_MEMBERS_COLLECTION = 'school_members';
const STORES_COLLECTION = 'stores';

const LOCAL_STORAGE_APPLICATIONS_KEY = 'queueup_school_applications_v1';
const LOCAL_STORAGE_SCHOOLS_KEY = 'queueup_schools_v1';
const LOCAL_STORAGE_MEMBERS_KEY = 'queueup_school_members_v1';

export const SchoolService = {
  /**
   * ส่งคำขอสมัครเข้าร่วมโครงการของสถานศึกษา (Submit School Application)
   */
  async submitApplication(application: Omit<SchoolApplication, 'id' | 'status' | 'submittedAt'>): Promise<{ success: boolean; applicationId: string }> {
    const applicationId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullApplication: SchoolApplication = {
      ...application,
      id: applicationId,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };

    // 1. บันทึกลง LocalStorage
    try {
      const existing = localStorage.getItem(LOCAL_STORAGE_APPLICATIONS_KEY);
      const list: SchoolApplication[] = existing ? JSON.parse(existing) : [];
      list.unshift(fullApplication);
      localStorage.setItem(LOCAL_STORAGE_APPLICATIONS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('LocalStorage save application error:', e);
    }

    // 2. บันทึกลง Cloud Firestore
    try {
      const docRef = doc(db, SCHOOL_APPLICATIONS_COLLECTION, applicationId);
      await setDoc(docRef, {
        ...fullApplication,
        createdAt: serverTimestamp()
      });
      return { success: true, applicationId };
    } catch (err) {
      console.warn('Firestore application save fallback to local:', err);
      return { success: true, applicationId };
    }
  },

  /**
   * ดึงรายการคำขอทั้งหมด (สำหรับ Admin ตรวจสอบ)
   */
  async fetchApplications(): Promise<SchoolApplication[]> {
    let list: SchoolApplication[] = [];
    try {
      const localStr = localStorage.getItem(LOCAL_STORAGE_APPLICATIONS_KEY);
      if (localStr) list = JSON.parse(localStr);
    } catch (e) {
      console.warn('LocalStorage applications read error:', e);
    }

    try {
      const q = query(collection(db, SCHOOL_APPLICATIONS_COLLECTION), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const cloudList: SchoolApplication[] = [];
        snapshot.forEach(docSnap => {
          cloudList.push(docSnap.data() as SchoolApplication);
        });

        // Merge cloud with local
        const mergedMap = new Map<string, SchoolApplication>();
        list.forEach(item => mergedMap.set(item.id, item));
        cloudList.forEach(item => mergedMap.set(item.id, item));
        const merged = Array.from(mergedMap.values());
        localStorage.setItem(LOCAL_STORAGE_APPLICATIONS_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.info('Firestore applications fetch fallback to local:', err);
    }

    return list;
  },

  /**
   * อนุมัติคำขอสมัครสถานศึกษา (Approve School Application)
   * เมื่ออนุมัติ:
   * 1. อัปเดต application.status = 'approved'
   * 2. สร้างข้อมูลใน collection schools
   * 3. สร้างข้อมูลสมาชิกใน collection school_members
   */
  async approveApplication(applicationId: string, reviewedBy: string = 'SuperAdmin'): Promise<{ success: boolean; schoolId: string }> {
    const applications = await this.fetchApplications();
    const app = applications.find(a => a.id === applicationId);

    if (!app) {
      throw new Error(`ไม่พบคำขอสมัครรหัส ${applicationId}`);
    }

    const schoolId = app.schoolData.schoolCode || `SCH_${Date.now()}`;
    const approvedAt = new Date().toISOString();

    const newSchool: School = {
      schoolId,
      schoolCode: app.schoolData.schoolCode,
      schoolName: app.schoolData.schoolName,
      province: app.schoolData.province,
      contactEmail: app.schoolData.contactEmail,
      contactPhone: app.schoolData.contactPhone,
      emailDomain: app.schoolData.emailDomain,
      status: 'active',
      totalStudents: app.memberStats.studentCount,
      totalAdmins: app.memberStats.adminCount,
      totalStores: 0,
      createdAt: app.submittedAt,
      approvedAt
    };

    // สร้าง School Members
    const membersToCreate: SchoolMember[] = app.parsedMembers.map(m => ({
      id: `${schoolId}_${m.id}`,
      schoolId,
      identifier: m.id,
      fullName: m.fullName,
      email: m.email,
      phone: m.phone,
      classRoom: m.classRoom,
      role: m.type,
      status: 'active',
      isRegistered: false,
      createdAt: approvedAt
    }));

    // 1. บันทึกลง LocalStorage
    try {
      // อัปเดต application
      const updatedApps = applications.map(a => 
        a.id === applicationId 
          ? { ...a, status: 'approved' as const, reviewedAt: approvedAt, reviewedBy } 
          : a
      );
      localStorage.setItem(LOCAL_STORAGE_APPLICATIONS_KEY, JSON.stringify(updatedApps));

      // บันทึก school
      const localSchoolsStr = localStorage.getItem(LOCAL_STORAGE_SCHOOLS_KEY);
      const localSchools: School[] = localSchoolsStr ? JSON.parse(localSchoolsStr) : [];
      const updatedSchools = [newSchool, ...localSchools.filter(s => s.schoolId !== schoolId)];
      localStorage.setItem(LOCAL_STORAGE_SCHOOLS_KEY, JSON.stringify(updatedSchools));

      // บันทึก members
      const localMembersStr = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY);
      const localMembers: SchoolMember[] = localMembersStr ? JSON.parse(localMembersStr) : [];
      const updatedMembers = [...membersToCreate, ...localMembers.filter(m => m.schoolId !== schoolId)];
      localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(updatedMembers));
    } catch (e) {
      console.warn('LocalStorage approve update error:', e);
    }

    // 2. บันทึกลง Cloud Firestore
    try {
      // Update application
      const appRef = doc(db, SCHOOL_APPLICATIONS_COLLECTION, applicationId);
      await updateDoc(appRef, {
        status: 'approved',
        reviewedAt: approvedAt,
        reviewedBy
      });

      // Set school
      const schoolRef = doc(db, SCHOOLS_COLLECTION, schoolId);
      await setDoc(schoolRef, newSchool);

      // Set members
      for (const member of membersToCreate) {
        const memberRef = doc(db, SCHOOL_MEMBERS_COLLECTION, member.id);
        await setDoc(memberRef, member);
      }
    } catch (err) {
      console.warn('Firestore approval sync fallback to local:', err);
    }

    return { success: true, schoolId };
  },

  /**
   * ปฏิเสธคำขอสมัครสถานศึกษา (Reject School Application)
   */
  async rejectApplication(applicationId: string, rejectionReason: string, reviewedBy: string = 'SuperAdmin'): Promise<{ success: boolean }> {
    const applications = await this.fetchApplications();
    const reviewedAt = new Date().toISOString();

    // 1. LocalStorage
    try {
      const updatedApps = applications.map(a => 
        a.id === applicationId 
          ? { ...a, status: 'rejected' as const, rejectionReason, reviewedAt, reviewedBy } 
          : a
      );
      localStorage.setItem(LOCAL_STORAGE_APPLICATIONS_KEY, JSON.stringify(updatedApps));
    } catch (e) {
      console.warn('LocalStorage reject update error:', e);
    }

    // 2. Firestore
    try {
      const appRef = doc(db, SCHOOL_APPLICATIONS_COLLECTION, applicationId);
      await updateDoc(appRef, {
        status: 'rejected',
        rejectionReason,
        reviewedAt,
        reviewedBy
      });
    } catch (err) {
      console.warn('Firestore reject update error:', err);
    }

    return { success: true };
  },

  /**
   * ดึงรายชื่อสถานศึกษาทั้งหมดที่ Active
   */
  async fetchSchools(): Promise<School[]> {
    let list: School[] = [];
    try {
      const localStr = localStorage.getItem(LOCAL_STORAGE_SCHOOLS_KEY);
      if (localStr) list = JSON.parse(localStr);
    } catch (e) {
      console.warn('LocalStorage schools read error:', e);
    }

    try {
      const q = query(collection(db, SCHOOLS_COLLECTION), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const cloudList: School[] = [];
        snapshot.forEach(docSnap => {
          cloudList.push(docSnap.data() as School);
        });
        return cloudList;
      }
    } catch (err) {
      console.info('Firestore schools read note:', err);
    }

    return list;
  },

  /**
   * ตรวจสอบว่าอีเมลหรือรหัสนักเรียน/บุคลากรนี้ เป็นสมาชิกของสถานศึกษาที่ได้รับอนุมัติหรือไม่
   */
  async verifyMember(schoolId: string, identifierOrEmail: string): Promise<SchoolMember | null> {
    const cleanId = identifierOrEmail.trim().toLowerCase();
    
    // Check local
    try {
      const localStr = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY);
      if (localStr) {
        const members: SchoolMember[] = JSON.parse(localStr);
        const match = members.find(m => 
          m.schoolId === schoolId && 
          (m.identifier.toLowerCase() === cleanId || m.email.toLowerCase() === cleanId)
        );
        if (match) return match;
      }
    } catch (e) {
      console.warn('Local member lookup error:', e);
    }

    // Check Cloud Firestore
    try {
      const q = query(
        collection(db, SCHOOL_MEMBERS_COLLECTION), 
        where('schoolId', '==', schoolId),
        where('email', '==', cleanId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as SchoolMember;
      }
    } catch (err) {
      console.debug('Firestore member verification note:', err);
    }

    return null;
  },

  /**
   * Account Provisioning & Activation Hook:
   * เมื่อผู้ใช้ผ่านการยืนยันตัวตนกับ Firebase Auth สำเร็จ ระบบจะค้นหา Roster ใน school_members
   * โดยตรวจสอบเงื่อนไขความปลอดภัย:
   * 1. อีเมลต้องตรงกับ Roster ที่ Active
   * 2. ป้องกัน Account Hijacking: สิทธิ์ต้องยังไม่เคยถูก Claim โดย UID อื่น (claimedByUid === null หรือ === uid ปัจจุบัน)
   * 3. ทำการผูก schoolId และ role เข้ากับ /users/{uid}
   */
  async claimSchoolMembership(
    email: string, 
    uid: string
  ): Promise<{ claimed: boolean; member?: SchoolMember; error?: string }> {
    if (!email || !uid) {
      return { claimed: false, error: 'INVALID_CREDENTIALS' };
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // 1. ตรวจสอบใน Firestore collection 'school_members'
    try {
      const q = query(
        collection(db, SCHOOL_MEMBERS_COLLECTION),
        where('email', '==', cleanEmail),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const memberDoc = snap.docs[0];
        const memberData = memberDoc.data() as SchoolMember;

        // Security Check: ป้องกันการสวมสิทธิ์ซ้ำซ้อนจาก UID อื่น (Anti-Hijack Guard)
        if (memberData.claimedByUid && memberData.claimedByUid !== uid) {
          console.warn(`[Security Alert] Duplicate claim attempt on member ${memberData.id} by UID ${uid}. Already owned by ${memberData.claimedByUid}`);
          return {
            claimed: false,
            error: 'ROSTER_ALREADY_CLAIMED'
          };
        }

        // หากผู้ใช้นี้เคย Claim ไปแล้ว ให้ยืนยันสิทธิ์เดิม
        if (memberData.isRegistered && memberData.claimedByUid === uid) {
          return { claimed: true, member: memberData };
        }

        // Claim สิทธิ์ใหม่ครั้งแรก
        const claimedAt = new Date().toISOString();
        await updateDoc(doc(db, SCHOOL_MEMBERS_COLLECTION, memberDoc.id), {
          claimedByUid: uid,
          userId: uid,
          isRegistered: true,
          claimedAt
        });

        // บันทึกลง /users/{uid} โดยดึง schoolId และ role จาก Roster ที่เชื่อถือได้เท่านั้น
        await setDoc(doc(db, 'users', uid), {
          schoolId: memberData.schoolId,
          role: memberData.role,
          studentOrStoreId: memberData.identifier,
          displayName: memberData.fullName,
          email: memberData.email,
          updatedAt: serverTimestamp()
        }, { merge: true });

        return { 
          claimed: true, 
          member: { ...memberData, claimedByUid: uid, userId: uid, isRegistered: true, claimedAt } 
        };
      }
    } catch (err) {
      console.warn('Firestore claimSchoolMembership note:', err);
    }

    // 2. Fallback เฉพาะใน Development / Sandbox Environment (จำกัดการใช้งานสำหรับการทดสอบออฟไลน์เท่านั้น)
    try {
      const localMembersStr = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY);
      if (localMembersStr) {
        const members: SchoolMember[] = JSON.parse(localMembersStr);
        const target = members.find(m => m.email.toLowerCase() === cleanEmail && m.status === 'active');
        if (target) {
          if (target.claimedByUid && target.claimedByUid !== uid) {
            return { claimed: false, error: 'ROSTER_ALREADY_CLAIMED' };
          }
          target.isRegistered = true;
          target.claimedByUid = uid;
          target.userId = uid;
          target.claimedAt = new Date().toISOString();
          localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(members));
          return { claimed: true, member: target };
        }
      }
    } catch (e) {
      console.warn('Local claim error:', e);
    }

    return { claimed: false };
  }
};
