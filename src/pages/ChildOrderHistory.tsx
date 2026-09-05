import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchParentChildLinks } from '../services/campusWalletService';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { History, ArrowLeft, Clock, Utensils, AlertCircle, ShoppingBag, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ParentChildLink } from '../types/campus';

interface OrderItem {
  name: string;
  quantity: number;
  subtotal: number;
  customNotes?: string;
  selectedModifiers?: Array<{ name: string; priceModifier?: number }>;
}

interface ChildOrder {
  id: string;
  queueNumber: string;
  storeId: string;
  storeName?: string;
  pickupTime: string;
  pickupDate?: string;
  status: string;
  totalAmount: number;
  paymentMode?: string;
  items: OrderItem[];
  createdAt?: any;
}

export default function ChildOrderHistory() {
  const { user, currentUser } = useAuth();
  const [children, setChildren] = useState<ParentChildLink[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentChildLink | null>(null);
  const [orders, setOrders] = useState<ChildOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const uid = currentUser?.uid || user?.uid;

  useEffect(() => {
    if (!uid) return;
    async function loadData() {
      setIsLoading(true);
      try {
        const links = await fetchParentChildLinks(uid);
        setChildren(links);
        if (links.length > 0) {
          setSelectedChild(links[0]);
        }
      } catch (err) {
        console.error('[ChildOrderHistory] Error loading children:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [uid]);

  useEffect(() => {
    if (!selectedChild) return;
    async function loadOrders() {
      setIsLoading(true);
      try {
        // Query child's orders by studentId or userId
        const q = query(
          collection(db, 'orders'),
          where('studentId', '==', selectedChild.studentId),
          limit(30)
        );
        const snap = await getDocs(q);
        const ords = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ChildOrder[];

        // Sort descending by createdAt or id
        ords.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setOrders(ords);
      } catch (err) {
        console.error('[ChildOrderHistory] Error loading orders:', err);
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadOrders();
  }, [selectedChild]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY_FOR_PICKUP':
      case 'READY':
        return <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold">พร้อมรับอาหาร</span>;
      case 'PREPARING':
        return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold">กำลังปรุงอาหาร</span>;
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-bold">ยืนยันคิวแล้ว</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-full text-xs font-bold">รับอาหารแล้ว</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs font-bold">ยกเลิกแล้ว</span>;
      default:
        return <span className="px-2.5 py-1 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full text-xs font-bold">รอการยืนยัน</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#16100C] text-white font-['IBM_Plex_Sans_Thai'] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#241C16]/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/guardian/dashboard" className="p-2 bg-[#16100C] border border-white/10 rounded-xl text-[#FF7A1A] hover:bg-[#FF7A1A]/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-white flex items-center gap-2">
              <History className="w-5 h-5 text-[#FF7A1A]" />
              ประวัติการกินย้อนหลัง (Child Order History)
            </h1>
            <p className="text-xs text-[#9CA3AF]">ตรวจสอบรายการอาหารและโภชนาการที่บุตรหลานรับประทานจริงในโรงเรียน</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        {/* Child Selector */}
        {children.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`px-4 py-2.5 rounded-2xl font-['Kanit'] text-sm font-semibold transition-all shrink-0 ${
                  selectedChild?.id === child.id
                    ? 'bg-[#FF7A1A] text-white shadow-lg shadow-[#FF7A1A]/20'
                    : 'bg-[#241C16] text-[#9CA3AF] hover:text-white border border-white/10'
                }`}
              >
                {child.studentName} ({child.studentId})
              </button>
            ))}
          </div>
        )}

        {/* Privacy & Zero-Interference Notice */}
        <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 flex items-start gap-3 text-xs text-[#9CA3AF]">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-white">หลักการเคารพความเป็นส่วนตัว (Privacy by Design):</strong> ผู้ปกครองสามารถดูข้อมูลโภชนาการและรายการอาหารที่บุตรหลานสั่งจริงเพื่อดูแลสุขภาพ แต่ระบบจะไม่มีปุ่มแก้ไขหรือยกเลิกออเดอร์แทน เพื่อฝึกวินัยและอิสระในการตัดสินใจของนักเรียน
          </span>
        </div>

        {selectedChild && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="p-12 text-center text-sm text-[#9CA3AF]">กำลังโหลดประวัติการสั่งอาหาร...</div>
            ) : orders.length === 0 ? (
              <div className="p-12 text-center bg-[#241C16] border border-white/10 rounded-3xl text-sm text-[#9CA3AF] space-y-2">
                <Utensils className="w-8 h-8 text-[#FF7A1A] mx-auto opacity-50" />
                <p>ยังไม่มีประวัติการสั่งซื้ออาหารของ {selectedChild.studentName}</p>
              </div>
            ) : (
              orders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-[#241C16] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4 transition-all hover:border-[#FF7A1A]/30"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-[#FF7A1A]/20 text-[#FF7A1A] rounded-xl font-['JetBrains_Mono'] font-bold text-sm">
                        {ord.queueNumber || 'Q---'}
                      </span>
                      <div>
                        <span className="text-xs text-[#9CA3AF] block">
                          วันที่ {ord.pickupDate || 'วันนี้'} • รอบรับอาหาร {ord.pickupTime} น.
                        </span>
                        <span className="text-sm font-bold text-white">
                          {ord.storeName || `ร้านค้า (${ord.storeId})`}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(ord.status)}
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    {ord.items && ord.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-[#16100C] text-[#FF7A1A] font-bold flex items-center justify-center font-['JetBrains_Mono']">
                            {item.quantity}x
                          </span>
                          <span className="text-white font-medium">{item.name}</span>
                          {item.customNotes && (
                            <span className="text-[#9CA3AF] italic">({item.customNotes})</span>
                          )}
                        </div>
                        <span className="font-['JetBrains_Mono'] font-bold text-white">
                          ฿{Number(item.subtotal || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                    <span className="text-[#9CA3AF]">
                      การชำระ: {ord.paymentMode === 'CAMPUS_WALLET' ? '💳 กระเป๋าเงินนักเรียน' : '⚡ สั่งตรง Zero-Payment'}
                    </span>
                    <div className="text-sm font-bold font-['Kanit'] text-[#FF7A1A]">
                      ยอดรวม ฿{Number(ord.totalAmount || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
