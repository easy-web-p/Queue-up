/**
 * 🇹🇭 Zero-Cost EMVCo PromptPay QR Payload Generator
 * Pure Client-side TypeScript - 0% fees, zero external paid APIs, 100% offline-ready.
 * Implements EMVCo QR Code Specification for PromptPay (BOT standard).
 */

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTag(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export function formatPromptPayTarget(target: string): { type: 'PHONE' | 'NATIONAL_ID'; formatted: string } {
  const clean = target.replace(/[^0-9]/g, '');
  if (clean.length === 10 && clean.startsWith('0')) {
    // Thai Mobile: 0812345678 -> 0066812345678 (13 digits)
    return {
      type: 'PHONE',
      formatted: `0066${clean.slice(1)}`
    };
  }
  if (clean.length === 13) {
    // National ID or Tax ID: 13 digits
    return {
      type: 'NATIONAL_ID',
      formatted: clean
    };
  }
  throw new Error('INVALID_PROMPTPAY_TARGET: หมายเลขพร้อมเพย์ต้องเป็นเบอร์โทรศัพท์ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก');
}

export interface GeneratePromptPayParams {
  promptPayId: string; // Phone number or Citizen ID
  amount?: number;     // Amount in THB (e.g. 50.00)
}

/**
 * Generate standard EMVCo PromptPay QR Code string
 * @param params { promptPayId, amount }
 * @returns EMVCo QR string ready for rendering
 */
export function generatePromptPayPayload(params: GeneratePromptPayParams): string {
  const { promptPayId, amount } = params;
  const targetInfo = formatPromptPayTarget(promptPayId);

  // Subtags for Tag 29 (Merchant Account Information)
  const subtag00 = formatTag('00', 'A000000677010111'); // PromptPay AID
  const subtag01 = formatTag(targetInfo.type === 'PHONE' ? '01' : '02', targetInfo.formatted);
  const tag29Value = `${subtag00}${subtag01}`;

  const tag00 = formatTag('00', '01'); // Payload format indicator
  const tag01 = formatTag('01', typeof amount === 'number' && amount > 0 ? '12' : '11'); // 11: Static, 12: Dynamic
  const tag29 = formatTag('29', tag29Value);
  const tag53 = formatTag('53', '764'); // Currency: THB
  const tag58 = formatTag('58', 'TH');  // Country: Thailand

  let amountTag = '';
  if (typeof amount === 'number' && amount > 0) {
    amountTag = formatTag('54', amount.toFixed(2));
  }

  const rawWithoutCrc = `${tag00}${tag01}${tag29}${tag53}${amountTag}${tag58}6304`;
  const checksum = crc16(rawWithoutCrc);

  return `${rawWithoutCrc}${checksum}`;
}

export default generatePromptPayPayload;
