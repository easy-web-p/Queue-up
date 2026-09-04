import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { reviewVendorApproval } from '../services/campusWalletService';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { ShieldCheck, Check, X, Clock, AlertCircle, ArrowLeft, Store, UserCheck, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { VendorApprovalRequest } from '../types/campus';

export default function VendorApprovalPanel() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<VendorApprovalRequest[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<VendorApprovalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'vendor_approvals'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as VendorApprovalRequest[];
      setRequests(items);
    });

    return () => unsubscribe();
  }, []);

  const filteredRequests = requests.filter((r) => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  });

  const handleApprove = async (req: VendorApprovalRequest) => {
    setIsProcessing(true);
    setActionMessage(null);
    try {
      const res = await reviewVendorApproval(req.id, 'APPROVED');
      setActionMessage({ type: 'success', text: res.message || `อนุมัติร้าน "${req.shopName}" สำเร็จ` });
      setSelectedRequest(null);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการอนุมัติ' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (req: VendorApprovalRequest) => {
    setIsProcessing(true);
    setActionMessage(null);
    try {
      const res = await reviewVendorApproval(req.id, 'REJECTED', rejectionReason);
      setActionMessage({ type: 'success', text: res.message || `ปฏิเสธร้าน "${req.shopName}" เรียบร้อยแล้ว` });
      setSelectedRequest(null);
      setRejectionReason('');
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#16100C] text-white font-['IBM_Plex_Sans_Thai'] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#241C16]/95 backdrop-blur border-b border-[#FF7A1A]/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/admin" className="p-2 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-[#FF7A1A] hover:bg-[#FF7A1A]/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#FF7A1A]" />
              ศูนย์ควบคุมการอนุมัติร้านค้านักเรียน (Staff Approval Panel)
            </h1>
            <p className="text-xs text-[#9CA3AF]">ระบบพิจารณาคำขอเปิดร้านสำหรับอาจารย์และผู้ดูแลโรงอาหาร</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {actionMessage && (
          <div className={`mb-6 p-4 rounded-2xl text-sm font-semibold ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
              : 'bg-red-950/40 text-red-300 border border-red-500/30'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex space-x-2 border-b border-white/10 pb-4 mb-6">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-['Kanit'] transition-all ${
                filter === tab
                  ? 'bg-[#FF7A1A] text-white shadow-lg shadow-orange-950/30'
                  : 'bg-[#241C16] text-[#E5E7EB] hover:border-[#FF7A1A]/30 border border-transparent'
              }`}
            >
              {tab === 'PENDING' && 'รอการอนุมัติ'}
              {tab === 'APPROVED' && 'อนุมัติแล้ว'}
              {tab === 'REJECTED' && 'ปฏิเสธแล้ว'}
              {tab === 'ALL' && 'ทั้งหมด'} ({requests.filter(r => tab === 'ALL' ? true : r.status === tab).length})
            </button>
          ))}
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center bg-[#241C16] border border-[#FF7A1A]/20 rounded-3xl">
            <Clock className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-bold font-['Kanit'] text-[#E5E7EB]">ไม่พบรายการคำขอในหมวดหมู่นี้</h3>
            <p className="text-xs text-[#9CA3AF] mt-1">คำขอเปิดร้านค้านักเรียนใหม่จะแสดงที่นี่โดยอัตโนมัติ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRequests.map((req) => (
              <div
                key={req.id}
                className="bg-[#241C16] border border-[#FF7A1A]/20 hover:border-[#FF7A1A]/50 rounded-3xl p-6 shadow-xl transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#FF7A1A] font-['JetBrains_Mono']">
                        {req.studentCode || 'N/A'}
                      </span>
                      <h3 className="text-lg font-bold font-['Kanit'] text-white mt-1">
                        {req.shopName}
                      </h3>
                      <p className="text-xs text-[#E5E7EB] flex items-center gap-1 mt-0.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#9CA3AF]" />
                        {req.studentName} ({req.class || 'N/A'})
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-['JetBrains_Mono'] ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : req.status === 'REJECTED'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                    <p className="text-xs text-[#9CA3AF]">
                      <span className="font-semibold text-[#E5E7EB]">โซนที่ขอ:</span> {req.requestedZone}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      <span className="font-semibold text-[#E5E7EB]">หมวดหมู่:</span> {req.productCategories?.join(', ')}
                    </p>
                    {req.menuPreview && req.menuPreview.length > 0 && (
                      <div className="mt-2 bg-[#16100C] p-3 rounded-xl border border-white/5">
                        <span className="text-[11px] font-bold text-[#FF7A1A] flex items-center gap-1 mb-1">
                          <Utensils className="w-3 h-3" /> ตัวอย่างเมนู:
                        </span>
                        <ul className="text-xs text-[#E5E7EB] space-y-1">
                          {req.menuPreview.slice(0, 3).map((m, idx) => (
                            <li key={idx} className="flex justify-between">
                              <span>• {m.name}</span>
                              <span className="font-['JetBrains_Mono'] text-amber-400">{m.price} ฿</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {req.status === 'PENDING' && (
                  <div className="mt-6 flex gap-2 pt-4 border-t border-white/10">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors"
                    >
                      <Check className="w-4 h-4" /> อนุมัติ
                    </button>
                    <button
                      onClick={() => setSelectedRequest(req)}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 bg-red-950/40 border border-red-500/30 hover:bg-red-900/60 text-red-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors"
                    >
                      <X className="w-4 h-4" /> ปฏิเสธ
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Rejection Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#241C16] border border-[#FF7A1A]/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold font-['Kanit'] text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                ระบุเหตุผลในการปฏิเสธคำขอ
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                ร้านค้า: <strong className="text-white">{selectedRequest.shopName}</strong> ({selectedRequest.studentName})
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="เช่น สินค้าประเภทเครื่องดื่มชูกำลังไม่อนุญาตในโรงเรียน หรือเมนูมีความเสี่ยงต่ออาการแพ้สูง..."
                rows={3}
                className="w-full px-4 py-3 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-white text-xs focus:outline-none focus:border-[#FF7A1A]"
              />
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleReject(selectedRequest)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl"
                >
                  ยืนยันการปฏิเสธ
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
