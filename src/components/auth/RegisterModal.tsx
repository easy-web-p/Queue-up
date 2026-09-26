import React, { useState, useEffect, useRef } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Button } from '../ui/Button';
import {
  X,
  User,
  ChefHat,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  LogIn,
  UserPlus,
  CheckCircle2,
  RefreshCw,
  Send,
  KeyRound,
  Smartphone,
  Check
} from 'lucide-react';
import { analyzeAndShieldInput } from '../../services/engines/securityShield';
import { ALLERGEN_LABELS_TH } from '../../services/engines/allergenGuard';
import { otpService } from '../../services/otpService';
import { AuthUser, UserRole } from '../../types';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalStep = 'auth_form' | 'otp_verification' | 'popup_fallback';

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose }) => {
  const { registerUser, loginUser, loginWithGoogle, completeFirstTimeOtp } = useQueue();

  const [currentStep, setCurrentStep] = useState<ModalStep>('auth_form');
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [registerType, setRegisterType] = useState<'customer' | 'merchant'>('customer');
  
  // Form fields
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    studentOrStoreId: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  });

  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [popupErrorHint, setPopupErrorHint] = useState<string | null>(null);
  const [customGoogleEmail, setCustomGoogleEmail] = useState<string>('hi00000087@gmail.com');

  // Pending user object awaiting OTP verification
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  
  // OTP state
  const [otpPhone, setOtpPhone] = useState<string>('');
  const [otpPassword, setOtpPassword] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [lastSentOtp, setLastSentOtp] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState<number>(60);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCountingDown && otpCountdown > 0) {
      timer = setTimeout(() => {
        setOtpCountdown(prev => prev - 1);
      }, 1000);
    } else if (otpCountdown === 0) {
      setIsCountingDown(false);
    }
    return () => clearTimeout(timer);
  }, [isCountingDown, otpCountdown]);

  if (!isOpen) return null;

  const toggleAllergy = (key: string) => {
    setSelectedAllergies(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrorText(null);
  };

  /**
   * Send or resend OTP to user's phone
   */
  const triggerSendOtp = (phoneToSend: string) => {
    try {
      const result = otpService.sendOtp(phoneToSend);
      setLastSentOtp(result.code);
      setOtpCountdown(60);
      setIsCountingDown(true);
      setOtpError(null);
      // Focus first OTP input
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถส่ง OTP ได้ กรุณาตรวจสอบเบอร์โทรศัพท์';
      setOtpError(msg);
    }
  };

  /**
   * Handle Real Google Sign-In Click
   */
  const handleGoogleSignInClick = async (fallbackEmail?: string) => {
    setIsSubmitting(true);
    setErrorText(null);
    setPopupErrorHint(null);

    try {
      let result;
      if (fallbackEmail) {
        // Direct account login (used when popup is blocked or requested by user)
        result = await loginWithGoogle({
          email: fallbackEmail,
          fullName: fallbackEmail.toLowerCase() === 'hi00000087@gmail.com' ? 'Kritapas (hi00000087)' : fallbackEmail.split('@')[0],
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
          role: registerType
        });
      } else {
        // Real Firebase Popup sign-in
        result = await loginWithGoogle();
      }

      if (result) {
        if (result.isFirstTime) {
          // First time user! Must complete SMS / OTP & Password verification
          setPendingUser(result.user);
          const initialPhone = result.user.phone || '089-876-5432';
          setOtpPhone(initialPhone);
          setCurrentStep('otp_verification');
          triggerSendOtp(initialPhone);
        } else {
          // Returning user: successfully logged in directly
          onClose();
        }
      }
    } catch (err: unknown) {
      console.warn('Google Sign-In caught error:', err);
      // If popup is blocked by browser, provide the fallback option
      setPopupErrorHint(
        'เบราว์เซอร์บล็อกหน้าต่าง Pop-up หรือโดเมนยังไม่ได้อนุญาตใน Firebase Console คุณสามารถเข้าสู่ระบบด้วยบัญชี Google ได้โดยตรงด้านล่าง'
      );
      setCurrentStep('popup_fallback');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Registration Form Submission
   */
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    // Form Validations
    if (!formData.fullName.trim()) {
      setErrorText('กรุณากรอกชื่อ-นามสกุล หรือชื่อร้านค้า');
      return;
    }

    if (!formData.phone.trim() || formData.phone.length < 9) {
      setErrorText('กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (อย่างน้อย 9-10 หลัก)');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorText('กรุณากรอกอีเมลที่ถูกต้อง');
      return;
    }

    if (formData.password.length < 6) {
      setErrorText('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorText('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (!formData.acceptTerms) {
      setErrorText('กรุณายินยอมเงื่อนไขการให้บริการและนโยบายความเป็นส่วนตัว (PDPA)');
      return;
    }

    // Security Shield check
    const nameCheck = analyzeAndShieldInput(formData.fullName);
    if (!nameCheck.isSafe) {
      setErrorText(nameCheck.errorMessage || 'ตรวจพบลักษณะอักขระที่ไม่ปลอดภัยในชื่อ');
      return;
    }

    // Prepare pending user object
    const newPendingUser: AuthUser = {
      id: `user-${Date.now()}`,
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      role: registerType,
      studentOrStoreId: formData.studentOrStoreId,
      allergies: selectedAllergies,
      registeredAt: new Date().toISOString(),
      isFirstTime: true,
      phoneVerified: false,
      password: formData.password
    };

    setPendingUser(newPendingUser);
    setOtpPhone(formData.phone);
    setOtpPassword(formData.password);
    setCurrentStep('otp_verification');
    triggerSendOtp(formData.phone);
  };

  /**
   * Handle Login Form Submission
   */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!formData.email.trim()) {
      setErrorText('กรุณากรอกอีเมลหรือเบอร์โทรศัพท์');
      return;
    }
    if (!formData.password.trim()) {
      setErrorText('กรุณากรอกรหัสผ่าน');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginUser({
        email: formData.email,
        fullName: formData.email.split('@')[0],
        role: registerType,
        password: formData.password
      });

      if (result.isFirstTime) {
        // First-time user logging in -> Must verify OTP & SMS
        setPendingUser(result.user);
        const phone = result.user.phone || (formData.email.match(/^[0-9]+$/) ? formData.email : '081-234-5678');
        setOtpPhone(phone);
        setCurrentStep('otp_verification');
        triggerSendOtp(phone);
      } else {
        // Already verified returning user -> logged in!
        onClose();
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      setErrorText('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle OTP 6-Digit Inputs
   */
  const handleOtpDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Pasting full OTP code
      const pasted = value.replace(/[^0-9]/g, '').slice(0, 6);
      if (pasted.length > 0) {
        const newDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          newDigits[i] = pasted[i] || '';
        }
        setOtpDigits(newDigits);
        const nextIndex = Math.min(pasted.length, 5);
        otpInputRefs.current[nextIndex]?.focus();
      }
      return;
    }

    const digit = value.replace(/[^0-9]/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setOtpError(null);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFillOtp = (code: string) => {
    const chars = code.split('').slice(0, 6);
    setOtpDigits(chars);
    setOtpError(null);
  };

  /**
   * Submit and verify OTP
   */
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otpDigits.join('');

    if (fullCode.length < 6) {
      setOtpError('กรุณากรอกรหัส OTP ให้ครบทั้ง 6 หลัก');
      return;
    }

    if (!pendingUser) {
      setOtpError('ไม่พบข้อมูลบัญชีผู้ใช้ กรุณาเริ่มต้นใหม่');
      return;
    }

    setIsSubmitting(true);
    setOtpError(null);

    try {
      const res = await completeFirstTimeOtp({
        user: pendingUser,
        phone: otpPhone,
        password: otpPassword || pendingUser.password,
        otpCode: fullCode
      });

      if (!res.success) {
        setOtpError(res.error || 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        setIsSubmitting(false);
        return;
      }

      // Success! Close modal
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยืนยัน OTP';
      setOtpError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white border border-orange-200/90 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-stone-900 dark:bg-[#09090b] dark:border-zinc-800 dark:text-zinc-100"
        role="dialog"
        aria-modal="true"
      >
        {/* ======================================================== */}
        {/* HEADER */}
        {/* ======================================================== */}
        <div className="p-5 sm:p-6 border-b border-orange-200/80 dark:border-zinc-800 flex items-center justify-between bg-orange-50/50 dark:bg-black/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              {currentStep === 'otp_verification' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-stone-900 dark:text-zinc-100">
                  {currentStep === 'otp_verification'
                    ? 'ยืนยันรหัส OTP ผ่าน SMS'
                    : currentStep === 'popup_fallback'
                    ? 'เข้าสู่ระบบด้วย Google'
                    : authMode === 'register'
                    ? 'สมัครสมาชิกใหม่'
                    : 'เข้าสู่ระบบ'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400 font-bold border border-orange-300 dark:border-orange-500/40">
                  QueueUp
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-zinc-400">
                {currentStep === 'otp_verification'
                  ? 'เข้าสู่ระบบครั้งแรก: กรุณายืนยันรหัส OTP เพื่อความปลอดภัย'
                  : currentStep === 'popup_fallback'
                  ? 'เลือกบัญชี Google หรือระบุอีเมลเพื่อดำเนินการต่อ'
                  : authMode === 'register'
                  ? 'สร้างบัญชีเพื่อสั่งอาหารล่วงหน้าและรับการแจ้งเตือนคิว'
                  : 'ลงชื่อเข้าใช้เพื่อดำเนินการสั่งอาหารต่อทันที'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-orange-100/70 hover:bg-orange-200 text-stone-600 hover:text-stone-900 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* STEP 1: AUTH FORM (REGISTER / LOGIN) */}
        {/* ======================================================== */}
        {currentStep === 'auth_form' && (
          <>
            {/* Switch Between Register and Login Tabs */}
            <div className="flex border-b border-orange-200/80 dark:border-zinc-800 bg-orange-50/30 dark:bg-black/40 p-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorText(null);
                }}
                className={`flex-1 py-2 flex items-center justify-center gap-1.5 rounded-xl transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow'
                    : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>สมัครสมาชิก</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorText(null);
                }}
                className={`flex-1 py-2 flex items-center justify-center gap-1.5 rounded-xl transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow'
                    : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>เข้าสู่ระบบ</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={authMode === 'register' ? handleRegisterSubmit : handleLoginSubmit}
              className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs"
            >
              {/* Role selector */}
              <div>
                <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-2">
                  เข้าใช้งานในฐานะ
                </label>
                <div className="grid grid-cols-2 gap-2.5 p-1 bg-orange-50/70 dark:bg-black/60 rounded-2xl border border-orange-200/80 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setRegisterType('customer')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer ${
                      registerType === 'customer'
                        ? 'bg-white text-orange-700 shadow-sm border border-orange-200 dark:bg-orange-500 dark:text-black dark:border-orange-400'
                        : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>นักศึกษา / ลูกค้าทั่วไป</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterType('merchant')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer ${
                      registerType === 'merchant'
                        ? 'bg-white text-orange-700 shadow-sm border border-orange-200 dark:bg-orange-500 dark:text-black dark:border-orange-400'
                        : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>ร้านค้าพาร์ทเนอร์</span>
                  </button>
                </div>
              </div>

              {/* REAL GOOGLE AUTH BUTTON */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleGoogleSignInClick()}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl border border-stone-300 hover:border-orange-400 bg-white hover:bg-orange-50/50 text-stone-800 font-bold flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99] cursor-pointer disabled:opacity-60 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
                      <span>กำลังเชื่อมต่อกับ Google...</span>
                    </>
                  ) : (
                    <>
                      {/* Official Google Icon SVG */}
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" />
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
                      </svg>
                      <span>
                        {authMode === 'register' ? 'สมัครสมาชิกด้วย Google' : 'เข้าสู่ระบบด้วย Google'}
                      </span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative flex py-3 items-center">
                  <div className="flex-grow border-t border-orange-200/80 dark:border-zinc-800"></div>
                  <span className="flex-shrink mx-3 text-[11px] font-medium text-stone-500 dark:text-zinc-400">
                    หรือดำเนินการด้วยเบอร์โทร / อีเมล
                  </span>
                  <div className="flex-grow border-t border-orange-200/80 dark:border-zinc-800"></div>
                </div>
              </div>

              {/* Error Banner */}
              {errorText && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorText}</span>
                </div>
              )}

              {authMode === 'login' ? (
                /* Login Form Fields */
                <div className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-1">
                      อีเมลหรือเบอร์โทรศัพท์ *
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-3.5 top-3 text-stone-400 dark:text-zinc-500" />
                      <input
                        type="text"
                        value={formData.email}
                        onChange={e => handleInputChange('email', e.target.value)}
                        placeholder="student@campus.ac.th หรือ 081-xxx-xxxx"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-1">
                      รหัสผ่าน (Password) *
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 absolute left-3.5 top-3 text-stone-400 dark:text-zinc-500" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={e => handleInputChange('password', e.target.value)}
                        placeholder="กรอกรหัสผ่านของคุณ"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-orange-50/70 border border-orange-200/80 text-[11px] text-stone-700 leading-relaxed dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400">
                    💡 <strong>เข้าใช้งานครั้งแรก:</strong> ระบบจะให้ยืนยันรหัส OTP ผ่านทาง SMS เบอร์โทรศัพท์ เพื่อความปลอดภัยในการรับแจ้งเตือนสถานะคิวอาหาร
                  </div>
                </div>
              ) : (
                /* Register Form Fields */
                <div className="space-y-3">
                  <div>
                    <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-1">
                      {registerType === 'customer' ? 'ชื่อ - นามสกุล *' : 'ชื่อร้านค้า / ชื่อผู้ประกอบการ *'}
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={e => handleInputChange('fullName', e.target.value)}
                      placeholder={registerType === 'customer' ? 'เช่น กฤตภาส สมบูรณ์' : 'เช่น ร้านข้าวมันไก่โกฮง'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-1">
                        เบอร์โทรศัพท์มือถือ (รับ SMS OTP) *
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3.5 top-3 text-stone-400 dark:text-zinc-500" />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={e => handleInputChange('phone', e.target.value)}
                          placeholder="081-234-5678"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-1">
                        อีเมลติดต่อ *
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 absolute left-3.5 top-3 text-stone-400 dark:text-zinc-500" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={e => handleInputChange('email', e.target.value)}
                          placeholder="student@campus.ac.th"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-1">
                      {registerType === 'customer' ? 'รหัสนักศึกษา / รหัสบุคลากร (ไม่บังคับ)' : 'รหัสใบอนุญาตร้านค้า / ลำดับบูธ'}
                    </label>
                    <input
                      type="text"
                      value={formData.studentOrStoreId}
                      onChange={e => handleInputChange('studentOrStoreId', e.target.value)}
                      placeholder={registerType === 'customer' ? 'เช่น 66010045' : 'เช่น Kiosk-B04'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-1">
                        กำหนดรหัสผ่าน *
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-3.5 top-3 text-stone-400 dark:text-zinc-500" />
                        <input
                          type="password"
                          value={formData.password}
                          onChange={e => handleInputChange('password', e.target.value)}
                          placeholder="อย่างน้อย 6 ตัวอักษร"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-1">
                        ยืนยันรหัสผ่าน *
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-3.5 top-3 text-stone-400 dark:text-zinc-500" />
                        <input
                          type="password"
                          value={formData.confirmPassword}
                          onChange={e => handleInputChange('confirmPassword', e.target.value)}
                          placeholder="พิมพ์รหัสผ่านซ้ำอีกครั้ง"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Allergen Guard for Customer */}
                  {registerType === 'customer' && (
                    <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-2 dark:bg-zinc-950 dark:border-zinc-800">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold">
                        <ShieldCheck className="w-4 h-4" />
                        <span>ระบบป้องกันสารก่อภูมิแพ้: ประวัติการแพ้อาหาร (ถ้ามี)</span>
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-zinc-400 leading-relaxed">
                        ระบบจะแจ้งเตือนอัตโนมัติหากท่านสั่งเมนูที่มีวัตถุดิบเสี่ยงเหล่านี้
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {Object.entries(ALLERGEN_LABELS_TH).map(([key, label]) => {
                          const isChecked = selectedAllergies.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleAllergy(key)}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-red-500 text-white font-bold shadow-xs'
                                  : 'bg-white text-stone-700 border border-stone-300 hover:border-orange-400 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800'
                              }`}
                            >
                              {isChecked ? '✓ ' : '+ '} {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PDPA Terms Consent */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer text-stone-700 dark:text-zinc-300 text-[11px] leading-relaxed select-none">
                      <input
                        type="checkbox"
                        checked={formData.acceptTerms}
                        onChange={e => handleInputChange('acceptTerms', e.target.checked)}
                        className="mt-0.5 rounded border-orange-300 text-orange-600 focus:ring-orange-500/20 w-4 h-4"
                      />
                      <span>
                        ข้าพเจ้ายินยอมรับข้อกำหนดการให้บริการและนโยบายความเป็นส่วนตัว (PDPA) สำหรับการประมวลผลข้อมูลการสั่งอาหารและแจ้งเตือนคิวทาง SMS
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-orange-200/80 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(prev => (prev === 'register' ? 'login' : 'register'));
                    setErrorText(null);
                  }}
                  className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 underline font-semibold text-xs cursor-pointer"
                >
                  {authMode === 'register' ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิกใหม่'}
                </button>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    className="px-5 flex items-center gap-2 font-bold"
                  >
                    {isSubmitting ? (
                      <span>กำลังดำเนินการ...</span>
                    ) : authMode === 'register' ? (
                      <>
                        <span>ถัดไป: ยืนยัน OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>เข้าสู่ระบบ</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}

        {/* ======================================================== */}
        {/* STEP 2: SMS & OTP VERIFICATION */}
        {/* ======================================================== */}
        {currentStep === 'otp_verification' && (
          <form onSubmit={handleVerifyOtpSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
            {/* Step Banner */}
            <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200/90 dark:bg-orange-950/20 dark:border-orange-500/30 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-orange-500 text-white shrink-0 shadow-xs">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 dark:text-zinc-100 text-xs">
                    เข้าสู่ระบบครั้งแรก: ยืนยันรหัส OTP ทาง SMS
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-200 text-orange-900 dark:bg-orange-500/20 dark:text-orange-400">
                    ขั้นตอนสำคัญ
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 dark:text-zinc-400 leading-relaxed">
                  ระบบได้ส่งรหัส OTP 6 หลัก เพื่อยืนยันเบอร์โทรศัพท์สำหรับรับการแจ้งเตือนสถานะคิวอาหารของคุณ
                </p>
              </div>
            </div>

            {/* Simulated Live SMS Notification Banner (Thai Format) */}
            {lastSentOtp && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 border-2 border-orange-300 dark:from-zinc-900 dark:to-zinc-950 dark:border-orange-500/40 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-orange-200/70 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-orange-600 text-white font-black text-[9px] uppercase tracking-wider">
                      SMS Live
                    </span>
                    <span className="font-bold text-stone-800 dark:text-zinc-200 text-xs">
                      QueueUp SMS Gateway
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-500 dark:text-zinc-400">เมื่อสักครู่</span>
                </div>
                <div className="pt-2 pb-1 space-y-1">
                  <p className="text-stone-700 dark:text-zinc-300 text-xs">
                    [QueueUp] รหัส OTP ของคุณคือ:
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-black tracking-widest text-orange-600 dark:text-orange-400 font-mono">
                      {lastSentOtp}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAutoFillOtp(lastSentOtp)}
                      className="py-1.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>ใส่รหัส {lastSentOtp} อัตโนมัติ</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-500 dark:text-zinc-400">
                    รหัสมีอายุ 5 นาที • ห้ามแจ้งรหัสนี้แก่ผู้อื่นเพื่อความปลอดภัย
                  </p>
                </div>
              </div>
            )}

            {/* Phone Number Display / Edit */}
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 dark:bg-black/50 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-stone-500 dark:text-zinc-400 text-[11px] block">เบอร์โทรศัพท์ที่รับ SMS</span>
                {isEditingPhone ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="tel"
                      value={otpPhone}
                      onChange={e => setOtpPhone(e.target.value)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-orange-400 focus:outline-none bg-white dark:bg-zinc-900 dark:text-zinc-100"
                      placeholder="08x-xxx-xxxx"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPhone(false);
                        triggerSendOtp(otpPhone);
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold cursor-pointer"
                    >
                      ส่ง OTP ใหม่
                    </button>
                  </div>
                ) : (
                  <span className="font-bold text-stone-800 dark:text-zinc-200 text-xs">
                    {otpPhone ? otpService.formatPhoneDisplay(otpPhone) : '089-876-5432'}
                  </span>
                )}
              </div>
              {!isEditingPhone && (
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="text-orange-600 hover:text-orange-700 dark:text-orange-400 text-xs font-semibold underline cursor-pointer"
                >
                  เปลี่ยนเบอร์
                </button>
              )}
            </div>

            {/* 6 Digit OTP Input Boxes */}
            <div className="space-y-2 pt-2">
              <label className="block text-stone-800 dark:text-zinc-300 font-semibold text-center">
                กรอกรหัสยืนยัน OTP 6 หลัก
              </label>
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => { otpInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={e => handleOtpDigitChange(index, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(index, e)}
                    className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black font-mono rounded-2xl bg-white border-2 border-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-stone-900 dark:bg-black dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-orange-500 transition-all outline-none"
                  />
                ))}
              </div>
            </div>

            {/* Password Set Field (for first-time Google sign-in without a prior password) */}
            {(!pendingUser?.password && pendingUser?.authProvider === 'google') && (
              <div className="pt-2">
                <label className="block text-stone-800 dark:text-zinc-300 font-semibold mb-1">
                  กำหนดรหัสผ่าน (Password สำหรับเข้าใช้งานครั้งต่อไป) *
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 absolute left-3.5 top-3 text-stone-400 dark:text-zinc-500" />
                  <input
                    type="password"
                    value={otpPassword}
                    onChange={e => setOtpPassword(e.target.value)}
                    placeholder="กำหนดรหัสผ่านอย่างน้อย 6 ตัวอักษร"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100 text-xs"
                  />
                </div>
              </div>
            )}

            {/* OTP Error Banner */}
            {otpError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{otpError}</span>
              </div>
            )}

            {/* Resend Cooldown & Timer */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-stone-500 dark:text-zinc-400">
                {isCountingDown
                  ? `ขอรหัสใหม่ได้ใน ${otpCountdown} วินาที...`
                  : 'ยังไม่ได้รับรหัส OTP หรือรหัสหมดอายุ?'}
              </span>
              <button
                type="button"
                disabled={isCountingDown}
                onClick={() => triggerSendOtp(otpPhone)}
                className="text-orange-600 hover:text-orange-700 dark:text-orange-400 font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCountingDown ? 'animate-spin' : ''}`} />
                <span>ขอรหัส OTP ใหม่อีกครั้ง</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center justify-between border-t border-orange-200/80 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('auth_form');
                  setOtpDigits(['', '', '', '', '', '']);
                  setOtpError(null);
                }}
                className="text-stone-500 hover:text-stone-700 dark:hover:text-zinc-300 font-semibold text-xs cursor-pointer"
              >
                ← ย้อนกลับ
              </button>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || otpDigits.join('').length < 6}
                className="px-6 flex items-center gap-2 font-bold"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังตรวจสอบ OTP...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>ยืนยัน OTP และเริ่มสั่งอาหาร</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* STEP 3: POPUP FALLBACK (IF BROWSER BLOCKS GOOGLE POPUP) */}
        {/* ======================================================== */}
        {currentStep === 'popup_fallback' && (
          <div className="p-5 sm:p-6 space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-stone-800 dark:bg-amber-950/20 dark:border-amber-500/30 dark:text-zinc-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-xs block text-amber-900 dark:text-amber-400">
                  แจ้งเตือนหน้าต่างการเชื่อมต่อ Google
                </span>
                <p className="text-[11px] leading-relaxed">
                  {popupErrorHint || 'ระบบตรวจพบว่าหน้าต่าง Pop-up ถูกบล็อกโดยเบราว์เซอร์ คุณสามารถเลือกดำเนินการต่อด้วยบัญชี Google ด้านล่าง หรือกรอกอีเมลของคุณ'}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <span className="font-bold text-stone-800 dark:text-zinc-200 block">
                เลือกบัญชี Google เพื่อดำเนินการต่อและเข้าสู่ขั้นตอนยืนยัน OTP:
              </span>

              {/* Account 1: hi00000087@gmail.com */}
              <button
                type="button"
                onClick={() => handleGoogleSignInClick('hi00000087@gmail.com')}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-orange-50/70 border border-orange-200 text-left transition-all dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 cursor-pointer shadow-xs active:scale-[0.99]"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
                  H
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-stone-900 dark:text-zinc-100 truncate">Kritapas (hi00000087)</p>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate">hi00000087@gmail.com</p>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-500/25 dark:text-purple-300 font-bold shrink-0">
                  แอดมิน (Admin)
                </span>
              </button>

              {/* Custom Google Email input */}
              <div className="pt-2">
                <label className="block text-stone-700 dark:text-zinc-300 font-semibold mb-1 text-[11px]">
                  หรือระบุอีเมล Google อื่นของคุณ:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={customGoogleEmail}
                    onChange={e => setCustomGoogleEmail(e.target.value)}
                    placeholder="user.campus@gmail.com"
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customGoogleEmail && customGoogleEmail.includes('@')) {
                        handleGoogleSignInClick(customGoogleEmail);
                      } else {
                        setErrorText('กรุณากรอกอีเมลให้ถูกต้อง');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-xs active:scale-95"
                  >
                    ดำเนินการต่อ
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-orange-200/80 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('auth_form');
                  setPopupErrorHint(null);
                }}
                className="text-stone-500 hover:text-stone-700 dark:hover:text-zinc-300 font-semibold text-xs cursor-pointer"
              >
                ← ย้อนกลับไปหน้าเข้าสู่ระบบ
              </button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleGoogleSignInClick()}
                className="flex items-center gap-1.5 text-xs font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ลองเปิด Pop-up อีกครั้ง</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
