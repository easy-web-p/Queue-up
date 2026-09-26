import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight,
  RefreshCw,
  Landmark,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  Lock
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { Button } from '../ui/Button';

interface MerchantWalletTabProps {
  storeId: string;
  storeName: string;
  addToast: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

export const MerchantWalletTab: React.FC<MerchantWalletTabProps> = ({
  storeId,
  storeName,
  addToast
}) => {
  const [balance, setBalance] = useState<{
    pendingSatang: number;
    onHoldSatang: number;
    availableSatang: number;
    payoutReservedSatang: number;
    totalPaidOutSatang: number;
    pendingBaht: number;
    onHoldBaht: number;
    availableBaht: number;
    payoutReservedBaht: number;
    totalPaidOutBaht: number;
  }>({
    pendingSatang: 0,
    onHoldSatang: 0,
    availableSatang: 0,
    payoutReservedSatang: 0,
    totalPaidOutSatang: 0,
    pendingBaht: 0,
    onHoldBaht: 0,
    availableBaht: 0,
    payoutReservedBaht: 0,
    totalPaidOutBaht: 0
  });

  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmountBaht, setPayoutAmountBaht] = useState<string>('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  const fetchWalletData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [walletData, ledgerData] = await Promise.all([
        apiClient.getMerchantWallet(storeId),
        apiClient.getMerchantLedger(storeId)
      ]);
      if (walletData) setBalance(walletData);
      if (ledgerData) setLedgerEntries(ledgerData);
    } catch (err: any) {
      console.warn('[MerchantWallet] Error loading wallet data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Handle Payout Request
  const handleRequestPayout = async () => {
    const amountNum = parseFloat(payoutAmountBaht);
    if (isNaN(amountNum) || amountNum < 100) {
      addToast('จำนวนเงินไม่ถูกต้อง', 'ยอดถอนขั้นต่ำคือ ฿100.00', 'error');
      return;
    }

    const amountSatang = Math.round(amountNum * 100);
    if (amountSatang > balance.availableSatang) {
      addToast('ยอดเงินไม่เพียงพอ', `คุณมียอดที่ถอนได้ ฿${balance.availableBaht.toFixed(2)}`, 'error');
      return;
    }

    try {
      setSubmittingPayout(true);
      await apiClient.requestMerchantPayout(storeId, amountSatang);
      addToast('ส่งคำขอถอนเงินแล้ว!', `ระบบได้บันทึกคำขอถอนเงิน ฿${amountNum.toFixed(2)} ยอดจะโอนเข้าบัญชีภายใน 1-2 วันทำการ`, 'success');
      setShowPayoutModal(false);
      setPayoutAmountBaht('');
      await fetchWalletData();
    } catch (err: any) {
      addToast('ถอนเงินไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาดในการส่งคำขอถอนเงิน', 'error');
    } finally {
      setSubmittingPayout(false);
    }
  };

  // Trigger Release of Held Funds
  const handleReleaseHeldFunds = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/merchant/wallet/release-held-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId })
      }).then(r => r.json());

      if (res.success) {
        addToast('ตรวจสอบยอดเงินสำเร็จ', `ปล่อยยอดที่พ้นระยะพักตรวจจำนวน ${res.releasedCount} ออเดอร์เรียบร้อย`, 'success');
        await fetchWalletData();
      }
    } catch (err: any) {
      addToast('เกิดข้อผิดพลาด', err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle Stripe Connect Onboarding
  const handleStripeConnect = async () => {
    try {
      setConnectingStripe(true);
      const accountRes = await fetch('/api/merchant/connect/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, storeName })
      }).then(r => r.json());

      if (accountRes.success && accountRes.accountId) {
        const linkRes = await fetch('/api/merchant/connect/onboarding-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: accountRes.accountId })
        }).then(r => r.json());

        if (linkRes.url) {
          window.open(linkRes.url, '_blank');
          addToast('เปิดหน้า Stripe Connect', 'กรุณากรอกข้อมูลบัญชีธนาคารเพื่อรับเงินเข้าบัญชีอัตโนมัติ', 'info');
        }
      }
    } catch (err: any) {
      addToast('เชื่อมต่อ Stripe Connect ไม่สำเร็จ', err.message, 'error');
    } finally {
      setConnectingStripe(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header and Refresh Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-stone-900 dark:text-zinc-100 flex items-center gap-2">
              กระเป๋าเงินร้านค้า (Merchant Wallet)
            </h2>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              จัดการรายได้ ยอดเงินพักตรวจสอบ และคำขอถอนเงินผ่าน Stripe Connect
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWalletData}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>รีเฟรชยอด</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReleaseHeldFunds}
            disabled={refreshing || balance.onHoldSatang === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400"
            title="ปลดล็อกยอดที่ส่งมอบอาหารแล้วและพ้นระยะตรวจสอบ 60 นาที"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ปลดล็อกยอดพ้นกำหนด</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowPayoutModal(true)}
            disabled={balance.availableSatang < 10000}
            className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>ขอถอนเงิน</span>
          </Button>
        </div>
      </div>

      {/* 5 Financial Stage Cards (Enterprise Decoupled Funds) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Pending (ระหว่างทำอาหาร / รอตอบรับ) */}
        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">
              รอดำเนินการ
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-stone-900 dark:text-zinc-100">
              ฿{balance.pendingBaht.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-0.5">
              ออเดอร์กำลังปรุงอาหาร
            </span>
          </div>
        </div>

        {/* 2. On Hold (ส่งมอบอาหารแล้ว อยู่ระหว่างพักตรวจ 1 ชม.) */}
        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">
              พักตรวจสอบ
            </span>
            <div className="w-7 h-7 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
              ฿{balance.onHoldBaht.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-0.5">
              ส่งมอบแล้ว พักตรวจ 1 ชม.
            </span>
          </div>
        </div>

        {/* 3. Available (เงินที่เป็นสิทธิ์ของร้าน ถอนได้ทันที) */}
        <div className="p-4 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              ยอดถอนได้ (AVAILABLE)
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
              ฿{balance.availableBaht.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-800 dark:text-emerald-400 block mt-0.5 font-medium">
              สิทธิ์ของร้าน ถอนออกได้ทันที
            </span>
          </div>
        </div>

        {/* 4. Payout Reserved (กำลังดำเนินการถอน) */}
        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">
              กำลังถอน
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
              ฿{balance.payoutReservedBaht.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-0.5">
              กำลังโอนเข้าบัญชีธนาคาร
            </span>
          </div>
        </div>

        {/* 5. Total Paid Out (ถอนสำเร็จสะสมทั้งหมด) */}
        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">
              ถอนสำเร็จสะสม
            </span>
            <div className="w-7 h-7 rounded-xl bg-stone-500/10 text-stone-600 dark:text-zinc-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-stone-800 dark:text-zinc-200">
              ฿{balance.totalPaidOutBaht.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-0.5">
              ยอดเงินที่ได้รับจริงทั้งหมด
            </span>
          </div>
        </div>
      </div>

      {/* Stripe Connect Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
              Stripe Connect Marketplace Integration
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PromptPay & Auto Payout
              </span>
            </h4>
            <p className="text-xs text-stone-600 dark:text-zinc-400 mt-0.5">
              เชื่อมต่อบัญชีธนาคารร้านค้าเพื่อรับเงินโอนโดยตรง (Separate Charges & Destination Transfers)
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleStripeConnect}
          disabled={connectingStripe}
          className="shrink-0 flex items-center gap-2 text-xs font-bold border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
        >
          <span>ตั้งค่าบัญชีรับเงิน (Stripe Onboarding)</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Double-Entry Financial Ledger History Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
              สมุดบัญชีแยกประเภททางการเงิน (Double-Entry Financial Ledger)
            </h3>
          </div>
          <span className="text-xs text-stone-500 dark:text-zinc-400 font-mono">
            {ledgerEntries.length} รายการธุรกรรม
          </span>
        </div>

        {ledgerEntries.length === 0 ? (
          <div className="py-12 text-center text-stone-400 dark:text-zinc-500 text-sm">
            <p>ยังไม่มีรายการบันทึกทางบัญชี เมื่อมีออเดอร์ใหม่ระบบจะลงบันทึก เดบิต-เครดิต โดยอัตโนมัติ</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-stone-50 dark:bg-zinc-800/60 text-stone-600 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-stone-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-3">เวลา / วันที่</th>
                  <th className="py-3 px-3">ประเภทธุรกรรม</th>
                  <th className="py-3 px-3">บัญชีแยกประเภท (Account)</th>
                  <th className="py-3 px-3">คำอธิบาย</th>
                  <th className="py-3 px-3 text-right">เดบิต (Debit)</th>
                  <th className="py-3 px-3 text-right">เครดิต (Credit)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800 font-mono">
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-stone-500 dark:text-zinc-400 text-[11px]">
                      {new Date(entry.createdAt).toLocaleDateString('th-TH')} {new Date(entry.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {entry.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-stone-800 dark:text-zinc-200">
                      {entry.account}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-stone-600 dark:text-zinc-400 truncate max-w-xs">
                      {entry.description}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {entry.debitSatang > 0 ? `฿${(entry.debitSatang / 100).toFixed(2)}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                      {entry.creditSatang > 0 ? `฿${(entry.creditSatang / 100).toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-600" />
                ส่งคำขอถอนเงินเข้าบัญชี
              </h3>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-500 hover:text-stone-800 dark:hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                ยอดเงินที่ถอนได้ขณะนี้:
              </span>
              <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
                ฿{balance.availableBaht.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
                จำนวนเงินที่ต้องการถอน (บาท)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">฿</span>
                <input
                  type="number"
                  placeholder="100.00"
                  min="100"
                  max={balance.availableBaht}
                  value={payoutAmountBaht}
                  onChange={(e) => setPayoutAmountBaht(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-white font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-stone-500">
                <span>ขั้นต่ำ ฿100.00</span>
                <button
                  onClick={() => setPayoutAmountBaht(String(balance.availableBaht))}
                  className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  ถอนทั้งหมด
                </button>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/70 border border-stone-200 dark:border-zinc-700/80 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-stone-800 dark:text-zinc-200 block">
                  บัญชีธนาคารกสิกรไทย (KBANK)
                </span>
                <span className="text-stone-500 dark:text-zinc-400 text-[11px]">
                  เลขที่บัญชี: xxx-x-xx892-1 ({storeName})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowPayoutModal(false)}
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={handleRequestPayout}
                disabled={submittingPayout || !payoutAmountBaht || parseFloat(payoutAmountBaht) < 100}
              >
                {submittingPayout ? 'กำลังส่งคำขอ...' : 'ยืนยันการถอนเงิน'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
