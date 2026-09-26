import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import { ExcelService } from '../../services/excelService';
import { SchoolService } from '../../services/schoolService';
import { ExcelPreviewData } from '../../types';
import {
  School as SchoolIcon,
  UserCheck,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Download,
  UploadCloud,
  AlertTriangle,
  XCircle,
  FileCheck,
  Building,
  Mail,
  Phone,
  ShieldCheck,
  Info
} from 'lucide-react';

const THAI_PROVINCES = [
  'กรุงเทพมหานคร', 'ขอนแก่น', 'เชียงใหม่', 'นครราชสีมา', 'สงขลา', 'ชลบุรี', 'อุบลราชธานี',
  'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'พระนครศรีอยุธยา', 'นครปฐม', 'สุพรรณบุรี',
  'อุดรธานี', 'ร้อยเอ็ด', 'มหาสารคาม', 'กาฬสินธุ์', 'สกลนคร', 'นครพนม', 'หนองคาย',
  'ยโสธร', 'มุกดาหาร', 'บุรีรัมย์', 'สุรินทร์', 'ศรีสะเกษ', 'ชัยภูมิ', 'เลย',
  'เชียงราย', 'ลำปาง', 'ลำพูน', 'พะเยา', 'แพร่', 'น่าน', 'แม่ฮ่องสอน', 'อุตรดิตถ์',
  'พิษณุโลก', 'สุโขทัย', 'ตาก', 'กำแพงเพชร', 'พิจิตร', 'เพชรบูรณ์', 'นครสวรรค์', 'อุทัยธานี',
  'ราชบุรี', 'กาญจนบุรี', 'เพชรบุรี', 'ประจวบคีรีขันธ์', 'สมุทรสงคราม', 'สมุทรสาคร',
  'ฉะเชิงเทรา', 'ระยอง', 'จันทบุรี', 'ตราด', 'นครนายก', 'ปราจีนบุรี', 'สระแก้ว', 'สระบุรี', 'ลพบุรี', 'อ่างทอง', 'สิงห์บุรี', 'ชัยนาท',
  'ภูเก็ต', 'สุราษฎร์ธานี', 'นครศรีธรรมราช', 'กระบี่', 'พังงา', 'ระนอง', 'ชุมพร',
  'ตรัง', 'พัทลุง', 'สตูล', 'ปัตตานี', 'ยะลา', 'นราธิวาส'
];

export const RegisterSchoolPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useQueue();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedAppId, setSubmittedAppId] = useState('');

  // Step 1: School Info
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [province, setProvince] = useState('ขอนแก่น');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [emailDomain, setEmailDomain] = useState('');

  // Step 2: Admin Info
  const [employeeId, setEmployeeId] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminPosition, setAdminPosition] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  // Step 3: Excel Upload & Validation
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [excelPreview, setExcelPreview] = useState<ExcelPreviewData | null>(null);
  const [selectedPreviewTab, setSelectedPreviewTab] = useState<'admins' | 'students' | 'errors'>('admins');

  // Step 4: Terms
  const [pdpaConsent, setPdpaConsent] = useState(false);

  // Handlers
  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsParsing(true);
    try {
      const preview = await ExcelService.parseAndValidate(file);
      setExcelPreview(preview);
      
      // Auto-fill from Sheet SCHOOL if empty in step 1
      if (preview.schoolInfo) {
        if (!schoolCode) setSchoolCode(preview.schoolInfo.schoolCode);
        if (!schoolName) setSchoolName(preview.schoolInfo.schoolName);
        if (!province) setProvince(preview.schoolInfo.province);
        if (!contactEmail) setContactEmail(preview.schoolInfo.contactEmail);
        if (!contactPhone) setContactPhone(preview.schoolInfo.contactPhone);
        if (!emailDomain && preview.schoolInfo.emailDomain) setEmailDomain(preview.schoolInfo.emailDomain);
      }

      if (preview.isValid) {
        addToast('ตรวจสอบสำเร็จ', `อ่านข้อมูลสำเร็จ: โรงเรียน 1, Admin ${preview.adminCount} ท่าน, นักเรียน ${preview.studentCount} คน`, 'success');
      } else {
        addToast('พบข้อผิดพลาด', `พบข้อผิดพลาด ${preview.errors.length} รายการในไฟล์ Excel กรุณาตรวจสอบ`, 'warning');
        setSelectedPreviewTab('errors');
      }
    } catch (err) {
      console.error('File parsing error:', err);
      addToast('อ่านไฟล์ไม่สำเร็จ', 'ไฟล์ Excel ไม่ถูกต้องหรือไม่สามารถอ่านได้ กรุณาใช้ไฟล์แม่แบบ', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleStep1Next = () => {
    if (!schoolCode.trim() || !schoolName.trim() || !contactEmail.trim() || !contactPhone.trim()) {
      addToast('กรุณากรอกข้อมูลให้ครบ', 'โปรดกรอกรหัสสถานศึกษา, ชื่อสถานศึกษา, อีเมล และเบอร์โทรศัพท์ติดต่อ', 'warning');
      return;
    }
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (!adminFullName.trim() || !adminPosition.trim() || !adminEmail.trim()) {
      addToast('กรุณากรอกข้อมูลผู้ดูแล', 'โปรดระบุชื่อ-นามสกุล, ตำแหน่ง และอีเมลของผู้ดูแลระบบสถานศึกษา', 'warning');
      return;
    }
    setCurrentStep(3);
  };

  const handleStep3Next = () => {
    if (!excelPreview) {
      addToast('ยังไม่ได้อัปโหลดไฟล์', 'กรุณาอัปโหลดไฟล์ Excel รายชื่อบุคลากรและนักเรียน', 'warning');
      return;
    }
    if (!excelPreview.isValid) {
      addToast('ไฟล์ยังมีข้อผิดพลาด', 'กรุณาแก้ไขข้อผิดพลาดในไฟล์ Excel ให้ถูกต้องก่อนดำเนินการต่อ', 'warning');
      setSelectedPreviewTab('errors');
      return;
    }
    setCurrentStep(4);
  };

  const handleSubmitApplication = async () => {
    if (!pdpaConsent) {
      addToast('กรุณายินยอมเงื่อนไข', 'กรุณาทำเครื่องหมายยินยอมเงื่อนไขการส่งข้อมูลตามนโยบาย PDPA', 'warning');
      return;
    }
    if (!excelPreview || !excelPreview.isValid) {
      addToast('ข้อมูลไม่สมบูรณ์', 'กรุณาอัปโหลดไฟล์ Excel ที่ผ่านการตรวจสอบแล้ว', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Map parsed members
      const parsedMembers: Array<{
        type: 'admin' | 'student';
        id: string;
        fullName: string;
        email: string;
        phone?: string;
        classRoom?: string;
      }> = [
        ...excelPreview.admins.map(a => ({
          type: 'admin' as const,
          id: a.employeeId,
          fullName: a.fullName,
          email: a.email,
          phone: a.phone
        })),
        ...excelPreview.students.map(s => ({
          type: 'student' as const,
          id: s.studentId,
          fullName: s.fullName,
          email: s.email,
          phone: s.phone,
          classRoom: s.classRoom
        }))
      ];

      const res = await SchoolService.submitApplication({
        schoolData: {
          schoolCode: schoolCode.trim(),
          schoolName: schoolName.trim(),
          province,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          emailDomain: emailDomain.trim() || undefined
        },
        adminData: {
          employeeId: employeeId.trim() || 'EMP_HEAD',
          fullName: adminFullName.trim(),
          position: adminPosition.trim(),
          email: adminEmail.trim(),
          phone: adminPhone.trim()
        },
        memberStats: {
          adminCount: excelPreview.adminCount,
          studentCount: excelPreview.studentCount,
          errorCount: 0
        },
        uploadedFileName: uploadedFile?.name || 'QueueUp_School.xlsx',
        parsedMembers
      });

      setSubmittedAppId(res.applicationId);
      setIsSuccess(true);
      addToast('ส่งคำขอสำเร็จ', 'ระบบได้รับข้อมูลคำขอสมัครเข้าร่วมโครงการของสถานศึกษาแล้ว', 'success');
    } catch (err) {
      console.error('Submit application error:', err);
      addToast('เกิดข้อผิดพลาด', 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Screen
  if (isSuccess) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-10 border border-orange-200 dark:border-zinc-800 shadow-xl text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mx-auto flex items-center justify-center animate-in zoom-in">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300">
              สถานะ: PENDING (รอการตรวจสอบ)
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white mt-3">
              ส่งคำขอเข้าร่วมโครงการสำเร็จแล้ว!
            </h1>
            <p className="text-stone-600 dark:text-zinc-400 mt-2 text-sm sm:text-base max-w-xl mx-auto">
              ระบบได้รับข้อมูลของ <strong className="text-orange-600">{schoolName}</strong> (รหัส {schoolCode}) เรียบร้อยแล้ว ทีมงาน QueueUp จะดำเนินการตรวจสอบข้อมูลภายใน 1-2 วันทำการ
            </p>
          </div>

          <div className="p-4 bg-orange-50/80 dark:bg-zinc-950 border border-orange-200 dark:border-zinc-800 rounded-2xl max-w-md mx-auto text-left space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-500">รหัสคำขอสมัคร (Reference ID):</span>
              <span className="font-mono font-bold text-orange-600">{submittedAppId}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-500">ผู้ดูแลระบบ:</span>
              <span className="font-bold text-stone-900 dark:text-zinc-200">{adminFullName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-500">จำนวนนักเรียนที่ส่ง:</span>
              <span className="font-bold text-stone-900 dark:text-zinc-200">{excelPreview?.studentCount || 0} คน</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigate('/home')}
              className="w-full sm:w-auto px-6 py-3 rounded-full text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md active:scale-95 transition-all cursor-pointer"
            >
              กลับสู่หน้าหลัก
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400 mb-3">
          <SchoolIcon className="w-4 h-4" />
          <span>QueueUp for Educational Institutions</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-stone-900 dark:text-white tracking-tight">
          ลงทะเบียนสถานศึกษาเข้าร่วมโครงการ
        </h1>
        <p className="text-stone-600 dark:text-zinc-400 text-sm sm:text-base mt-2 max-w-2xl mx-auto">
          เปิดใช้งานระบบจัดการคิวและสั่งอาหารดิจิทัลล่วงหน้า สำหรับศูนย์อาหารและโรงอาหารในโรงเรียนของคุณ
        </p>
      </div>

      {/* 4-Step Progress Indicator */}
      <div className="mb-10">
        <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
          {[
            { step: 1, label: 'สถานศึกษา', icon: Building },
            { step: 2, label: 'ผู้ดูแล Admin', icon: UserCheck },
            { step: 3, label: 'อัปโหลด Excel', icon: FileSpreadsheet },
            { step: 4, label: 'ตรวจสอบ & ยืนยัน', icon: ShieldCheck }
          ].map(({ step, label, icon: Icon }) => {
            const isCompleted = currentStep > step;
            const isActive = currentStep === step;
            return (
              <div
                key={step}
                className={`relative flex flex-col items-center p-3 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 font-bold'
                    : isCompleted
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 font-semibold'
                    : 'bg-stone-100 text-stone-400 dark:bg-zinc-900 dark:text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-black">ขั้นที่ {step}</span>
                </div>
                <span className="text-[11px] sm:text-xs truncate w-full hidden sm:block">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content Box */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        {/* STEP 1: ข้อมูลสถานศึกษา */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-stone-100 dark:border-zinc-800 pb-4">
              <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-orange-500" />
                <span>ขั้นตอนที่ 1: ข้อมูลสถานศึกษา (School Information)</span>
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1">
                กรอกข้อมูลพื้นฐานของโรงเรียนเพื่อสร้างรหัสสถานศึกษาในระบบ
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  ชื่อสถานศึกษา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  placeholder="เช่น โรงเรียนขอนแก่นวิทยายน"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  รหัสสถานศึกษา / อักษรย่อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={schoolCode}
                  onChange={e => setSchoolCode(e.target.value.toUpperCase())}
                  placeholder="เช่น SCH001 หรือ KKW"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  จังหวัด <span className="text-red-500">*</span>
                </label>
                <select
                  value={province}
                  onChange={e => setProvince(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {THAI_PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  Domain อีเมลของสถานศึกษา
                </label>
                <input
                  type="text"
                  value={emailDomain}
                  onChange={e => setEmailDomain(e.target.value.toLowerCase())}
                  placeholder="เช่น kkw.ac.th (ถ้ามี)"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  อีเมลติดต่อส่วนกลาง <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="admin@school.ac.th"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  เบอร์โทรศัพท์ติดต่อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="043-123456 หรือ 0812345678"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleStep1Next}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <span>ถัดไป: ข้อมูลผู้ดูแล</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: ข้อมูลผู้ดูแล Admin */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-stone-100 dark:border-zinc-800 pb-4">
              <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-orange-500" />
                <span>ขั้นตอนที่ 2: ผู้ดูแลสถานศึกษา (School Administrator)</span>
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1">
                บุคลากรที่โรงเรียนมอบหมายให้เป็นผู้ดูแลระบบ (ระบบจะกำหนดสิทธิ์เป็น <strong>role = admin</strong> อัตโนมัติ)
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>ความปลอดภัยของระบบ:</strong> สิทธิ์ Admin ของสถานศึกษาจะถูกผูกเข้ากับ <code className="font-mono bg-white dark:bg-zinc-900 px-1 py-0.5 rounded">schoolId</code> เท่านั้น และไม่สามารถเข้าถึงข้อมูลของโรงเรียนอื่นได้
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  ชื่อ-นามสกุล ผู้ดูแล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={adminFullName}
                  onChange={e => setAdminFullName(e.target.value)}
                  placeholder="เช่น อ.สมชาย ใจดี"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  ตำแหน่งในสถานศึกษา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={adminPosition}
                  onChange={e => setAdminPosition(e.target.value)}
                  placeholder="เช่น หัวหน้างานสารสนเทศ / หัวหน้าฝ่ายโภชนาการ"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  รหัสประจำตัวบุคลากร
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  placeholder="เช่น EMP001"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  อีเมลประจำตัวผู้ดูแล <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="somchai@school.ac.th"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                  เบอร์โทรศัพท์มือถือผู้ดูแล
                </label>
                <input
                  type="tel"
                  value={adminPhone}
                  onChange={e => setAdminPhone(e.target.value)}
                  placeholder="081-234-5678"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>

              <button
                onClick={handleStep2Next}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <span>ถัดไป: อัปโหลด Excel</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: อัปโหลดและตรวจสอบ Excel */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-stone-100 dark:border-zinc-800 pb-4">
              <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-orange-500" />
                <span>ขั้นตอนที่ 3: ข้อมูลสมาชิกผ่านไฟล์ Excel (Excel Ingestion)</span>
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1">
                ดาวน์โหลดไฟล์แม่แบบ กรอกรายชื่อบุคลากรและนักเรียน จากนั้นอัปโหลดเพื่อตรวจสอบ
              </p>
            </div>

            {/* Template Download Box */}
            <div className="p-4 bg-orange-50/70 dark:bg-zinc-950 border border-orange-200 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-orange-600" />
                  <span>ไฟล์แม่แบบ QueueUp_School_Template.xlsx</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  ประกอบด้วย 3 ชีท: <strong>SCHOOL</strong>, <strong>ADMINS</strong>, และ <strong>USERS</strong>
                </p>
              </div>

              <button
                onClick={() => ExcelService.downloadTemplate()}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black bg-white dark:bg-zinc-900 hover:bg-orange-100 border border-orange-300 text-orange-700 dark:text-orange-400 shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลด Excel Template</span>
              </button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div className="border-2 border-dashed border-stone-300 dark:border-zinc-700 hover:border-orange-500 rounded-3xl p-8 text-center bg-stone-50/60 dark:bg-zinc-950/60 transition-colors">
              <input
                type="file"
                id="excelFileInput"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <label htmlFor="excelFileInput" className="cursor-pointer flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-3">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <span className="text-sm font-black text-stone-900 dark:text-white">
                  {uploadedFile ? uploadedFile.name : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่'}
                </span>
                <span className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                  รองรับไฟล์ .xlsx และ .xls
                </span>
              </label>
            </div>

            {/* Validation & Preview Section */}
            {isParsing && (
              <div className="text-center py-6">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-stone-500">กำลังประมวลผลและตรวจสอบข้อมูลในไฟล์ Excel...</p>
              </div>
            )}

            {excelPreview && !isParsing && (
              <div className="space-y-4 pt-2">
                {/* Stats Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-2xl text-center">
                    <span className="text-[11px] text-stone-500 font-medium">สถานศึกษา</span>
                    <p className="text-lg font-black text-stone-900 dark:text-white">{excelPreview.schoolCount} แห่ง</p>
                  </div>
                  <div className="p-3 bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-2xl text-center">
                    <span className="text-[11px] text-stone-500 font-medium">ผู้ดูแล Admin</span>
                    <p className="text-lg font-black text-stone-900 dark:text-white">{excelPreview.adminCount} ท่าน</p>
                  </div>
                  <div className="p-3 bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-2xl text-center">
                    <span className="text-[11px] text-stone-500 font-medium">นักเรียน/สมาชิก</span>
                    <p className="text-lg font-black text-stone-900 dark:text-white">{excelPreview.studentCount} คน</p>
                  </div>
                  <div className={`p-3 border rounded-2xl text-center ${
                    excelPreview.isValid
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-300 text-red-700 dark:text-red-400'
                  }`}>
                    <span className="text-[11px] font-medium">ข้อผิดพลาด</span>
                    <p className="text-lg font-black">{excelPreview.errors.length} รายการ</p>
                  </div>
                </div>

                {/* Status Notice */}
                {excelPreview.isValid ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-900 dark:text-emerald-300 font-medium">
                      ✓ ตรวจสอบข้อมูลสำเร็จครบถ้วน ไม่มีข้อผิดพลาด สามารถดำเนินการไปยังขั้นตอนถัดไปได้
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-2xl flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-900 dark:text-red-300 font-bold">
                        พบข้อผิดพลาด {excelPreview.errors.length} รายการในไฟล์ Excel
                      </p>
                      <p className="text-[11px] text-red-700 dark:text-red-400">
                        กรุณาดูรายละเอียดด้านล่าง แก้ไขไฟล์ Excel ของท่าน แล้วอัปโหลดใหม่อีกครั้ง
                      </p>
                    </div>
                  </div>
                )}

                {/* Interactive Preview Tabs */}
                <div className="border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="flex border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 text-xs font-bold">
                    <button
                      onClick={() => setSelectedPreviewTab('admins')}
                      className={`px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
                        selectedPreviewTab === 'admins'
                          ? 'border-orange-500 text-orange-600 bg-white dark:bg-zinc-900'
                          : 'border-transparent text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      Admin ({excelPreview.adminCount})
                    </button>
                    <button
                      onClick={() => setSelectedPreviewTab('students')}
                      className={`px-4 py-2.5 border-b-2 transition-all cursor-pointer ${
                        selectedPreviewTab === 'students'
                          ? 'border-orange-500 text-orange-600 bg-white dark:bg-zinc-900'
                          : 'border-transparent text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      นักเรียน ({excelPreview.studentCount})
                    </button>
                    {excelPreview.errors.length > 0 && (
                      <button
                        onClick={() => setSelectedPreviewTab('errors')}
                        className={`px-4 py-2.5 border-b-2 transition-all cursor-pointer text-red-600 ${
                          selectedPreviewTab === 'errors'
                            ? 'border-red-500 bg-white dark:bg-zinc-900 font-black'
                            : 'border-transparent text-red-500'
                        }`}
                      >
                        ข้อผิดพลาด ({excelPreview.errors.length})
                      </button>
                    )}
                  </div>

                  {/* Table View */}
                  <div className="max-h-60 overflow-y-auto p-2 text-xs">
                    {selectedPreviewTab === 'admins' && (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-stone-400 border-b border-stone-100 dark:border-zinc-800">
                            <th className="py-2 px-3">รหัสบุคลากร</th>
                            <th className="py-2 px-3">ชื่อ-นามสกุล</th>
                            <th className="py-2 px-3">ตำแหน่ง</th>
                            <th className="py-2 px-3">อีเมล</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excelPreview.admins.map((a, i) => (
                            <tr key={i} className="border-b border-stone-50 dark:border-zinc-800/50">
                              <td className="py-2 px-3 font-mono font-bold text-orange-600">{a.employeeId}</td>
                              <td className="py-2 px-3 font-medium text-stone-900 dark:text-zinc-200">{a.fullName}</td>
                              <td className="py-2 px-3 text-stone-500">{a.position}</td>
                              <td className="py-2 px-3 font-mono text-stone-500">{a.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {selectedPreviewTab === 'students' && (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-stone-400 border-b border-stone-100 dark:border-zinc-800">
                            <th className="py-2 px-3">รหัสนักเรียน</th>
                            <th className="py-2 px-3">ชื่อ-นามสกุล</th>
                            <th className="py-2 px-3">ห้อง</th>
                            <th className="py-2 px-3">อีเมล</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excelPreview.students.slice(0, 50).map((s, i) => (
                            <tr key={i} className="border-b border-stone-50 dark:border-zinc-800/50">
                              <td className="py-2 px-3 font-mono font-bold text-orange-600">{s.studentId}</td>
                              <td className="py-2 px-3 font-medium text-stone-900 dark:text-zinc-200">{s.fullName}</td>
                              <td className="py-2 px-3 text-stone-500">{s.classRoom || '-'}</td>
                              <td className="py-2 px-3 font-mono text-stone-500">{s.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {selectedPreviewTab === 'errors' && (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-red-400 border-b border-red-100 dark:border-red-950">
                            <th className="py-2 px-3">Sheet</th>
                            <th className="py-2 px-3">แถวที่</th>
                            <th className="py-2 px-3">ฟิลด์</th>
                            <th className="py-2 px-3">รายละเอียดข้อผิดพลาด</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excelPreview.errors.map((err, i) => (
                            <tr key={i} className="border-b border-red-50 dark:border-red-950/30 text-red-600">
                              <td className="py-2 px-3 font-mono font-bold">{err.sheetName}</td>
                              <td className="py-2 px-3 font-mono">{err.rowNumber > 0 ? err.rowNumber : '-'}</td>
                              <td className="py-2 px-3 font-mono">{err.field}</td>
                              <td className="py-2 px-3 font-medium">{err.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>

              <button
                onClick={handleStep3Next}
                disabled={!excelPreview || !excelPreview.isValid}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold shadow-md transition-all cursor-pointer ${
                  excelPreview && excelPreview.isValid
                    ? 'bg-orange-500 hover:bg-orange-600 text-white active:scale-95'
                    : 'bg-stone-300 dark:bg-zinc-800 text-stone-500 cursor-not-allowed opacity-60'
                }`}
              >
                <span>ถัดไป: ตรวจสอบข้อมูล</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: ตรวจสอบสรุปและส่งคำขอ */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-stone-100 dark:border-zinc-800 pb-4">
              <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-500" />
                <span>ขั้นตอนที่ 4: ตรวจสอบและยืนยันส่งคำขอ (Review & Submit)</span>
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1">
                โปรดตรวจสอบความถูกต้องของข้อมูลทั้งหมดก่อนส่งคำขอเข้าร่วมโครงการ
              </p>
            </div>

            {/* Summary Information Cards */}
            <div className="space-y-3">
              <div className="p-4 bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <h3 className="text-xs font-black text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-4 h-4" />
                  <span>ข้อมูลสถานศึกษา</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div><span className="text-stone-400">ชื่อ:</span> <span className="font-bold text-stone-900 dark:text-white">{schoolName}</span></div>
                  <div><span className="text-stone-400">รหัส:</span> <span className="font-mono font-bold text-orange-600">{schoolCode}</span></div>
                  <div><span className="text-stone-400">จังหวัด:</span> <span className="font-medium text-stone-900 dark:text-white">{province}</span></div>
                  <div><span className="text-stone-400">อีเมลติดต่อ:</span> <span className="font-mono text-stone-700 dark:text-zinc-300">{contactEmail}</span></div>
                  <div><span className="text-stone-400">เบอร์โทร:</span> <span className="text-stone-700 dark:text-zinc-300">{contactPhone}</span></div>
                  <div><span className="text-stone-400">Domain:</span> <span className="font-mono text-stone-700 dark:text-zinc-300">{emailDomain || '-'}</span></div>
                </div>
              </div>

              <div className="p-4 bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <h3 className="text-xs font-black text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" />
                  <span>ข้อมูลผู้ดูแลระบบ (Admin)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div><span className="text-stone-400">ชื่อผู้ดูแล:</span> <span className="font-bold text-stone-900 dark:text-white">{adminFullName}</span></div>
                  <div><span className="text-stone-400">ตำแหน่ง:</span> <span className="text-stone-700 dark:text-zinc-300">{adminPosition}</span></div>
                  <div><span className="text-stone-400">อีเมล:</span> <span className="font-mono text-stone-700 dark:text-zinc-300">{adminEmail}</span></div>
                </div>
              </div>

              <div className="p-4 bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <h3 className="text-xs font-black text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>ข้อมูลสมาชิกจากไฟล์ Excel</span>
                </h3>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-stone-400">ไฟล์:</span> <span className="font-bold text-stone-900 dark:text-white truncate block">{uploadedFile?.name}</span></div>
                  <div><span className="text-stone-400">จำนวน Admin:</span> <span className="font-bold text-stone-900 dark:text-white">{excelPreview?.adminCount} ท่าน</span></div>
                  <div><span className="text-stone-400">จำนวนนักเรียน:</span> <span className="font-bold text-stone-900 dark:text-white">{excelPreview?.studentCount} คน</span></div>
                </div>
              </div>
            </div>

            {/* PDPA Checkbox */}
            <div className="p-4 bg-amber-50/70 dark:bg-zinc-950 border border-amber-200 dark:border-zinc-800 rounded-2xl">
              <label className="flex items-start gap-3 cursor-pointer text-xs text-stone-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={pdpaConsent}
                  onChange={e => setPdpaConsent(e.target.checked)}
                  className="mt-0.5 rounded border-stone-300 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                />
                <span>
                  ข้าพเจ้ายืนยันว่าข้อมูลสถานศึกษา บุคลากร และนักเรียนทั้งหมดเป็นข้อมูลที่ถูกต้องตามความเป็นจริง และได้รับความยินยอมในการจัดเก็บและประมวลผลข้อมูลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA) เพื่อใช้ในระบบสั่งจองอาหาร QueueUp
                </span>
              </label>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>

              <button
                onClick={handleSubmitApplication}
                disabled={!pdpaConsent || isSubmitting}
                className={`flex items-center gap-2 px-8 py-3 rounded-full text-sm font-black shadow-md transition-all cursor-pointer ${
                  pdpaConsent && !isSubmitting
                    ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/25 active:scale-95'
                    : 'bg-stone-300 dark:bg-zinc-800 text-stone-500 cursor-not-allowed opacity-60'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>กำลังส่งคำขอ...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 ยืนยันและส่งคำขอเข้าร่วมโครงการ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
