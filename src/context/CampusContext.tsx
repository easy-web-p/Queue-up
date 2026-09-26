import React, { createContext, useContext, useState, useEffect } from 'react';
import { KKU_CANTEENS_DATA } from '../services/canteenService';

export interface StudentVendorApplication {
  id: string;
  studentId: string;
  studentName: string;
  faculty: string;
  stallName: string;
  canteenId: number;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  dailyEarnings: number;
}

export interface GuardianLink {
  id: string;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  studentId: string;
  studentName: string;
  status: 'pending' | 'approved' | 'rejected';
  dailySpendingLimit: number;
  remainingDailyLimit: number;
  allergyAlerts: string[];
}

interface CampusContextType {
  canteens: typeof KKU_CANTEENS_DATA;
  studentVendors: StudentVendorApplication[];
  guardianLinks: GuardianLink[];
  applyStudentVendor: (app: Omit<StudentVendorApplication, 'id' | 'status' | 'appliedAt' | 'dailyEarnings'>) => void;
  updateVendorStatus: (id: string, status: 'approved' | 'rejected') => void;
  createGuardianLink: (link: Omit<GuardianLink, 'id' | 'status' | 'remainingDailyLimit'>) => void;
  updateGuardianLinkStatus: (id: string, status: 'approved' | 'rejected') => void;
  updateAllergyAlerts: (linkId: string, alerts: string[]) => void;
  updateSpendingLimit: (linkId: string, limit: number) => void;
}

const CampusContext = createContext<CampusContextType | undefined>(undefined);

export const CampusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [canteens] = useState(KKU_CANTEENS_DATA);

  const [studentVendors, setStudentVendors] = useState<StudentVendorApplication[]>(() => {
    try {
      const saved = localStorage.getItem('queueup_student_vendors');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'sv-1',
        studentId: '653040123-4',
        studentName: 'ธนวัฒน์ พรหมวิชัย',
        faculty: 'วิศวกรรมศาสตร์',
        stallName: 'กะเพราเด็กวิดวะ จานยักษ์',
        canteenId: 5,
        category: 'ข้าวราดแกง / อาหารตามสั่ง',
        status: 'approved',
        appliedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        dailyEarnings: 1850
      },
      {
        id: 'sv-2',
        studentId: '663040567-8',
        studentName: 'ณภัทร วงศ์เจริญ',
        faculty: 'เกษตรศาสตร์',
        stallName: 'น้ำผลไม้ปั่นฟาร์ม มข.',
        canteenId: 9,
        category: 'เครื่องดื่มและเบเกอรี่',
        status: 'pending',
        appliedAt: new Date(Date.now() - 86400000).toISOString(),
        dailyEarnings: 940
      }
    ];
  });

  const [guardianLinks, setGuardianLinks] = useState<GuardianLink[]>(() => {
    try {
      const saved = localStorage.getItem('queueup_guardian_links');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'g-link-1',
        guardianId: 'guard-001',
        guardianName: 'คุณแม่พรพิมล (ผู้ปกครอง)',
        guardianPhone: '081-234-5678',
        studentId: '663040567-8',
        studentName: 'ณภัทร วงศ์เจริญ (นักศึกษา มข.)',
        status: 'approved',
        dailySpendingLimit: 200,
        remainingDailyLimit: 145,
        allergyAlerts: ['กุ้ง', 'ถั่วลิสง']
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('queueup_student_vendors', JSON.stringify(studentVendors));
  }, [studentVendors]);

  useEffect(() => {
    localStorage.setItem('queueup_guardian_links', JSON.stringify(guardianLinks));
  }, [guardianLinks]);

  const applyStudentVendor = (app: Omit<StudentVendorApplication, 'id' | 'status' | 'appliedAt' | 'dailyEarnings'>) => {
    const newApp: StudentVendorApplication = {
      ...app,
      id: `sv-${Date.now()}`,
      status: 'pending',
      appliedAt: new Date().toISOString(),
      dailyEarnings: 0
    };
    setStudentVendors(prev => [newApp, ...prev]);
  };

  const updateVendorStatus = (id: string, status: 'approved' | 'rejected') => {
    setStudentVendors(prev => prev.map(v => v.id === id ? { ...v, status } : v));
  };

  const createGuardianLink = (link: Omit<GuardianLink, 'id' | 'status' | 'remainingDailyLimit'>) => {
    const newLink: GuardianLink = {
      ...link,
      id: `g-link-${Date.now()}`,
      status: 'pending',
      remainingDailyLimit: link.dailySpendingLimit
    };
    setGuardianLinks(prev => [newLink, ...prev]);
  };

  const updateGuardianLinkStatus = (id: string, status: 'approved' | 'rejected') => {
    setGuardianLinks(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const updateAllergyAlerts = (linkId: string, alerts: string[]) => {
    setGuardianLinks(prev => prev.map(l => l.id === linkId ? { ...l, allergyAlerts: alerts } : l));
  };

  const updateSpendingLimit = (linkId: string, limit: number) => {
    setGuardianLinks(prev => prev.map(l => l.id === linkId ? { ...l, dailySpendingLimit: limit, remainingDailyLimit: limit } : l));
  };

  return (
    <CampusContext.Provider
      value={{
        canteens,
        studentVendors,
        guardianLinks,
        applyStudentVendor,
        updateVendorStatus,
        createGuardianLink,
        updateGuardianLinkStatus,
        updateAllergyAlerts,
        updateSpendingLimit
      }}
    >
      {children}
    </CampusContext.Provider>
  );
};

export const useCampus = () => {
  const context = useContext(CampusContext);
  if (!context) {
    throw new Error('useCampus must be used within a CampusProvider');
  }
  return context;
};
