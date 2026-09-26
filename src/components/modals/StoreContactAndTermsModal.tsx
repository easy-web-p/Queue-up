import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Store, StoreExchangeTerms, StoreContactChannels } from '../../types';
import {
  X,
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  ShieldAlert,
  AlertTriangle,
  CreditCard,
  FileText,
  CheckCircle2,
  ExternalLink,
  Store as StoreIcon,
  HelpCircle,
  QrCode,
  Key
} from 'lucide-react';
import { Button } from '../ui/Button';

interface StoreContactAndTermsModalProps {
  store: Store | null;
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'contact';
}

export const StoreContactAndTermsModal: React.FC<StoreContactAndTermsModalProps> = ({
  store,
  isOpen,
  onClose,
  defaultTab = 'terms'
}) => {
  const { openStoreChat, addToast } = useQueue();
  const [activeTab, setActiveTab] = useState<'terms' | 'contact'>(defaultTab);

  if (!isOpen || !store) return null;

  const contact: StoreContactChannels = store.contactChannels || {
    phone: store.ownerPhone || '082-345-6789',
    lineId: `@${store.id.replace('-', '')}`,
    facebookPage: store.name,
    pickupCounterLocation: `อาคารโรงอาหารกลาง บูธ ${store.id.toUpperCase()}`,
    inAppChatEnabled: true,
    staffOnDutyName: store.ownerName || 'ผู้จัดการสาขา / พนักงานหน้าร้าน'
  };

  const terms: StoreExchangeTerms = store.exchangeTerms || {
    pickupWindowMinutes: 15,
    pickupPolicy: 'เมื่ออาหารพร้อมรับ (READY) กรุณาแสดงบัตรคิวดิจิทัลและรหัส PIN 4 หลักที่เคาน์เตอร์เพื่อแลกรับอาหาร',
    cancellationPolicy: 'ยกเลิกหรือแก้ไขได้เฉพาะก่อนร้านเริ่มปรุง (PREPARING) เนื่องจากเป็นอาหารปรุงสดใหม่ตามสั่งทุกจาน',
    paymentTerms: 'รองรับ PromptPay QR สแกนจ่าย, กระเป๋าเงิน Campus Wallet และชำระสดที่หน้าร้าน (PAY_AT_STORE)',
    allergenWarningNotice: 'หากมีประวัติแพ้อาหารต้องระบุในหมายเหตุพิเศษ หรือส่งข้อความแชทแจ้งทางร้านก่อนยืนยัน',
    disputeContactInfo: 'หากพบข้อผิดพลาดหรือต้องการความช่วยเหลือ ติดต่อเคาน์เตอร์ร้านโดยตรง หรือส่งข้อความในระบบแชท',
    termsVersion: 'v2.1',
    lastUpdated: '2026-09-20'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white border border-orange-200/90 shadow-2xl overflow-hidden text-stone-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-orange-100 dark:border-zinc-800/80 flex items-center justify-between bg-orange-50/50 dark:bg-zinc-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={store.logo || store.image}
              alt={store.name}
              className="w-11 h-11 rounded-2xl object-cover border border-orange-300 dark:border-zinc-700 shadow-xs shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-stone-900 dark:text-white truncate">
                  {store.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                  มุมมองร้านค้า
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-zinc-400 truncate">
                ช่องทางการติดต่อผู้ซื้อ-ผู้ขาย & เงื่อนไขการแลกเปลี่ยน
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-orange-100 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 px-5 pt-2">
          <button
            onClick={() => setActiveTab('terms')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'terms'
                ? 'border-orange-600 text-orange-600 dark:border-orange-400 dark:text-orange-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>เงื่อนไขการแลกเปลี่ยนของร้านค้า</span>
          </button>

          <button
            onClick={() => setActiveTab('contact')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'contact'
                ? 'border-orange-600 text-orange-600 dark:border-orange-400 dark:text-orange-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>ช่องทางการติดต่อกับร้าน ({store.name})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {activeTab === 'terms' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 dark:bg-amber-950/20 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong>ประกาศจากร้านค้า:</strong> เงื่อนไขการแลกเปลี่ยนนี้ถูกกำหนดโดยร้าน{' '}
                  <span className="font-bold underline">{store.name}</span> เพื่อความรวดเร็ว
                  ความปลอดภัยทางสุขอนามัย และความโปร่งใสระหว่างผู้ซื้อกับผู้ขาย
                </p>
              </div>

              {/* Terms Items List */}
              <div className="space-y-3 text-xs sm:text-sm">
                {/* 1. Handover & Exchange PIN */}
                <div className="p-4 rounded-2xl border border-stone-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <div className="flex items-center gap-2.5 font-bold text-stone-900 dark:text-zinc-100 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 flex items-center justify-center text-xs shrink-0">
                      1
                    </span>
                    <Key className="w-4 h-4 text-orange-600" />
                    <span>เงื่อนไขการรับมอบอาหารและรหัสยืนยัน (Exchange PIN)</span>
                  </div>
                  <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-8">
                    {terms.pickupPolicy} ลูกค้าต้องแสดงรหัส PIN 4 หลักหรือหน้าจอบัตรคิวที่ระบุสถานะ "พร้อมรับอาหาร"
                    แก่พนักงานหน้าเคาน์เตอร์ เพื่อความปลอดภัยและป้องกันการรับอาหารผิดคิว
                  </p>
                </div>

                {/* 2. Pickup Window */}
                <div className="p-4 rounded-2xl border border-stone-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <div className="flex items-center gap-2.5 font-bold text-stone-900 dark:text-zinc-100 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 flex items-center justify-center text-xs shrink-0">
                      2
                    </span>
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span>ระยะเวลารอรับอาหาร ({terms.pickupWindowMinutes} นาที)</span>
                  </div>
                  <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-8">
                    เพื่อรักษาคุณภาพความร้อนและความสดใหม่ ลูกค้าต้องมารับอาหารภายใน{' '}
                    <strong className="text-orange-600 dark:text-orange-400">
                      {terms.pickupWindowMinutes} นาที
                    </strong>{' '}
                    หลังจากได้รับแจ้งเตือน หากเกินเวลาดังกล่าว ทางร้านขอสงวนสิทธิ์ในการจัดการตามมาตรฐานความปลอดภัยอาหาร
                  </p>
                </div>

                {/* 3. Cancellation & Refund */}
                <div className="p-4 rounded-2xl border border-stone-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <div className="flex items-center gap-2.5 font-bold text-stone-900 dark:text-zinc-100 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 flex items-center justify-center text-xs shrink-0">
                      3
                    </span>
                    <ShieldAlert className="w-4 h-4 text-orange-600" />
                    <span>เงื่อนไขการยกเลิกและการขอคืนเงิน</span>
                  </div>
                  <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-8">
                    {terms.cancellationPolicy}
                  </p>
                </div>

                {/* 4. Payment Modes */}
                <div className="p-4 rounded-2xl border border-stone-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <div className="flex items-center gap-2.5 font-bold text-stone-900 dark:text-zinc-100 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 flex items-center justify-center text-xs shrink-0">
                      4
                    </span>
                    <CreditCard className="w-4 h-4 text-orange-600" />
                    <span>เงื่อนไขการชำระเงิน</span>
                  </div>
                  <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-8">
                    {terms.paymentTerms}
                  </p>
                </div>

                {/* 5. Allergen Warning */}
                <div className="p-4 rounded-2xl border border-stone-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <div className="flex items-center gap-2.5 font-bold text-stone-900 dark:text-zinc-100 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 flex items-center justify-center text-xs shrink-0">
                      5
                    </span>
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>ข้อตกลงการแจ้งแพ้อาหาร</span>
                  </div>
                  <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-8">
                    {terms.allergenWarningNotice}
                  </p>
                </div>

                {/* 6. Dispute Resolution */}
                <div className="p-4 rounded-2xl border border-stone-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                  <div className="flex items-center gap-2.5 font-bold text-stone-900 dark:text-zinc-100 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 flex items-center justify-center text-xs shrink-0">
                      6
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>การระงับข้อพิพาทและการติดต่อโดยตรง</span>
                  </div>
                  <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-8">
                    {terms.disputeContactInfo}
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-stone-400 dark:text-zinc-500 text-right">
                เวอร์ชันเงื่อนไข: {terms.termsVersion} • อัปเดตล่าสุด: {terms.lastUpdated}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-orange-50/80 border border-orange-200/90 dark:bg-zinc-800/80 dark:border-zinc-700 text-xs text-stone-700 dark:text-zinc-300">
                ช่องทางเหล่านี้เป็นช่องทางติดต่อทางการของร้าน <strong>{store.name}</strong> โดยตรง
                สำหรับประสานงานระหว่างผู้ซื้อและผู้ขาย
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Phone Call */}
                <div className="p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-zinc-400">
                      <Phone className="w-4 h-4 text-orange-600" />
                      <span>เบอร์โทรศัพท์ติดต่อร้าน</span>
                    </div>
                    <div className="text-lg font-black text-stone-900 dark:text-white mt-1">
                      {contact.phone}
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">
                      ผู้ดูแลประจำร้าน: {contact.staffOnDutyName}
                    </p>
                  </div>
                  <a
                    href={`tel:${contact.phone.replace(/-/g, '')}`}
                    className="mt-3 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>โทรออกหาร้านค้า</span>
                  </a>
                </div>

                {/* 2. Direct In-App Chat */}
                <div className="p-4 rounded-2xl border border-orange-300 dark:border-orange-500/40 bg-orange-50/40 dark:bg-orange-950/20 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-orange-800 dark:text-orange-300">
                      <MessageSquare className="w-4 h-4 text-orange-600" />
                      <span>แชทตรงกับร้าน (ผู้ซื้อ & ผู้ขาย)</span>
                    </div>
                    <div className="text-sm font-bold text-stone-900 dark:text-white mt-1">
                      สนทนากับพนักงานร้านค้าสด
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-zinc-400 mt-1">
                      สอบถามสถานะคิว แจ้งความต้องการพิเศษ หรือขอเปลี่ยนเวลา
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onClose();
                      openStoreChat(store);
                    }}
                    className="mt-3 flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>เปิดหน้าต่างแชทกับร้าน</span>
                  </Button>
                </div>

                {/* 3. LINE Official */}
                {contact.lineId && (
                  <div className="p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-zinc-400">
                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">
                          L
                        </span>
                        <span>LINE Official ID</span>
                      </div>
                      <div className="text-base font-bold text-stone-900 dark:text-white mt-1 font-mono">
                        {contact.lineId}
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">
                        ติดตามข่าวสารและโปรโมชันรายวัน
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(contact.lineId || '');
                        addToast('คัดลอก LINE ID สำเร็จ', contact.lineId, 'success');
                      }}
                      className="mt-3 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold transition-all cursor-pointer dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>คัดลอก LINE ID</span>
                    </button>
                  </div>
                )}

                {/* 4. Pickup Counter Location */}
                <div className="p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-zinc-400">
                      <MapPin className="w-4 h-4 text-orange-600" />
                      <span>จุดเคาน์เตอร์รับอาหารหน้าร้าน</span>
                    </div>
                    <div className="text-sm font-bold text-stone-900 dark:text-white mt-1">
                      {contact.pickupCounterLocation}
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">
                      {store.address}
                    </p>
                  </div>
                  <div className="mt-3 text-xs text-stone-500 dark:text-zinc-400 flex items-center gap-1">
                    <StoreIcon className="w-3.5 h-3.5 text-stone-400" />
                    <span>เวลารอเฉลี่ย ~{store.averageWaitMinutes} นาที</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-orange-100 dark:border-zinc-800 flex items-center justify-between bg-stone-50 dark:bg-zinc-950">
          <div className="text-xs text-stone-500 dark:text-zinc-400">
            ร้านค้า: <strong className="text-stone-800 dark:text-stone-200">{store.name}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              ปิด
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                openStoreChat(store);
              }}
              className="flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>แชทติดต่อร้าน</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
