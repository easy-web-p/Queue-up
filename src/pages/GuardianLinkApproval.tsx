/**
 * 👪 GuardianLinkApproval.tsx
 *
 * The school's half of guardian verification, and the screen the campus system was
 * missing: a guardian could request a link, but nothing could confirm one, so no
 * guardian ever passed the check that gates wallet top-ups, spending limits and a
 * child's order history.
 *
 * A PENDING row proves nothing — anyone signed in can create one claiming to be a
 * guardian — so the page is deliberately blunt about what approving actually hands
 * over, and asks staff to confirm the relationship outside the app first.
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { reviewParentChildLink } from '../services/campusWalletService';
import {
  ShieldCheck,
  Check,
  X,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Users,
  UserMinus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ParentChildLink } from '../types/campus';

type Filter = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALL';

const RELATIONSHIP_LABEL: Record<string, string> = {
  FATHER: 'บิดา',
  MOTHER: 'มารดา',
  GUARDIAN: 'ผู้ปกครอง',
};

export default function GuardianLinkApproval() {
  const [links, setLinks] = useState<ParentChildLink[]>([]);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onSnapshot(
      query(collection(db, 'parent_child_links')),
      (snapshot) => {
        if (cancelled) return;
        setLinks(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ParentChildLink[]
        );
        setIsLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.warn('[GuardianLinkApproval] snapshot error:', err);
        setMessage({
          type: 'error',
          text: 'ไม่สามารถโหลดคำขอผูกบัญชีได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงของบัญชีเจ้าหน้าที่',
        });
        setIsLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const visibleLinks = links
    .filter((l) => (filter === 'ALL' ? true : (l.status || 'PENDING') === filter))
    .sort((a, b) => String(a.studentName || '').localeCompare(String(b.studentName || '')));

  const pendingCount = links.filter((l) => (l.status || 'PENDING') === 'PENDING').length;

  const handleDecision = async (
    link: ParentChildLink,
    decision: 'VERIFIED' | 'REJECTED' | 'REVOKED'
  ) => {
    if (decision === 'REVOKED') {
      const ok = window.confirm(
        `เพิกถอนสิทธิ์ของ "${link.guardianName}" ต่อข้อมูลของ "${link.studentName}" ใช่หรือไม่?\n\n` +
          'ผู้ปกครองจะไม่สามารถดูยอดเงิน ประวัติการสั่งซื้อ หรือข้อมูลสุขภาพของนักเรียนได้อีก'
      );
      if (!ok) return;
    }

    setProcessingId(link.id);
    setMessage(null);
    try {
      const res = await reviewParentChildLink(link.id, decision, note.trim() || undefined);
      setMessage({ type: 'success', text: res.message });
      setNote('');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกผลการตรวจสอบ';
      setMessage({ type: 'error', text });
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
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FF7A1A]" />
              ยืนยันการผูกบัญชีผู้ปกครอง
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              ตรวจสอบและยืนยันความสัมพันธ์ระหว่างผู้ปกครองกับนักเรียนก่อนให้สิทธิ์เข้าถึงข้อมูล
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-5">
        {/* What approving actually grants */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            <p className="font-bold mb-1">การยืนยันให้สิทธิ์อะไรบ้าง</p>
            <p>
              เมื่อยืนยันแล้ว ผู้ปกครองจะ <strong>เติมเงิน ตั้งวงเงิน ล็อก/ปลดล็อกกระเป๋าเงิน
              ดูประวัติการสั่งซื้อ และดูข้อมูลการแพ้อาหารของนักเรียน</strong> ได้
              คำขอนี้สร้างโดยผู้ปกครองเอง ระบบยังไม่ได้ตรวจสอบความสัมพันธ์ให้
              <strong> กรุณายืนยันตัวตนกับทางโรงเรียนก่อนกดอนุมัติทุกครั้ง</strong>
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-2xl px-4 py-3 text-xs font-bold border ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(['PENDING', 'VERIFIED', 'REJECTED', 'ALL'] as Filter[]).map((f) => (
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
              {f === 'PENDING' && `รอตรวจสอบ (${pendingCount})`}
              {f === 'VERIFIED' && 'ยืนยันแล้ว'}
              {f === 'REJECTED' && 'ปฏิเสธ/เพิกถอน'}
              {f === 'ALL' && 'ทั้งหมด'}
            </button>
          ))}
        </div>

        {/* Shared note, attached to whichever decision is made next */}
        <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
          <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">
            บันทึกการตรวจสอบ (แนบไปกับผลการตัดสินและ Audit Log)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น ตรวจสอบกับทะเบียนนักเรียนและบัตรประชาชนแล้ว"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-white/20 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:outline-none focus:border-[#FF7A1A]"
          />
        </div>

        {isLoading && (
          <div className="bg-white/80 dark:bg-[#241C16]/80 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 dark:text-[#9CA3AF] animate-pulse">
            กำลังโหลดคำขอผูกบัญชี...
          </div>
        )}

        {!isLoading && visibleLinks.length === 0 && (
          <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
            <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              ไม่มีคำขอในหมวดนี้
            </p>
          </div>
        )}

        <div className="space-y-3">
          {visibleLinks.map((link) => {
            const status = link.status || 'PENDING';
            const busy = processingId === link.id;
            return (
              <div
                key={link.id}
                className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {link.guardianName || 'ผู้ปกครอง'}{' '}
                      <span className="text-xs font-normal text-slate-500 dark:text-[#9CA3AF]">
                        ({RELATIONSHIP_LABEL[link.relationship] || link.relationship})
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                      ขอผูกกับนักเรียน:{' '}
                      <strong className="text-slate-700 dark:text-[#E5E7EB]">
                        {link.studentName || link.studentId}
                      </strong>
                    </p>
                    <p className="text-[11px] font-['JetBrains_Mono'] text-slate-400 dark:text-slate-500 mt-1">
                      guardian: {link.guardianId} · student: {link.studentId}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                      status === 'VERIFIED'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600'
                        : status === 'REJECTED'
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-600'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600'
                    }`}
                  >
                    {status === 'VERIFIED' ? 'ยืนยันแล้ว' : status === 'REJECTED' ? 'ปฏิเสธ/เพิกถอน' : 'รอตรวจสอบ'}
                  </span>
                </div>

                {status === 'PENDING' && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDecision(link, 'VERIFIED')}
                      className="flex-1 min-w-[150px] py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {busy ? 'กำลังบันทึก...' : 'ยืนยันความสัมพันธ์'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDecision(link, 'REJECTED')}
                      className="flex-1 min-w-[150px] py-2.5 bg-white dark:bg-transparent border-2 border-red-500 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      ปฏิเสธคำขอ
                    </button>
                  </div>
                )}

                {status === 'VERIFIED' && (
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDecision(link, 'REVOKED')}
                      className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-transparent border-2 border-red-500 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <UserMinus className="w-4 h-4" />
                      {busy ? 'กำลังบันทึก...' : 'เพิกถอนสิทธิ์ผู้ปกครอง'}
                    </button>
                  </div>
                )}

                {link.reviewNote ? (
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] border-t border-slate-100 dark:border-white/5 pt-2">
                    <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                    บันทึก: {link.reviewNote}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
