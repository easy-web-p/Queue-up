import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Modal } from '../ui/Modal';
import {
  HelpCircle,
  Clock,
  Bell,
  CreditCard,
  Phone,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export const HelpSupportModal: React.FC = () => {
  const { isHelpModalOpen, setIsHelpModalOpen } = useQueue();
  const [activeCategory, setActiveCategory] = useState<'flow' | 'notification' | 'payment' | 'faq'>('flow');

  return (
    <Modal
      isOpen={isHelpModalOpen}
      onClose={() => setIsHelpModalOpen(false)}
      title="💡 ศูนย์ช่วยเหลือและแนะนำการใช้งาน QueueUp"
      size="lg"
    >
      <div className="space-y-4">
        {/* Navigation tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl dark:bg-zinc-900 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveCategory('flow')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'flow'
                ? 'bg-white text-orange-600 shadow-xs dark:bg-zinc-800 dark:text-orange-400'
                : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            🚀 สเต็ปสั่งอาหาร & บัตรคิว
          </button>
          <button
            onClick={() => setActiveCategory('notification')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'notification'
                ? 'bg-white text-orange-600 shadow-xs dark:bg-zinc-800 dark:text-orange-400'
                : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            🔔 การติดตามร้าน & คูปอง
          </button>
          <button
            onClick={() => setActiveCategory('payment')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'payment'
                ? 'bg-white text-orange-600 shadow-xs dark:bg-zinc-800 dark:text-orange-400'
                : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            💳 ชำระเงิน & เงินทอน
          </button>
          <button
            onClick={() => setActiveCategory('faq')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'faq'
                ? 'bg-white text-orange-600 shadow-xs dark:bg-zinc-800 dark:text-orange-400'
                : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            ❓ คำถามที่พบบ่อย (FAQ)
          </button>
        </div>

        {/* Content Section */}
        <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-100 dark:bg-zinc-950 dark:border-zinc-800/80 text-xs">
          {activeCategory === 'flow' && (
            <div className="space-y-3">
              <h4 className="font-black text-stone-900 dark:text-white flex items-center gap-1.5 text-sm">
                <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                ขั้นตอนการสั่งอาหารและการติดตามคิว 4 สเต็ป
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800">
                  <div className="font-bold text-orange-600 dark:text-orange-400 mb-1">1. เลือกร้านและเมนู</div>
                  <p className="text-stone-600 dark:text-zinc-400">
                    เลือกเมนูที่ชอบ ปรับระดับความเผ็ด ความหวาน หรือเลือกท็อปปิ้งพิเศษตามใจชอบ
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800">
                  <div className="font-bold text-orange-600 dark:text-orange-400 mb-1">2. ตรวจสอบตะกร้า & คูปอง</div>
                  <p className="text-stone-600 dark:text-zinc-400">
                    ใส่โค้ดส่วนลดจากแท็บแจ้งเตือน (เช่น LUNCH15) และเลือกเวลารับอาหารทันทีหรือระบุเวลา
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800">
                  <div className="font-bold text-orange-600 dark:text-orange-400 mb-1">3. ชำระเงินไร้รอยต่อ</div>
                  <p className="text-stone-600 dark:text-zinc-400">
                    สแกน PromptPay QR Code ด้วยความแม่นยำระดับสตางค์ หรือเลือกจ่ายเงินสดที่หน้าร้าน
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800">
                  <div className="font-bold text-orange-600 dark:text-orange-400 mb-1">4. รับอาหารเมื่อคิวเสร็จ</div>
                  <p className="text-stone-600 dark:text-zinc-400">
                    หน้าจอจะแจ้งเตือนเมื่ออาหารปรุงเสร็จ พร้อมแสดงบัตรคิวและ QR ให้ร้านสแกนรับของ
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'notification' && (
            <div className="space-y-3">
              <h4 className="font-black text-stone-900 dark:text-white flex items-center gap-1.5 text-sm">
                <Bell className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                ระบบกระดิ่งแจ้งเตือน & การติดตามร้านค้า
              </h4>
              <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
                คลิกที่ปุ่มกระดิ่งแจ้งเตือน <span className="font-bold text-orange-600 dark:text-orange-400">🔔</span> ด้านบน Navbar เพื่อรับข้อมูลอัปเดตแบบเรียลไทม์:
              </p>
              <ul className="space-y-2 text-stone-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>คูปองประจำวัน:</strong> มีโค้ดส่วนลดค่าอาหารสำหรับนักศึกษาและบุคคลทั่วไป กดคัดลอกโค้ดได้ในคลิกเดียว</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>เมนูใหม่จากร้านที่คุณติดตาม:</strong> เมื่อร้านค้าเพิ่มเมนูใหม่ ระบบจะส่งแจ้งเตือนพร้อมรูปภาพและราคาให้ทันที</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>ร้านค้าเปิดให้บริการ:</strong> แจ้งเตือนเมื่อร้านโปรดของคุณเปิดเตาพร้อมรับคิวออเดอร์แรกของวัน</span>
                </li>
              </ul>
            </div>
          )}

          {activeCategory === 'payment' && (
            <div className="space-y-3">
              <h4 className="font-black text-stone-900 dark:text-white flex items-center gap-1.5 text-sm">
                <CreditCard className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                การชำระเงินและความปลอดภัย
              </h4>
              <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
                QueueUp ใช้มาตรฐาน Satang-Precision Cashless ตรวจสอบยอดเงินแบบไม่มีข้อผิดพลาด พร้อมรองรับ PromptPay ธนาคารทุกแห่ง และเงินสด
              </p>
              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800">
                <div className="font-bold text-stone-900 dark:text-white mb-1">การขอเงินคืนหรือยกเลิกคิว</div>
                <p className="text-stone-600 dark:text-zinc-400">
                  หากร้านยังไม่เริ่มปรุงอาหาร คุณสามารถกดยกเลิกออเดอร์ได้จากหน้าบัตรคิว หรือติดต่อร้านค้าโดยตรง
                </p>
              </div>
            </div>
          )}

          {activeCategory === 'faq' && (
            <div className="space-y-2.5">
              <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800">
                <div className="font-bold text-stone-900 dark:text-white">Q: ฉันจะติดตามร้านค้าได้อย่างไร?</div>
                <p className="text-stone-600 dark:text-zinc-400 mt-0.5">
                  A: กดปุ่มไอคอนรูปหัวใจ ❤️ ที่หน้าร้านค้า หรือในหน้าต่างกระดิ่งแจ้งเตือน
                </p>
              </div>
              <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800">
                <div className="font-bold text-stone-900 dark:text-white">Q: โหมดสีอัตโนมัติทำงานอย่างไร?</div>
                <p className="text-stone-600 dark:text-zinc-400 mt-0.5">
                  A: โหมดอัตโนมัติจะตรวจสอบเวลาของเครื่อง ณ เวลานั้น: เวลา 06:00 - 18:00 น. จะเป็นโหมดสว่าง และหลัง 18:00 น. จะปรับเป็นโหมดทึบมืดอัตโนมัติ
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Contact emergency support */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-orange-100/60 dark:bg-zinc-900 border border-orange-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span className="font-bold text-stone-800 dark:text-zinc-200">
              ศูนย์ช่วยเหลือนักศึกษา & โรงอาหาร: โทร 02-579-0113 หรือ Line: @QueueUpSupport
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(false)}
            className="px-3.5 py-1.5 font-bold rounded-lg bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </Modal>
  );
};
