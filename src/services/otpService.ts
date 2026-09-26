/**
 * OTP & SMS Verification Service
 * Handles 6-digit OTP generation, validation, expiration, and SMS notification simulation
 */

interface ActiveOtpSession {
  phone: string;
  code: string;
  expiresAt: number; // Unix timestamp ms
  createdAt: number;
  attempts: number;
}

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;

class OtpService {
  private activeSessions: Map<string, ActiveOtpSession> = new Map();
  private lastSession: ActiveOtpSession | null = null;

  /**
   * Format phone number to clean Thai format (e.g. 0812345678)
   */
  public normalizePhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Format phone number for pretty display (e.g. 081-234-5678)
   */
  public formatPhoneDisplay(phone: string): string {
    const cleaned = this.normalizePhone(phone);
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
    }
    return phone;
  }

  /**
   * Generate a secure 6-digit numeric OTP code
   */
  public generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via SMS (Simulated real SMS dispatch + real verification logic)
   */
  public sendOtp(phone: string): {
    success: boolean;
    code: string;
    expiresAt: number;
    phone: string;
    formattedPhone: string;
    message: string;
  } {
    const cleanPhone = this.normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      throw new Error('กรุณาระบุหมายเลขโทรศัพท์ 9-10 หลักให้ถูกต้อง');
    }

    const code = this.generateOtpCode();
    const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
    const session: ActiveOtpSession = {
      phone: cleanPhone,
      code,
      expiresAt,
      createdAt: Date.now(),
      attempts: 0
    };

    this.activeSessions.set(cleanPhone, session);
    this.lastSession = session;

    const formattedPhone = this.formatPhoneDisplay(cleanPhone);
    const smsMessage = `[QueueUp] รหัส OTP ของคุณคือ ${code} (มีอายุ 5 นาที) สำหรับยืนยันตัวตนเข้าสู่ระบบ ห้ามแจ้งรหัสนี้แก่ผู้อื่น`;

    console.info(`[SMS Gateway Simulated] Sent to ${formattedPhone}: ${smsMessage}`);

    // Store in localStorage for persistence across reloads during dev/testing
    try {
      localStorage.setItem('queueup_last_otp', JSON.stringify({
        phone: cleanPhone,
        code,
        expiresAt
      }));
    } catch {
      // ignore
    }

    return {
      success: true,
      code,
      expiresAt,
      phone: cleanPhone,
      formattedPhone,
      message: smsMessage
    };
  }

  /**
   * Verify entered 6-digit OTP code against active session
   */
  public verifyOtp(phone: string, inputCode: string): {
    success: boolean;
    error?: string;
  } {
    const cleanPhone = this.normalizePhone(phone);
    const cleanInput = inputCode.trim();

    // Check active memory session first, or fallback to saved session
    let session = this.activeSessions.get(cleanPhone) || this.lastSession;

    if (!session) {
      try {
        const saved = localStorage.getItem('queueup_last_otp');
        if (saved) {
          session = JSON.parse(saved);
        }
      } catch {
        // ignore
      }
    }

    if (!session) {
      return {
        success: false,
        error: 'ไม่พบคำขอรหัส OTP หรือรหัสหมดอายุแล้ว กรุณากดขอรหัสใหม่อีกครั้ง'
      };
    }

    if (Date.now() > session.expiresAt) {
      this.activeSessions.delete(cleanPhone);
      return {
        success: false,
        error: 'รหัส OTP หมดอายุแล้ว (เกิน 5 นาที) กรุณากดขอรหัสใหม่'
      };
    }

    if (session.attempts >= 5) {
      return {
        success: false,
        error: 'คุณกรอกรหัสผิดเกินจำนวนครั้งที่กำหนด กรุณากดขอรหัสใหม่'
      };
    }

    if (session.code !== cleanInput) {
      session.attempts += 1;
      const remainingAttempts = 5 - session.attempts;
      return {
        success: false,
        error: `รหัส OTP ไม่ถูกต้อง (เหลือโอกาสลองอีก ${remainingAttempts} ครั้ง)`
      };
    }

    // Success! Clear used OTP
    this.activeSessions.delete(cleanPhone);
    this.lastSession = null;
    try {
      localStorage.removeItem('queueup_last_otp');
    } catch {
      // ignore
    }

    return { success: true };
  }

  /**
   * Get the most recently sent OTP session for auto-fill or display
   */
  public getLastSession(): ActiveOtpSession | null {
    if (this.lastSession && Date.now() <= this.lastSession.expiresAt) {
      return this.lastSession;
    }
    try {
      const saved = localStorage.getItem('queueup_last_otp');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() <= parsed.expiresAt) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
}

export const otpService = new OtpService();
