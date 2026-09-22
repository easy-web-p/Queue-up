/**
 * ============================================================================
 * 🎖️  CAMPUS STAFF & ACCESS RIGHTS
 * ============================================================================
 *
 * Grants and revokes the roles that firestore.rules actually reads.
 *
 * What stood here before was a table of three invented people — "ป้าแดง ใจดี",
 * a chef, a cashier, with phone numbers — held in useState. Adding one pushed
 * onto an array; deleting one filtered it and announced "ลบพนักงานเรียบร้อยแล้ว".
 * Nothing left the browser. Meanwhile no real mechanism to appoint a supervisor
 * existed anywhere in the project, so the screen that looked like staff
 * management was the reason nobody noticed staff management was missing.
 *
 * This version calls setCampusStaffRole, which sets the custom claim and writes
 * the staff_supervisors record, and reports what actually happened — including
 * the part administrators always trip over: the person they just promoted has to
 * sign out and back in before their new role takes effect.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { ShieldCheck, UserPlus, Loader2, RefreshCw, Trash2, Info } from 'lucide-react';
import { db } from '../firebase/config.js';
import {
  setCampusStaffRole,
  GRANTABLE_ROLES,
  ROLE_LABELS,
  type GrantableRole,
} from '../services/campusRoleService';
import { useToast } from './ToastProvider.jsx';
import { EmptyState, ErrorState, Skeleton } from './LoadingStates.jsx';

interface StaffRecord {
  id: string;
  email: string | null;
  displayName: string | null;
  grantedByName: string | null;
  grantedAt: Date | null;
}

/** Firestore Timestamp | Date | null → Date | null, without assuming which it is. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate();
  return null;
}

export const StaffRoleManager: React.FC = () => {
  const toast = useToast();

  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string>('');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<GrantableRole>('staff_supervisor');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Nothing here touches state before the first await. The effect below calls
  // this on mount, and a synchronous setState inside an effect body cascades an
  // extra render; the initial state already reads 'loading', so there is nothing
  // to set anyway. Callers that re-fetch later put the spinner back themselves,
  // from an event handler where a synchronous set is exactly right.
  const load = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'staff_supervisors'), orderBy('grantedAt', 'desc')));
      setStaff(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            email: data.email ?? null,
            displayName: data.displayName ?? null,
            grantedByName: data.grantedByName ?? null,
            grantedAt: toDate(data.grantedAt),
          };
        })
      );
      setStatus('ready');
    } catch (err) {
      // Loading, empty and failed are three different states. A failed read
      // rendered as an empty table would read as "there are no supervisors",
      // which is exactly the wrong conclusion to draw before appointing one.
      setLoadError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // Declared inside the effect, following the pattern used elsewhere in this
    // codebase: the fetch resolves asynchronously, so no state is set during
    // the effect body itself.
    async function loadOnMount() {
      await load();
    }
    void loadOnMount();
  }, [load]);

  const handleGrant = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) {
      toast.warning('กรุณากรอกอีเมลของผู้ใช้ที่ต้องการกำหนดสิทธิ์');
      return;
    }

    setSubmitting(true);
    try {
      const result = await setCampusStaffRole({ targetEmail: target, role, enabled: true, note });
      toast.success(result.message);
      setEmail('');
      setNote('');
      await load();
    } catch (err) {
      // Surfaced, never swallowed: an administrator who believes they appointed
      // a supervisor and did not is worse off than one who sees the error.
      toast.error(
        `กำหนดสิทธิ์ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (record: StaffRecord) => {
    const who = record.email || record.displayName || record.id;
    const ok = await toast.confirm({
      title: 'ถอนสิทธิ์เจ้าหน้าที่',
      message: `ถอนสิทธิ์ ${ROLE_LABELS.staff_supervisor} จาก ${who}?\n\nผู้ใช้จะเข้าหน้าอนุมัติร้านค้า อนุมัติผู้ปกครอง และหน้าติดตามคิวไม่ได้อีก`,
      confirmLabel: 'ถอนสิทธิ์',
      tone: 'error',
    });
    if (!ok) return;

    try {
      const result = await setCampusStaffRole({
        targetUid: record.id,
        role: 'staff_supervisor',
        enabled: false,
      });
      toast.success(result.message);
      await load();
    } catch (err) {
      toast.error(`ถอนสิทธิ์ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ---- Grant form ---- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF7A1A]/10 text-[#FF7A1A] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900">กำหนดสิทธิ์เจ้าหน้าที่</h3>
            <p className="text-xs text-slate-500">
              สิทธิ์นี้เปิดหน้าอนุมัติร้านค้านักเรียน อนุมัติการผูกบัญชีผู้ปกครอง ค้นหาข้อมูลฉุกเฉิน และติดตามคิวทั้งวิทยาเขต
            </p>
          </div>
        </div>

        <form onSubmit={handleGrant} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
          <div className="space-y-1.5 min-w-0">
            <label htmlFor="staff-email" className="block text-xs font-bold text-slate-600">
              อีเมลผู้ใช้
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@lomsak.ac.th"
              autoComplete="off"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#FF7A1A]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="staff-role" className="block text-xs font-bold text-slate-600">
              บทบาท
            </label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) => setRole(e.target.value as GrantableRole)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white focus-visible:outline-2 focus-visible:outline-[#FF7A1A]"
            >
              {GRANTABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>{submitting ? 'กำลังกำหนดสิทธิ์...' : 'กำหนดสิทธิ์'}</span>
            </button>
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label htmlFor="staff-note" className="block text-xs font-bold text-slate-600">
              หมายเหตุ (บันทึกลงประวัติการตรวจสอบ)
            </label>
            <input
              id="staff-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ครูเวรประจำโรงอาหาร ภาคเรียนที่ 2"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#FF7A1A]"
            />
          </div>
        </form>

        <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <Info className="w-4 h-4 shrink-0 mt-px text-slate-400" />
          <p>
            ผู้ใช้ต้องเคยเข้าสู่ระบบอย่างน้อยหนึ่งครั้งจึงจะกำหนดสิทธิ์ได้ และหลังกำหนดสิทธิ์แล้ว
            <b> ต้องออกจากระบบและเข้าใหม่ </b>
            สิทธิ์จึงจะมีผล เพราะ Token เดิมยังถือข้อมูลสิทธิ์ชุดเก่าอยู่
          </p>
        </div>
      </div>

      {/* ---- Current supervisors ---- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-slate-900">เจ้าหน้าที่ผู้ดูแลปัจจุบัน</h3>
          <button
            onClick={() => { setStatus('loading'); void load(); }}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>รีเฟรช</span>
          </button>
        </div>

        {status === 'loading' && (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title="โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ"
            message={loadError}
            onRetry={() => { setStatus('loading'); void load(); }}
          />
        )}

        {status === 'ready' && staff.length === 0 && (
          <EmptyState
            icon={<ShieldCheck className="w-8 h-8" aria-hidden="true" />}
            title="ยังไม่มีเจ้าหน้าที่ผู้ดูแล"
            message="กำหนดสิทธิ์ให้ครูหรือเจ้าหน้าที่อย่างน้อยหนึ่งคน เพื่อให้มีผู้อนุมัติคำขอเปิดร้านและคำขอผูกบัญชีผู้ปกครอง"
          />
        )}

        {status === 'ready' && staff.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th scope="col" className="p-3">ชื่อ</th>
                  <th scope="col" className="p-3">อีเมล</th>
                  <th scope="col" className="p-3">ผู้กำหนดสิทธิ์</th>
                  <th scope="col" className="p-3">เมื่อ</th>
                  <th scope="col" className="p-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {staff.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-extrabold text-slate-900">
                      {st.displayName || <span className="text-slate-400 font-medium">ไม่ระบุชื่อ</span>}
                    </td>
                    <td className="p-3 text-slate-600 break-all">{st.email || '—'}</td>
                    <td className="p-3 text-slate-600">{st.grantedByName || '—'}</td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {st.grantedAt ? st.grantedAt.toLocaleDateString('th-TH') : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => void handleRevoke(st)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title={`ถอนสิทธิ์ ${st.email || st.id}`}
                        aria-label={`ถอนสิทธิ์ ${st.email || st.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffRoleManager;
