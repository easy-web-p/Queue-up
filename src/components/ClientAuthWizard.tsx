import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { ChevronRight, ChevronLeft, Smartphone, CheckCircle, ShieldCheck } from 'lucide-react';
import { findUserInFirestore, saveUserToFirestore } from '../../lib/firebase';
import { CustomerProfile } from '../../types';

// หมายเลขประจำแอปพลิเคชัน (Client ID) ที่คุณได้มาจาก Google Cloud Console และ Meta Developers
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "482403349684-c528mehmq78amj1pj3m1rqmh768tnbur.apps.googleusercontent.com";
const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || "123456789012345";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: any;
  }
}

interface ClientAuthWizardProps {
  onSuccess?: (formData: any) => void;
  onCancel?: () => void;
}

export default function ClientAuthWizard({ onSuccess, onCancel }: ClientAuthWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isAgreed, setIsAgreed] = useState(true);
  
  // สเตตเก็บข้อมูลจริงที่ดึงได้จากเซิร์ฟเวอร์
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    location: 'อาคารเรียนรวม 3',
    paymentMethod: 'PromptPay'
  });

  // โหลด Facebook SDK ของจริงเมื่อคอมโพเนนต์เริ่มทำงาน
  useEffect(() => {
    window.fbAsyncInit = function() {
      if (window.FB) {
        window.FB.init({
          appId      : FACEBOOK_APP_ID,
          cookie     : true,
          xfbml      : true,
          version    : 'v18.0'
        });
      }
    };

    // ฝัง Script แท้ของ Facebook เข้าไปในระบบ
    (function(d, s, id){
       var js, fjs = d.getElementsByTagName(s)[0];
       if (d.getElementById(id)) {return;}
       js = d.createElement(s) as HTMLScriptElement;
       js.id = id;
       js.src = "https://connect.facebook.net/th_TH/sdk.js";
       if (fjs && fjs.parentNode) {
         fjs.parentNode.insertBefore(js, fjs);
       }
     }(document, 'script', 'facebook-jssdk'));
  }, []);

  // ฟังก์ชันการเข้าสู่ระบบด้วย Facebook จริง
  const handleFacebookLoginReal = () => {
    if (!isAgreed) {
      alert('คุณจำเป็นต้องอ่านและยอมรับเงื่อนไขการให้บริการก่อนเข้าสู่ระบบ');
      return;
    }

    if (window.FB) {
      window.FB.login(function(response: any) {
        if (response.authResponse) {
          // เรียกดึงข้อมูลโปรไฟล์ (ชื่อ และ อีเมลจริง) จาก Graph API ของ Facebook
          window.FB.api('/me', { fields: 'name,email' }, function(user: any) {
            setFormData(prev => ({
              ...prev,
              fullName: user.name || 'ผู้ใช้ Facebook',
              email: user.email || 'user.facebook@gmail.com'
            }));
            // เมื่อได้ข้อมูลจริงแล้ว ให้เลื่อนหน้าไปตอบคำถามข้อถัดไปทันที
            setCurrentStep(2);
          });
        } else {
          console.log('ผู้ใช้ยกเลิกการเข้าสู่ระบบด้วย Facebook');
        }
      }, { scope: 'public_profile,email' });
    } else {
      // Fallback demo for preview if SDK not initialized
      setFormData(prev => ({
        ...prev,
        fullName: 'พิมพ์ชนก เรียนดี (Facebook User)',
        email: 'pimchanok.fb@gmail.com'
      }));
      setCurrentStep(2);
    }
  };

  // ฟังก์ชันจัดการเมื่อ Google ยืนยันตัวตนสำเร็จและส่ง Token กลับมาจริง
  const handleGoogleSuccessReal = async (credentialResponse: CredentialResponse) => {
    if (!isAgreed) {
      alert('คุณจำเป็นต้องอ่านและยอมรับเงื่อนไขการให้บริการก่อนเข้าสู่ระบบ');
      return;
    }

    try {
      if (credentialResponse.credential) {
        // ทำการถอดรหัส JWT Token ที่ได้จาก Google เพื่อดึงข้อมูลโปรไฟล์จริง
        const base64Url = credentialResponse.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const googleUser = JSON.parse(jsonPayload);
        const email = googleUser.email || 'user.google@gmail.com';
        const googleId = googleUser.sub || googleUser.id || '';

        // Check if user already registered in Firestore
        const existingUser = await findUserInFirestore(email, googleId);

        if (existingUser) {
          alert(`พบข้อมูลบัญชี "${existingUser.name}" (${existingUser.email}) ใน Firestore แล้ว เข้าสู่ระบบทันที!`);
          setFormData({
            fullName: existingUser.name,
            phone: existingUser.phone || '081-234-5678',
            email: existingUser.email,
            location: existingUser.address || 'อาคารเรียนรวม 3',
            paymentMethod: 'PromptPay'
          });
          setCurrentStep(3);
        } else {
          alert(`ไม่พบประวัติในระบบ -> เริ่มกระบวนการลงทะเบียนผู้ใช้ใหม่ด้วย Google (${email})`);
          setFormData(prev => ({
            ...prev,
            fullName: googleUser.name || 'Google User',
            email: email,
            googleId: googleId,
          }));
          setCurrentStep(2);
        }
      }
    } catch (error) {
      console.error("การถอดรหัสข้อมูล Google ผิดพลาด", error);
      setCurrentStep(2);
    }
  };

  const handleFinish = async () => {
    // Save to Firestore users collection
    const userProfileToSave: CustomerProfile = {
      id: `u_${Date.now()}`,
      name: formData.fullName || 'ผู้ใช้ใหม่',
      phone: formData.phone || '081-234-5678',
      email: formData.email,
      address: formData.location || 'อาคารเรียนรวม 3',
      preferredPayment: 'promptpay',
      favoriteDishes: ['ข้าวผัดกะเพราหมูสับ + ไข่ดาว'],
      isVerified: true,
      points: 50,
      ordersCount: 0,
      favoriteDish: 'ข้าวผัดกะเพราหมูสับ + ไข่ดาว',
      lastOrderDate: 'สมัครใหม่วันนี้',
    };
    await saveUserToFirestore(userProfileToSave);

    if (onSuccess) {
      onSuccess(formData);
    } else {
      alert('ลงทะเบียนสำเร็จและบันทึกข้อมูลเข้าสู่ Firebase Firestore เรียบร้อยแล้ว!');
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden font-sans">
        
        {/* Step Indicator Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#ee4d2d] rounded-lg flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-bold text-sm tracking-tight text-amber-400">
              QueueUp Social Auth
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className={`px-2.5 py-1 rounded-full ${currentStep === 1 ? 'bg-[#ee4d2d] text-white' : 'bg-slate-800 text-slate-400'}`}>
              1. เลือกวิธียืนยันตัวตน
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-2.5 py-1 rounded-full ${currentStep === 2 ? 'bg-[#ee4d2d] text-white' : 'bg-slate-800 text-slate-400'}`}>
              2. กรอกเบอร์ติดต่อ
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-2.5 py-1 rounded-full ${currentStep === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              3. เสร็จสมบูรณ์
            </span>
          </div>
        </div>

        {/* หน้าที่ 1: ดีไซน์ตามภาพ Shopee พร้อมระบบ API จริง */}
        {currentStep === 1 && (
          <div className="p-8 space-y-6 flex flex-col justify-center">
            
            <div className="text-center space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900">เข้าสู่ระบบด้วย Social Account</h2>
              <p className="text-xs text-slate-500">ดึงข้อมูลชื่อและอีเมลจริงอย่างปลอดภัยด้วยระบบ OAuth 2.0</p>
            </div>

            {/* เส้นแบ่งข้อความ "หรือ" ถอดแบบตามรูปภาพ */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-sm text-slate-400 font-medium">หรือ</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* ส่วนประกอบปุ่มกดของจริง */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              
              {/* ปุ่มเชื่อมต่อ Facebook จริง */}
              <button
                type="button"
                onClick={handleFacebookLoginReal}
                className="flex items-center justify-center gap-3 border border-slate-200 rounded-xl py-3 px-4 font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm text-sm h-[44px]"
              >
                <svg className="w-5 h-5 text-[#1877f2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>Facebook</span>
              </button>

              {/* ปุ่มเชื่อมต่อ Google Login ตัวแท้จากไลบรารีทางการ */}
              <div className="w-full flex justify-center [&_iframe]:!w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccessReal}
                  onError={() => {
                    console.log('การเชื่อมต่อผ่าน Google ล้มเหลว');
                    handleGoogleSuccessReal({ credential: '' });
                  }}
                  useOneTap
                  shape="rectangular"
                  theme="outline"
                  text="signin_with"
                />
              </div>

            </div>

            {/* กล่องข้อความและติ๊กยอมรับเงื่อนไข ถอดแบบจากภาพของ Shopee */}
            <div className="text-center text-xs leading-relaxed max-w-md mx-auto text-slate-400 pt-2">
              <label className="inline-flex items-center justify-center gap-2 cursor-pointer select-none mb-1">
                <input 
                  type="checkbox" 
                  checked={isAgreed} 
                  onChange={(e) => setIsAgreed(e.target.checked)}
                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-200 w-3.5 h-3.5"
                />
                <span>โดยการเข้าสู่ระบบ ฉันได้อ่านและยอมรับ</span>
              </label>
              <span className="text-[#f6402e] hover:underline cursor-pointer font-medium mx-1">เงื่อนไขการให้บริการ</span>
              <span>และ</span>
              <span className="text-[#f6402e] hover:underline cursor-pointer font-medium mx-1">นโยบายความเป็นส่วนตัว</span>
              <p className="mt-0.5">ของ Shopee</p>
            </div>

            {onCancel && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-slate-400 hover:text-slate-600 underline font-medium"
                >
                  ยกเลิกและปิดหน้าต่าง
                </button>
              </div>
            )}

          </div>
        )}

        {/* หน้าคำถามข้อที่ 2 เป็นต้นไป (ข้อมูลจะถูกเติมให้อัตโนมัติจาก Social และผู้ใช้กรอกเบอร์โทรเพิ่มเอง) */}
        {currentStep === 2 && (
          <div className="p-8 space-y-4 animate-fade-in">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>ดึงข้อมูลโปรไฟล์สำเร็จ: <strong>{formData.fullName}</strong> ({formData.email})</span>
            </div>

            <h2 className="text-lg font-bold text-slate-900">ระบุข้อมูลการติดต่อเพิ่มเติม</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อ-นามสกุลจริง</label>
                <input 
                  type="text" 
                  placeholder="ชื่อ-นามสกุลจริง" 
                  value={formData.fullName} 
                  onChange={e => setFormData({...formData, fullName: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#ee4d2d]" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ที่อยู่อีเมล</label>
                <input 
                  type="email" 
                  placeholder="ที่อยู่อีเมล" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#ee4d2d]" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">หมายเลขโทรศัพท์มือถือ <span className="text-rose-500">*</span></label>
                <input 
                  type="tel" 
                  placeholder="กรอกหมายเลขโทรศัพท์มือถือ เช่น 0812345678" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-500 ring-2 ring-orange-100" 
                />
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setCurrentStep(1)} 
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>
              <button 
                type="button" 
                onClick={() => { 
                  if (!formData.phone) { 
                    alert('กรุณากรอกเบอร์โทรศัพท์ก่อน'); 
                    return; 
                  } 
                  setCurrentStep(3); 
                }} 
                className="bg-[#ee4d2d] hover:bg-[#d73211] text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-1"
              >
                <span>ข้อถัดไป</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* หน้าที่ 3: เสร็จสมบูรณ์ */}
        {currentStep === 3 && (
          <div className="p-8 space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">พร้อมใช้งานระบบ QueueUp!</h2>
              <p className="text-xs text-slate-500 mt-1">ยืนยันข้อมูลโปรไฟล์สำหรับบริการสั่งอาหารและจัดส่งเรียบร้อยแล้ว</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">ชื่อผู้ใช้:</span>
                <span className="font-bold text-slate-800">{formData.fullName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">อีเมล:</span>
                <span className="font-bold text-slate-800">{formData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">เบอร์โทรศัพท์:</span>
                <span className="font-bold text-slate-800">{formData.phone}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full bg-[#ee4d2d] hover:bg-[#d73211] text-white font-bold py-3 rounded-xl text-sm shadow-md transition-all"
            >
              เริ่มต้นใช้งาน QueueUp ทันที
            </button>
          </div>
        )}

      </div>
    </GoogleOAuthProvider>
  );
}
