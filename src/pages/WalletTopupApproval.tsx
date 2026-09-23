/**
 * 💰 WalletTopupApproval.tsx
 *
 * The school's half of a cash top-up, and the screen the wallet was missing.
 *
 * `topupCampusWallet` used to write a number into `balanceSatang` with nothing
 * collecting the money, so a guardian could credit their own child ฿20,000 for
 * free and spend it on food the school then had to settle with the stalls. The
 * fix made a guardian's top-up a *request* that a member of staff confirms once
 * the money is actually on the desk — but nothing in the app could confirm one,
 * so every request sat PENDING forever and no guardian's money ever arrived.
 * This is that missing half.
 *
 * Two things this page is deliberately blunt about:
 *
 *  1. **Confirming IS the capture.** There is no gateway behind a cash request.
 *     The moment staff press ยืนยัน the balance moves, so the button asks them
 *     to confirm they were handed the money, not that the request looks correct.
 *
 *  2. **A Stripe request is not theirs to confirm.** Stripe does the capturing
 *     and a verified webhook does the crediting. Rather than offer buttons the
 *     server would refuse (`canConfirmManually`), the row says so and shows what
 *     it is waiting for.
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { reviewWalletTopupRequest } from '../services/campusWalletService';
import { satangToBahtText } from '../services/stripePaymentStatus';
import {
  Wallet,
  Check,
  X,
  Clock,
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { timestampToMillis } from '../types';
import type { WalletTopupRequest } from '../types/campus';
import { useToast } from '../components/ToastProvider.jsx';
import { errorMessage } from '../utils/errorMessage';

type Filter = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'FAILED' | 'ALL';

const FILTER_LABEL: Record<Filter, string> = {
  PENDING: 'รอยืนยัน',
  CONFIRMED: 'เติมเงินแล้ว',
  REJECTED: 'ปฏิเสธ',
  FAILED: 'ชำระเงินไม่สำเร็จ',
  ALL: 'ทั้งหมด',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING:
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/50',
  CONFIRMED:
    'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50',
  REJECTED:
    'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700/50',
  FAILED:
    'bg-slate-200 text-slate-700 border-slate-300 dark:bg-white/10 dark:text-slate-300 dark:border-white/15',
};

/** Rows written before `source` existed are cash — that is all there was. */
const sourceOf = (r: WalletTopupRequest) => r.source || 'MANUAL';

function formatWhen(ts: WalletTopupRequest['createdAt']): string {
  const ms = timestampToMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

export default function WalletTopupApproval() {
  const toast = useToast();
  const [requests, setRequests] = useState<WalletTopupRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onSnapshot(
      query(collection(db, 'wallet_topup_requests')),
      (snapshot) => {
        if (cancelled) return;
        setRequests(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as WalletTopupRequest[]
        );
        setIsLoading(false);
      },
      (err) => {
        if (cancelled) return;
        // Loading, empty and failed are three different things, and a staff
        // member staring at an empty list needs to know which one this is.
        console.warn('[WalletTopupApproval] snapshot error:', err);
        setMessage({
          type: 'error',
          text:
            'ไม่สามารถโหลดคำขอเติมเงินได้ กรุณาตรวจสอบว่าบัญชีนี้มีสิทธิ์เจ้าหน้าที่ (staff_supervisor หรือ admin)',
        });
        setIsLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const pending = requests.filter((r) => (r.status || 'PENDING') === 'PENDING');
  const pendingCash = pending.filter((r) => sourceOf(r) === 'MANUAL');
  /** What the office should expect to be handed today, if every request is paid. */
  const expectedCashSatang = pendingCash.reduce((sum, r) => sum + (Number(r.amountSatang) || 0), 0);

  const visible = requests
    .filter((r) => (filter === 'ALL' ? true : (r.status || 'PENDING') === filter))
    // Newest first: a request made a minute ago is the one with someone
    // standing at the counter.
    .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));

  const handleDecision = async (
    req: WalletTopupRequest,
    decision: 'CONFIRMED' | 'REJECTED'
  ) => {
    const baht = satangToBahtText(Number(req.amountSatang) || 0);

    const ok = await toast.confirm(
      decision === 'CONFIRMED'
        ? {
            title: `ยืนยันว่าได้รับเงิน ฿${baht} แล้ว`,
            message:
              `กดยืนยันแล้วยอด ฿${baht} จะเข้ากระเป๋าของ ${req.studentId} ทันที\n\n` +
              'ระบบไม่ได้เก็บเงินให้ — การกดยืนยันของเจ้าหน้าที่คือการรับเงิน ' +
              'กรุณายืนยันเมื่อได้รับเงินสดหรือเห็นสลิปโอนจริงแล้วเท่านั้น',
            confirmLabel: 'ได้รับเงินแล้ว เติมเงินเลย',
            tone: 'warning',
          }
        : {
            title: `ปฏิเสธคำขอเติมเงิน ฿${baht}`,
            message: `คำขอของ ${req.requestedByName || req.requestedBy} จะถูกปิด และไม่มีเงินเข้ากระเป๋า`,
            confirmLabel: 'ปฏิเสธคำขอ',
            tone: 'error',
          }
    );
    if (!ok) return;

    setProcessingId(req.id);
    setMessage(null);
    try {
      const res = await reviewWalletTopupRequest(req.id, decision, note.trim() || undefined);
      setMessage({ type: 'success', text: res.message });
      setNote('');
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#16100C] text-slate-800 dark:text-slate-100 font-['IBM_Plex_Sans_Thai'] pb-20 transition-colors">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#241C16]/95 backdrop-blur border-b border-slate-200 dark:border-white/10 px-6 py-4 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link
            to="/home"
            className="p-2 bg-slate-100 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#FF7A1A]" />
              ยืนยันการเติมเงินเข้ากระเป๋านักเรียน
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              ตรวจสอบคำขอเติมเงินจากผู้ปกครอง และยืนยันเมื่อได้รับเงินที่ห้องธุรการแล้ว
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-5">
        {/* What pressing ยืนยัน actually does */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            <p className="font-bold mb-1">การกดยืนยันคือการรับเงิน</p>
            <p>
              คำขอเงินสดไม่มีระบบเก็บเงินอยู่เบื้องหลัง — เมื่อกดยืนยัน
              <strong> ยอดเงินจะเข้ากระเป๋านักเรียนทันทีและใช้ซื้ออาหารได้จริง</strong>{' '}
              กรุณายืนยันหลังได้รับเงินสดหรือเห็นสลิปโอนแล้วเท่านั้น
              ส่วนคำขอที่ชำระผ่าน Stripe ระบบจะเติมเงินให้อัตโนมัติ เจ้าหน้าที่ไม่ต้อง (และไม่สามารถ) กดยืนยัน
            </p>
          </div>
        </div>

        {/* How much cash the counter should expect */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
            <span className="text-xs text-slate-500 dark:text-[#9CA3AF]">รอยืนยัน (เงินสด)</span>
            <p className="text-2xl font-bold font-['JetBrains_Mono'] text-slate-900 dark:text-white mt-1">
              {pendingCash.length}
              <span className="text-sm font-normal text-slate-400 dark:text-[#9CA3AF]"> รายการ</span>
            </p>
          </div>
          <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
            <span className="text-xs text-slate-500 dark:text-[#9CA3AF]">ยอดที่ควรได้รับรวม</span>
            <p className="text-2xl font-bold font-['JetBrains_Mono'] text-[#FF7A1A] mt-1">
              ฿{satangToBahtText(expectedCashSatang)}
            </p>
          </div>
        </div>

        {message && (
          <div
            role="status"
            className={`rounded-2xl px-4 py-3 text-xs font-bold border ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(['PENDING', 'CONFIRMED', 'REJECTED', 'FAILED', 'ALL'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-[#FF7A1A] text-white border-[#FF7A1A] shadow-md'
                  : 'bg-white dark:bg-[#241C16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[#FF7A1A]/50'
              }`}
            >
              {f === 'PENDING' ? `รอยืนยัน (${pending.length})` : FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Shared note, attached to whichever decision is made next */}
        <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
          <label
            htmlFor="topup-review-note"
            className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2"
          >
            บันทึกการตรวจสอบ (แนบไปกับผลการตัดสินและ Audit Log)
          </label>
          <input
            id="topup-review-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น รับเงินสด ฿200 เลขที่ใบเสร็จ 0042"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-white/20 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:outline-none focus:border-[#FF7A1A]"
          />
        </div>

        {isLoading && (
          <div className="bg-white/80 dark:bg-[#241C16]/80 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 dark:text-[#9CA3AF] animate-pulse">
            กำลังโหลดคำขอเติมเงิน...
          </div>
        )}

        {!isLoading && visible.length === 0 && (
          <div className="bg-white dark:bg-[#241C16] border border-dashed border-slate-300 dark:border-white/15 rounded-2xl px-4 py-10 text-center">
            <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-bold text-slate-500 dark:text-[#9CA3AF] mb-0">
              {filter === 'PENDING'
                ? 'ไม่มีคำขอเติมเงินที่รอยืนยัน'
                : `ไม่มีรายการในสถานะ "${FILTER_LABEL[filter]}"`}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {visible.map((req) => {
            const status = req.status || 'PENDING';
            const source = sourceOf(req);
            const isStripe = source === 'STRIPE';
            const canReview = status === 'PENDING' && !isStripe;
            const busy = processingId === req.id;

            return (
              <div
                key={req.id}
                className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-bold font-['JetBrains_Mono'] text-slate-900 dark:text-white mb-0">
                      ฿{satangToBahtText(Number(req.amountSatang) || 0)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mb-0 truncate">
                      เข้ากระเป๋า{' '}
                      <strong className="text-slate-800 dark:text-[#E5E7EB] font-['JetBrains_Mono']">
                        {req.studentId}
                      </strong>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        STATUS_STYLE[status] || STATUS_STYLE.FAILED
                      }`}
                    >
                      {FILTER_LABEL[status as Filter] || status}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-[#9CA3AF]">
                      {isStripe ? (
                        <>
                          <CreditCard className="w-3.5 h-3.5" /> Stripe
                        </>
                      ) : (
                        <>
                          <Banknote className="w-3.5 h-3.5" /> เงินสด
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="inline font-semibold">ผู้ขอ: </dt>
                    <dd className="inline text-slate-700 dark:text-[#E5E7EB]">
                      {req.requestedByName || req.requestedBy}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="inline font-semibold">เมื่อ: </dt>
                    <dd className="inline text-slate-700 dark:text-[#E5E7EB]">
                      {formatWhen(req.createdAt)}
                    </dd>
                  </div>
                  {req.note && (
                    <div className="col-span-2">
                      <dt className="inline font-semibold">หมายเหตุจากผู้ขอ: </dt>
                      <dd className="inline text-slate-700 dark:text-[#E5E7EB]">{req.note}</dd>
                    </div>
                  )}
                  {req.reviewedByName && (
                    <div className="col-span-2">
                      <dt className="inline font-semibold">ตรวจสอบโดย: </dt>
                      <dd className="inline text-slate-700 dark:text-[#E5E7EB]">
                        {req.reviewedByName}
                        {req.reviewNote ? ` — ${req.reviewNote}` : ''}
                      </dd>
                    </div>
                  )}
                  {req.failureReason && (
                    <div className="col-span-2">
                      <dt className="inline font-semibold">สาเหตุที่ไม่สำเร็จ: </dt>
                      <dd className="inline text-red-600 dark:text-red-400">{req.failureReason}</dd>
                    </div>
                  )}
                </dl>

                {canReview && (
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDecision(req, 'REJECTED')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-red-300 dark:border-red-700/50 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      ปฏิเสธ
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDecision(req, 'CONFIRMED')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#FF7A1A] hover:bg-[#E6680D] text-white cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {busy ? 'กำลังบันทึก...' : 'ได้รับเงินแล้ว'}
                    </button>
                  </div>
                )}

                {status === 'PENDING' && isStripe && (
                  // No buttons here on purpose: canConfirmManually would refuse
                  // them server-side, and a button that always fails is worse
                  // than no button at all.
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-[#9CA3AF] bg-slate-50 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 mb-0">
                    รอผู้ปกครองชำระเงินผ่าน Stripe — เมื่อชำระสำเร็จ ระบบจะเติมเงินให้อัตโนมัติ
                    เจ้าหน้าที่ยืนยันด้วยตนเองไม่ได้ เพราะจะเป็นการเติมเงินให้กับรายการที่อาจยังไม่ได้จ่าย
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
