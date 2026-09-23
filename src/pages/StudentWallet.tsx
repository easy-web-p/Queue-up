/**
 * ============================================================================
 * 👛 MY CAMPUS WALLET — the student's own view of their money
 * ============================================================================
 *
 * FoodBooking offers "กระเป๋าเงินนักเรียน" as a payment method, and until this
 * page existed no screen in the app showed the student a balance, an allowance,
 * or one line of the ledger. The only way to find out what was in the wallet
 * was to place an order and be refused. A parent could see all of it from
 * GuardianDashboard; the child whose money it is could see none of it.
 *
 * Read-only on purpose, and that is the honest shape. `assertWalletAuthority`
 * is called with `allowSelf: false` for every top-up path: a student cannot
 * credit their own wallet, because self-service would route straight around the
 * spending controls a guardian set. So this page shows the money, explains who
 * can add to it, and shows the pending requests that say more is on the way —
 * rather than offering a top-up button that the server would refuse.
 *
 * Every number comes from `walletSpendView`, which applies the same
 * period-rollover and fail-closed rules as the order transaction. The headline
 * figure is the *spendable* amount, not the balance: with ฿500 in the wallet
 * and ฿40 of today's allowance left, an order may cost ฿40.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Info,
  Lock,
  Minus,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchStudentWallet,
  fetchTopupRequestsForStudent,
  fetchWalletTransactions,
} from '../services/campusWalletService';
import {
  bangkokDateKey,
  describeBlocker,
  describeLedgerEntry,
  formatBaht,
  walletSpendView,
} from '../services/walletView';
import { errorMessage } from '../utils/errorMessage';
import { timestampToMillis } from '../types.ts';
import type { FirestoreTimestamp } from '../types.ts';
import type { StudentWallet as Wallet_, WalletTopupRequest, WalletTransaction } from '../types/campus';

function formatWhen(ts: FirestoreTimestamp): string {
  const ms = timestampToMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

/** A bar that stays readable when the limit is 0 — a deliberate freeze. */
function usedPercent(spent: number, limit: number | null): number {
  if (limit === null || limit <= 0) return 100;
  return Math.min(100, Math.round((spent / limit) * 100));
}

export default function StudentWallet() {
  const { user, currentUser } = useAuth();
  const uid = currentUser?.uid || user?.uid;

  const [wallet, setWallet] = useState<Wallet_ | null>(null);
  const [ledger, setLedger] = useState<WalletTransaction[]>([]);
  const [pending, setPending] = useState<WalletTopupRequest[]>([]);
  // Three distinct states, never collapsed: still loading, loaded and empty,
  // and failed. A failed read that renders as ฿0.00 tells a student their
  // money is gone.
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    async function load(studentId: string) {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [w, txs] = await Promise.all([
          fetchStudentWallet(studentId),
          fetchWalletTransactions(studentId, 40),
        ]);
        // The requests are secondary: a failure there must not blank the money.
        const reqs = await fetchTopupRequestsForStudent(studentId, 10);
        if (cancelled) return;
        setWallet(w);
        setHasWallet(w !== null);
        setLedger(txs);
        setPending(reqs.filter((r) => r.status === 'PENDING'));
      } catch (err) {
        if (cancelled) return;
        console.error('[StudentWallet] Could not load the wallet:', err);
        setLoadError(errorMessage(err, 'โหลดข้อมูลกระเป๋าเงินไม่สำเร็จ'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load(uid);
    return () => {
      cancelled = true;
    };
  }, [uid, reloadKey]);

  const today = bangkokDateKey();
  const view = walletSpendView(wallet, today);
  const blockerText = describeBlocker(view.blocker);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#16100C] text-slate-800 dark:text-slate-100 font-['IBM_Plex_Sans_Thai'] pb-20 transition-colors">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#241C16]/95 backdrop-blur border-b border-slate-200 dark:border-white/10 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Link
            to="/user/account/profile"
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#16100C] dark:hover:bg-[#FF7A1A]/10 border border-slate-200 dark:border-white/10 rounded-xl text-[#FF7A1A] transition-colors"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#FF7A1A]" />
              กระเป๋าเงินนักเรียนของฉัน
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              ยอดคงเหลือ วงเงินที่ใช้ได้ และประวัติการเคลื่อนไหวทั้งหมด
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={isLoading}
          className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#16100C] dark:hover:bg-[#FF7A1A]/10 border border-slate-200 dark:border-white/10 rounded-xl text-[#FF7A1A] transition-colors disabled:opacity-40 cursor-pointer"
          aria-label="โหลดข้อมูลใหม่"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-5">
        {isLoading && (
          <div className="bg-white/80 dark:bg-[#241C16]/80 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 dark:text-[#9CA3AF] animate-pulse">
            กำลังโหลดข้อมูลกระเป๋าเงิน...
          </div>
        )}

        {!isLoading && loadError && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl px-5 py-4">
            <p className="text-sm font-bold text-rose-800 dark:text-rose-200 mb-1">
              โหลดข้อมูลกระเป๋าเงินไม่สำเร็จ
            </p>
            {/* Never a zero balance in place of an unknown one. */}
            <p className="text-xs text-rose-700 dark:text-rose-300 mb-3">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {!isLoading && !loadError && !hasWallet && (
          <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-3xl p-8 text-center shadow-xl">
            <Wallet className="w-10 h-10 text-slate-300 dark:text-white/20 mx-auto mb-3" />
            <h2 className="text-lg font-bold font-['Kanit'] text-slate-900 dark:text-white mb-2">
              ยังไม่มีกระเป๋าเงินนักเรียน
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] max-w-sm mx-auto">
              กระเป๋าเงินจะถูกเปิดให้อัตโนมัติเมื่อผู้ปกครองที่โรงเรียนยืนยันแล้ว
              หรือเจ้าหน้าที่โรงเรียนเติมเงินให้ครั้งแรก
              ระหว่างนี้ยังสั่งอาหารแบบ Zero-Payment และจ่ายที่ร้านได้ตามปกติ
            </p>
          </div>
        )}

        {!isLoading && !loadError && hasWallet && (
          <>
            {/* Balance and what may actually be spent right now */}
            <section className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-xs text-slate-500 dark:text-[#9CA3AF] font-bold uppercase tracking-wider">
                    ยอดเงินคงเหลือ
                  </span>
                  <div className="text-4xl font-black font-['JetBrains_Mono'] text-slate-900 dark:text-white mt-1">
                    {formatBaht(view.balanceSatang)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#FF7A1A] font-bold uppercase tracking-wider">
                    สั่งอาหารได้สูงสุดตอนนี้
                  </span>
                  <div className="text-3xl font-black font-['JetBrains_Mono'] text-[#FF7A1A] mt-1">
                    {formatBaht(view.spendableSatang)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-1 max-w-[16rem]">
                    ยอดที่ใช้ได้จริงคือค่าที่น้อยที่สุดระหว่างเงินคงเหลือ วงเงินวันนี้ และวงเงินสัปดาห์นี้
                  </p>
                </div>
              </div>

              {blockerText && (
                <div className="mt-6 flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl px-4 py-3">
                  {view.blocker === 'LOCKED' ? (
                    <Lock className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                  )}
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-0">
                    {blockerText}
                  </p>
                </div>
              )}

              {/* Allowance. A limit that is not set is said to be not set —
                  the server refuses the order either way. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {[
                  {
                    key: 'today',
                    title: 'วงเงินวันนี้',
                    spent: view.spentTodaySatang,
                    limit: view.dailyLimitSatang,
                    remaining: view.remainingTodaySatang,
                  },
                  {
                    key: 'week',
                    title: 'วงเงินสัปดาห์นี้',
                    spent: view.spentThisWeekSatang,
                    limit: view.weeklyLimitSatang,
                    remaining: view.remainingThisWeekSatang,
                  },
                ].map((row) => (
                  <div
                    key={row.key}
                    className="bg-slate-50 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-[#E5E7EB]">
                        {row.title}
                      </span>
                      <span className="text-xs font-['JetBrains_Mono'] text-slate-500 dark:text-[#9CA3AF]">
                        {row.limit === null ? 'ยังไม่ได้ตั้งวงเงิน' : `ใช้ไป ${formatBaht(row.spent)} / ${formatBaht(row.limit)}`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF7A1A] transition-all"
                        style={{ width: `${usedPercent(row.spent, row.limit)}%` }}
                      />
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-2 mb-0">
                      {row.remaining === null
                        ? 'ต้องให้ผู้ปกครองหรือเจ้าหน้าที่ตั้งวงเงินก่อน'
                        : `เหลืออีก ${formatBaht(row.remaining)}`}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Who can put money in. Not a button, because the server refuses
                a student topping up their own wallet — by design. */}
            <section className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-3xl p-5">
              <h2 className="text-sm font-bold font-['Kanit'] text-sky-900 dark:text-sky-200 mb-1.5 flex items-center gap-2">
                <Info className="w-4 h-4" />
                เติมเงินเข้ากระเป๋าอย่างไร
              </h2>
              <p className="text-xs text-sky-900/80 dark:text-sky-200/80 mb-0">
                นักเรียนเติมเงินให้ตัวเองไม่ได้ เพื่อไม่ให้ข้ามวงเงินที่ผู้ปกครองตั้งไว้ —
                ให้ <strong>ผู้ปกครองที่โรงเรียนยืนยันแล้ว</strong> เติมผ่านหน้าแดชบอร์ดผู้ปกครอง
                หรือนำเงินสดไปที่ <strong>ห้องการเงิน/เจ้าหน้าที่โรงอาหาร</strong> เพื่อให้เจ้าหน้าที่ยืนยันยอดให้
              </p>
            </section>

            {pending.length > 0 && (
              <section className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-3xl p-5 shadow-xl">
                <h2 className="text-sm font-bold font-['Kanit'] text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  รอเจ้าหน้าที่ยืนยัน ({pending.length})
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mb-3">
                  ยอดเหล่านี้ยังไม่ถูกบวกเข้ากระเป๋า จนกว่าเจ้าหน้าที่จะยืนยันว่าได้รับเงินแล้ว
                </p>
                <ul className="space-y-2 list-none pl-0 mb-0">
                  {pending.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-amber-900 dark:text-amber-200 truncate">
                          {req.requestedByName || 'ผู้ปกครอง/เจ้าหน้าที่'}
                        </div>
                        <div className="text-[11px] text-amber-800/70 dark:text-amber-200/60">
                          {formatWhen(req.createdAt)}
                        </div>
                      </div>
                      <span className="text-sm font-black font-['JetBrains_Mono'] text-amber-900 dark:text-amber-200 shrink-0">
                        {formatBaht(req.amountSatang)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* The ledger */}
            <section className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-3xl p-5 shadow-xl">
              <h2 className="text-sm font-bold font-['Kanit'] text-slate-900 dark:text-white mb-3">
                ประวัติการเคลื่อนไหว
              </h2>

              {ledger.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] py-6 text-center mb-0">
                  ยังไม่มีรายการเคลื่อนไหวในกระเป๋านี้
                </p>
              ) : (
                <ul className="list-none pl-0 mb-0 divide-y divide-slate-100 dark:divide-white/5">
                  {ledger.map((tx) => {
                    const entry = describeLedgerEntry(tx);
                    return (
                      <li key={tx.id} className="flex items-center gap-3 py-3">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            entry.direction === 1
                              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : entry.direction === -1
                                ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {entry.direction === 1 ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : entry.direction === -1 ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <Minus className="w-4 h-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {entry.label}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate">
                            {tx.note || formatWhen(tx.timestamp)}
                          </div>
                        </div>
                        <span
                          className={`text-sm font-black font-['JetBrains_Mono'] shrink-0 ${
                            entry.direction === 1
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : entry.direction === -1
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {entry.direction === 1 ? '+' : entry.direction === -1 ? '−' : ''}
                          {formatBaht(entry.amountSatang)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
