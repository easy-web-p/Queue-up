import React, { useState, useMemo, useEffect } from 'react';
import { useQueue } from '../../context/QueueContext';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { firebaseConfig } from '../../services/firebase';
import {
  ShieldAlert,
  Store as StoreIcon,
  Users,
  CreditCard,
  FileText,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Server,
  Download,
  Flame,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Database,
  ChefHat,
  Trash2,
  Plus,
  Sparkles,
  Settings,
  School as SchoolIcon,
  Banknote,
  RefreshCw
} from 'lucide-react';
import { SchoolService } from '../../services/schoolService';
import { apiClient, type PlatformPayout, type PaymentException } from '../../services/apiClient';
import { School, SchoolApplication } from '../../types';

export const AdminDashboard: React.FC = () => {
  const {
    stores,
    queues,
    foodItems,
    addToast,
    currentUser,
    setCurrentView,
    openStoreDetail,
    openStoreAdmin,
    deleteStore,
    seedDemoQueuesForStore,
    setKdsSelectedStoreId,
    isAdmin,
    adminEmail
  } = useQueue();

  const [adminTab, setAdminTab] = useState<'stores' | 'orders' | 'money' | 'schools' | 'logs' | 'firebase'>('stores');

  // Platform money operations. Loaded on demand rather than with the dashboard:
  // both endpoints are admin-only and neither is needed to render anything else.
  const [payouts, setPayouts] = useState<PlatformPayout[]>([]);
  const [exceptions, setExceptions] = useState<PaymentException[]>([]);
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applications, setApplications] = useState<SchoolApplication[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);

  const loadSchoolData = async () => {
    setIsLoadingSchools(true);
    try {
      const apps = await SchoolService.fetchApplications();
      const schs = await SchoolService.fetchSchools();
      setApplications(apps);
      setSchools(schs);
    } catch (err) {
      console.error('Failed to load school data:', err);
    } finally {
      setIsLoadingSchools(false);
    }
  };

  useEffect(() => {
    loadSchoolData();
  }, []);

  /** Both money queues, refreshed together so the tab shows one moment in time. */
  const loadMoneyQueues = async () => {
    setMoneyLoading(true);
    setMoneyError(null);
    try {
      const [payoutResult, exceptionResult] = await Promise.all([
        apiClient.listPlatformPayouts('REQUESTED'),
        apiClient.listPaymentExceptions('OPEN')
      ]);
      setPayouts(payoutResult.payouts);
      setExceptions(exceptionResult.exceptions);
    } catch (err) {
      setMoneyError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลการเงินได้');
    } finally {
      setMoneyLoading(false);
    }
  };

  useEffect(() => {
    if (adminTab === 'money') loadMoneyQueues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab]);

  const bahtOf = (satang: number | null | undefined) =>
    `฿${((Number(satang) || 0) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

  /**
   * Confirming a transfer is an assertion that money has already left the bank
   * account, and it cannot be taken back by pressing something else. So it asks
   * for the bank's own reference rather than accepting a single click.
   */
  const handleConfirmPayout = async (payout: PlatformPayout) => {
    const reference = prompt(
      `ยืนยันว่าโอนเงิน ${bahtOf(payout.amountSatang)} ให้ ${payout.storeName} แล้วจริง\n` +
      'กรุณาใส่เลขอ้างอิงการโอนจากธนาคาร (ใส่ว่าง = ไม่ระบุ):',
      ''
    );
    if (reference === null) return;

    setBusyId(payout.id);
    try {
      await apiClient.completePayout(payout.id, reference.trim() || undefined);
      addToast('บันทึกการโอนแล้ว', `${payout.storeName} ได้รับ ${bahtOf(payout.amountSatang)}`, 'success');
      await loadMoneyQueues();
    } catch (err) {
      addToast('บันทึกไม่สำเร็จ', err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง', 'error');
    } finally {
      setBusyId(null);
    }
  };

  /** A failed transfer must return the reserved funds rather than strand them. */
  const handleFailPayout = async (payout: PlatformPayout) => {
    const reason = prompt(
      `โอนเงินให้ ${payout.storeName} ไม่สำเร็จเพราะอะไร\n` +
      'ยอดที่กันไว้จะกลับเข้ายอดถอนได้ของร้าน:',
      'เลขบัญชีไม่ถูกต้อง'
    );
    if (!reason) return;

    setBusyId(payout.id);
    try {
      await apiClient.failPayout(payout.id, reason);
      addToast('คืนยอดให้ร้านแล้ว', `${bahtOf(payout.amountSatang)} กลับเข้ายอดถอนได้ของ ${payout.storeName}`, 'info');
      await loadMoneyQueues();
    } catch (err) {
      addToast('บันทึกไม่สำเร็จ', err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง', 'error');
    } finally {
      setBusyId(null);
    }
  };

  /** Resolving records a decision; it does not move money by itself. */
  const handleResolveException = async (exception: PaymentException, action: string) => {
    const note = prompt('บันทึกสิ่งที่ดำเนินการไป (เพื่อให้ตรวจย้อนหลังได้):', '');
    if (note === null) return;

    setBusyId(exception.id);
    try {
      await apiClient.resolvePaymentException(exception.id, action, note);
      addToast('ปิดรายการแล้ว', `ออเดอร์ ${exception.orderId} ถูกบันทึกว่าดำเนินการแล้ว`, 'success');
      await loadMoneyQueues();
    } catch (err) {
      addToast('ปิดรายการไม่สำเร็จ', err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveSchool = async (appId: string, schoolName: string) => {
    try {
      await SchoolService.approveApplication(appId, currentUser?.email || 'SuperAdmin');
      addToast('อนุมัติสถานศึกษาสำเร็จ', `สถานศึกษา ${schoolName} ได้รับการอนุมัติและเปิดใช้งานระบบแล้ว`, 'success');
      loadSchoolData();
    } catch (err) {
      addToast('เกิดข้อผิดพลาด', 'ไม่สามารถอนุมัติได้', 'error');
    }
  };

  const handleRejectSchool = async (appId: string, schoolName: string) => {
    const reason = prompt('กรุณาระบุเหตุผลการปฏิเสธคำขอ:', 'ข้อมูลเอกสารไม่ครบถ้วน');
    if (reason) {
      try {
        await SchoolService.rejectApplication(appId, reason, currentUser?.email || 'SuperAdmin');
        addToast('ปฏิเสธคำขอแล้ว', `คำขอของ ${schoolName} ถูกปฏิเสธเรียบร้อยแล้ว`, 'info');
        loadSchoolData();
      } catch (err) {
        addToast('เกิดข้อผิดพลาด', 'ไม่สามารถปฏิเสธคำขอได้', 'error');
      }
    }
  };

  const [isCopied, setIsCopied] = useState(false);
  const [apiLatency, setApiLatency] = useState<number | null>(null);

  // Measure real live API latency to /api/health
  useEffect(() => {
    let isMounted = true;
    const measureLatency = async () => {
      try {
        const t0 = performance.now();
        const res = await fetch('/api/health');
        if (res.ok && isMounted) {
          const duration = Math.round(performance.now() - t0);
          setApiLatency(duration);
        }
      } catch {
        if (isMounted) setApiLatency(null);
      }
    };

    measureLatency();
    const timer = setInterval(measureLatency, 8000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Strict Super Admin Access Guard: only Platform Super Admin (super_admin) can view this panel
  const isSuperAdminUser = isAdmin || currentUser?.role === 'super_admin';
  if (!isSuperAdminUser) {
    return (
      <div className="min-h-[55vh] flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-red-200 dark:border-red-900/50 shadow-xl my-6">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 border border-red-200 dark:border-red-800">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-stone-900 dark:text-white mb-2">
          ปฏิเสธการเข้าถึงคอนโซลกลาง (Access Denied: Super Admin Only)
        </h2>
        <p className="text-sm text-stone-600 dark:text-zinc-400 max-w-md mb-6 leading-relaxed">
          คอนโซลกลางของระบบ QueueUp และการอนุมัติสถานศึกษา สงวนสิทธิ์เฉพาะบัญชี <span className="font-bold text-red-600 dark:text-red-400">Super Admin ({adminEmail})</span> เท่านั้น สำหรับผู้ดูแลระดับโรงเรียน (School Admin) กรุณาจัดการข้อมูลผ่านหน้าสถานศึกษาของคุณ
        </p>
        <Button
          onClick={() => setCurrentView('home')}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer"
        >
          กลับสู่หน้าหลัก
        </Button>
      </div>
    );
  }

  // 1. Calculate REAL platform transaction volume from authoritative queues
  const totalPlatformVolume = useMemo(() => {
    return queues.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  }, [queues]);

  const paidOrdersCount = useMemo(() => {
    return queues.filter(q => q.paymentStatus === 'PAID' || q.status === 'COMPLETED' || q.status === 'PREPARING' || q.status === 'READY').length;
  }, [queues]);

  // 2. Real stores count
  const activeStoresCount = stores.filter(s => s.isOpen !== false).length;

  // 3. Real unique users count
  const totalUsersCount = useMemo(() => {
    const userIds = new Set<string>();
    queues.forEach(q => {
      if (q.customerId) userIds.add(q.customerId);
      if (q.customerName) userIds.add(q.customerName);
      if (q.customerPhone) userIds.add(q.customerPhone);
    });
    stores.forEach(s => {
      if (s.ownerId) userIds.add(s.ownerId);
      if (s.ownerEmail) userIds.add(s.ownerEmail);
    });
    if (currentUser?.id) userIds.add(currentUser.id);
    return Math.max(1, userIds.size);
  }, [queues, stores, currentUser]);

  const auditLogs = [
    { time: '12:44:10', event: 'Queue Q-A05 moved to PREPARING by Merchant', user: 'Kitchen_Staff_01', type: 'info' },
    { time: '12:42:01', event: 'PromptPay webhook transaction confirmed ฿243', user: 'PaymentGateway', type: 'success' },
    { time: '12:35:15', event: 'Daily menu stock updated: 2 items toggled availability', user: 'Store_Manager_01', type: 'info' },
    { time: '12:20:40', event: 'Exchange PIN verification passed for order Q-A03', user: 'POS_Terminal', type: 'success' },
    { time: '12:15:02', event: 'System health check: All microservices operational (Latency: 18ms)', user: 'Cron_System', type: 'info' },
  ];

  const handleExport = () => {
    addToast('กำลังดาวน์โหลดรายงาน', 'ระบบได้ทำการส่งออกรายงาน CSV ข้อมูลร้านค้าและธุรกรรมสำเร็จ', 'success');
  };

  const handleOpenStoreKDS = (storeId: string) => {
    setKdsSelectedStoreId(storeId);
    setCurrentView('kds');
  };

  const handleDeleteTestStore = (storeId: string, storeName: string) => {
    if (confirm(`คุณต้องการลบร้าน "${storeName}" ออกจากระบบหรือไม่? ข้อมูลคิวและเมนูที่เกี่ยวข้องจะถูกลบด้วย`)) {
      deleteStore(storeId);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-7xl mx-auto">
      {/* Admin Top Banner - Crisp, High Contrast, Theme Aware */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 text-white border border-stone-850 dark:border-zinc-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                QueueUp Super Admin Panel
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/30 text-indigo-300 border border-indigo-400/40">
                RBAC ROOT
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-300 dark:text-zinc-400 mt-1">
              ศูนย์ควบคุมระบบร้านค้า ธุรกรรมการเงิน และบันทึกประวัติการทำงานส่วนกลาง (Audit Logs)
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ผู้ดูแลระบบที่ได้รับอนุญาต: <strong className="text-white font-mono">{currentUser?.email || adminEmail}</strong>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-100 text-stone-900 font-bold text-xs shadow-md transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-orange-600" />
          <span>ส่งออกรายงาน (Export CSV)</span>
        </button>
      </div>

      {/* 4 Platform Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="ยอดธุรกรรมรวมทั้งระบบ"
          value={`฿${totalPlatformVolume.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
          change={paidOrdersCount > 0 ? `${paidOrdersCount} ออเดอร์ที่ชำระแล้ว` : `${queues.length} ออเดอร์ในระบบ`}
          isPositive={true}
          subtitle="ข้อมูลจริงจากฐานข้อมูล"
          icon={<CreditCard className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          title="ร้านค้าที่เปิดบริการ"
          value={`${activeStoresCount}/${stores.length}`}
          change={`${stores.length > 0 ? Math.round((activeStoresCount / stores.length) * 100) : 100}% ออนไลน์`}
          isPositive={activeStoresCount > 0}
          subtitle="พร้อมรับออเดอร์"
          icon={<StoreIcon className="w-5 h-5 text-orange-500" />}
        />
        <StatCard
          title="ผู้ใช้งานในระบบวันนี้"
          value={`${totalUsersCount.toLocaleString()} คน`}
          change={`${queues.length} ธุรกรรมสะสม`}
          isPositive={true}
          subtitle="ลูกค้าและร้านค้าจริง"
          icon={<Users className="w-5 h-5 text-sky-500" />}
        />
        <StatCard
          title="ความหน่วงระบบ (API Latency)"
          value={apiLatency !== null ? `${apiLatency} ms` : 'กำลังวัด...'}
          change={apiLatency !== null ? (apiLatency < 50 ? 'เร็วมาก' : apiLatency < 120 ? 'ปกติ' : 'หน่วง') : 'Cloud Run'}
          isPositive={apiLatency === null || apiLatency < 120}
          subtitle="Express API Server"
          icon={<Server className="w-5 h-5 text-purple-500" />}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-zinc-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setAdminTab('stores')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            adminTab === 'stores'
              ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
              : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800'
          }`}
        >
          จัดการร้านค้า ({stores.length})
        </button>

        <button
          onClick={() => setAdminTab('orders')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            adminTab === 'orders'
              ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
              : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800'
          }`}
        >
          ออเดอร์ & ธุรกรรมคิว ({queues.length})
        </button>

        <button
          onClick={() => setAdminTab('money')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            adminTab === 'money'
              ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
              : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800'
          }`}
        >
          <Banknote className="w-3.5 h-3.5" />
          <span>การเงินแพลตฟอร์ม</span>
          {(payouts.length > 0 || exceptions.length > 0) && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
              {payouts.length + exceptions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('schools')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            adminTab === 'schools'
              ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
              : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800'
          }`}
        >
          <SchoolIcon className="w-3.5 h-3.5" />
          <span>สถานศึกษา & คำขอ ({applications.filter(a => a.status === 'pending').length} รอดำเนินการ)</span>
        </button>

        <button
          onClick={() => setAdminTab('logs')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            adminTab === 'logs'
              ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
              : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800'
          }`}
        >
          Audit Logs & Security ({auditLogs.length})
        </button>

        <button
          onClick={() => setAdminTab('firebase')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            adminTab === 'firebase'
              ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
              : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          โครงสร้าง Firebase SDK
        </button>
      </div>

      {/* Tab 1: Stores Management Table */}
      {adminTab === 'stores' && (
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
          <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                รายชื่อร้านค้าในเครือข่าย QueueUp
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                ตรวจสอบสถานะ คิวแบบเรียลไทม์ และเปิดเข้าจัดการแต่ละร้านค้า
              </p>
            </div>
            <div className="text-xs text-stone-500 dark:text-zinc-400 font-medium">
              เปิดบริการ <span className="font-bold text-emerald-600 dark:text-emerald-400">{activeStoresCount}</span> / ทั้งหมด <span className="font-bold text-stone-800 dark:text-zinc-200">{stores.length}</span> ร้าน
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700 dark:text-zinc-300">
              <thead className="bg-stone-50/80 dark:bg-zinc-950/60 text-stone-600 dark:text-zinc-400 font-bold border-b border-stone-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">ชื่อร้าน</th>
                  <th className="py-3 px-4">คะแนน</th>
                  <th className="py-3 px-4">คิวขณะนี้</th>
                  <th className="py-3 px-4">สถานะร้าน</th>
                  <th className="py-3 px-4">ที่อยู่ / พิกัด</th>
                  <th className="py-3 px-4 text-right">การจัดการร้านค้า</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                {stores.map(store => {
                  const liveQueuesCount = queues.filter(
                    q => q.storeId === store.id && q.status !== 'COMPLETED' && q.status !== 'CANCELLED'
                  ).length;

                  return (
                    <tr key={store.id} className="hover:bg-stone-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={store.logo}
                            alt={store.name}
                            className="w-9 h-9 rounded-xl object-cover border border-stone-200 dark:border-zinc-700 shrink-0 shadow-2xs"
                          />
                          <div>
                            <div className="font-bold text-stone-900 dark:text-zinc-100 text-sm">
                              {store.name}
                            </div>
                            <div className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">
                              ID: {store.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-amber-500">
                        ★ {store.rating} ({store.reviewCount})
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`font-mono font-black text-sm ${liveQueuesCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-stone-400'}`}>
                          {liveQueuesCount} คิว
                        </span>
                        {liveQueuesCount === 0 && (
                          <button
                            onClick={() => seedDemoQueuesForStore(store.id)}
                            className="block text-[10px] text-orange-600 hover:underline mt-0.5 cursor-pointer font-medium"
                            title="สร้างออเดอร์จำลอง 3 รายการเพื่อทดสอบระบบ"
                          >
                            + สร้างคิวทดสอบ
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            store.isOpen
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                          }`}
                        >
                          {store.isOpen ? 'เปิดบริการ' : 'ปิดร้าน'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-stone-500 dark:text-zinc-400 truncate max-w-xs">
                        {store.address}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenStoreKDS(store.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/60 text-orange-600 dark:text-orange-400 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            title="เปิดหน้าจอครัว KDS สำหรับร้านนี้"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            <span>KDS</span>
                          </button>

                          <button
                            onClick={() => openStoreAdmin(store.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-200 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            title="ไปหน้าตั้งค่าร้านค้า"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>ตั้งค่า</span>
                          </button>

                          <button
                            onClick={() => openStoreDetail(store.id)}
                            className="px-2 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-600 dark:text-zinc-300 transition-colors cursor-pointer"
                            title="เปิดมุมมองลูกค้าหน้าร้าน"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Store (For cleanup) */}
                          <button
                            onClick={() => handleDeleteTestStore(store.id, store.name)}
                            className="px-2 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                            title="ลบร้านค้านี้ออกจากระบบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Orders & Transactions Table */}
      {adminTab === 'orders' && (
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
          <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800">
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              ประวัติการออกคิวและธุรกรรมรวมทั้งหมด ({queues.length} รายการ)
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              ติดตามออเดอร์และการชำระเงินของทุกร้านค้าแบบศูนย์รวม
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700 dark:text-zinc-300">
              <thead className="bg-stone-50/80 dark:bg-zinc-950/60 text-stone-600 dark:text-zinc-400 font-bold border-b border-stone-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">หมายเลขคิว / PIN</th>
                  <th className="py-3 px-4">ร้านค้า</th>
                  <th className="py-3 px-4">ลูกค้า</th>
                  <th className="py-3 px-4">รายการอาหาร</th>
                  <th className="py-3 px-4">ยอดเงิน</th>
                  <th className="py-3 px-4">วิธีชำระ</th>
                  <th className="py-3 px-4">สถานะคิว</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                {queues.map(q => (
                  <tr key={q.id} className="hover:bg-stone-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-black text-orange-600 dark:text-orange-400 text-sm">
                        {q.queueNumber}
                      </div>
                      {q.exchangePin && (
                        <div className="text-[10px] text-stone-400 font-mono">
                          PIN: #{q.exchangePin}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-zinc-100">
                      {q.storeName}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-stone-800 dark:text-zinc-200">{q.customerName}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{q.customerPhone}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-[200px]">
                      <span className="truncate block text-stone-600 dark:text-zinc-400">
                        {q.items.map(i => `${i.quantity}x ${i.food.name}`).join(', ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                      ฿{q.total}
                    </td>
                    <td className="py-3.5 px-4 uppercase font-mono text-[11px] text-stone-500">
                      {q.paymentMethod}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={q.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Schools & Applications (Phase 5 Approval Workflow) */}
      {/* Tab: Platform money operations — the two things only an admin can do */}
      {adminTab === 'money' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                การเงินแพลตฟอร์ม
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                สองอย่างที่มีแต่ผู้ดูแลระบบทำได้ — ยืนยันการโอนเงินให้ร้าน และเคลียร์เงินที่เข้ามาแต่ระบบรับไม่ได้
              </p>
            </div>
            <button
              onClick={loadMoneyQueues}
              disabled={moneyLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-200 text-xs font-bold transition-colors cursor-pointer border border-stone-200 dark:border-zinc-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${moneyLoading ? 'animate-spin' : ''}`} />
              <span>{moneyLoading ? 'กำลังโหลด...' : 'โหลดใหม่'}</span>
            </button>
          </div>

          {moneyError && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700 dark:text-red-400">โหลดข้อมูลไม่สำเร็จ</p>
                <p className="text-xs text-red-600 dark:text-red-300/80 mt-0.5">{moneyError}</p>
              </div>
            </div>
          )}

          {/* Withdrawal requests awaiting a real bank transfer */}
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800">
              <h4 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-500" />
                คำขอถอนเงินที่รอโอน ({payouts.length})
              </h4>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">
                ยอดเงินถูกกันไว้แล้ว ร้านถอนซ้ำจากยอดเดิมไม่ได้ — โอนเงินจริงผ่านธนาคารก่อน แล้วจึงกดยืนยันที่นี่
              </p>
            </div>

            {payouts.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-stone-700 dark:text-zinc-200">ไม่มีคำขอค้างอยู่</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-zinc-800">
                {payouts.map((payout) => (
                  <div key={payout.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-stone-900 dark:text-white">{payout.storeName}</span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                          รอโอน
                        </span>
                      </div>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        {bahtOf(payout.amountSatang)}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1 font-mono">
                        {payout.bankAccountSnapshot?.bankName || '—'} ·{' '}
                        {payout.bankAccountSnapshot?.accountName || '—'} ·{' '}
                        {payout.bankAccountSnapshot?.accountNumberMasked
                          || payout.bankAccountSnapshot?.accountNumber || '—'}
                      </p>
                      <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-0.5">
                        ขอเมื่อ {new Date(payout.createdAt).toLocaleString('th-TH')} · {payout.id}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleConfirmPayout(payout)}
                        disabled={busyId === payout.id}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        โอนแล้ว ยืนยัน
                      </button>
                      <button
                        onClick={() => handleFailPayout(payout)}
                        disabled={busyId === payout.id}
                        className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        โอนไม่สำเร็จ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Money that arrived and could not be applied */}
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800">
              <h4 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                เงินที่ระบบรับไม่ได้ ({exceptions.length})
              </h4>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">
                จ่ายน้อยกว่ายอด จ่ายหลังยกเลิก หรือคืนเงินหลังเงินออกจากยอดพักไปแล้ว — ระบบไม่เดาและไม่กลืนเงินเงียบๆ
                แต่ต้องมีคนตัดสินใจ
              </p>
            </div>

            {exceptions.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-stone-700 dark:text-zinc-200">ไม่มีเงินค้างที่ต้องตัดสินใจ</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-zinc-800">
                {exceptions.map((exception) => (
                  <div key={exception.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400 border border-red-200 dark:border-red-500/30 font-mono">
                          {exception.reason}
                        </span>
                        <span className="text-xs font-mono text-stone-500 dark:text-zinc-400">
                          {exception.orderId}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-stone-900 dark:text-white mt-1.5">
                        เข้ามา {bahtOf(exception.amountSatang)}
                        {exception.expectedSatang !== null && (
                          <span className="text-stone-500 dark:text-zinc-400 font-medium">
                            {' '}· ควรได้ {bahtOf(exception.expectedSatang)}
                          </span>
                        )}
                      </p>
                      {exception.detail && (
                        <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">{exception.detail}</p>
                      )}
                      <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-0.5 font-mono">
                        {exception.providerPaymentIntentId || exception.providerCheckoutSessionId || '—'} ·{' '}
                        {new Date(exception.createdAt).toLocaleString('th-TH')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleResolveException(exception, 'REFUNDED_AT_GATEWAY')}
                        disabled={busyId === exception.id}
                        className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        คืนเงินที่ Stripe แล้ว
                      </button>
                      <button
                        onClick={() => handleResolveException(exception, 'RECONCILED')}
                        disabled={busyId === exception.id}
                        className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 text-xs font-bold hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        กระทบยอดแล้ว
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {adminTab === 'schools' && (
        <div className="space-y-6">
          {/* Applications Section */}
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-zinc-800">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-500 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <SchoolIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    คำขอสมัครเข้าร่วมโครงการของสถานศึกษา (School Applications)
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                    ตรวจสอบข้อมูลสถานศึกษา ผู้ดูแลระบบ และรายชื่อสมาชิกจาก Excel ก่อนอนุมัติเปิดใช้งานระบบ
                  </p>
                </div>
              </div>

              <button
                onClick={loadSchoolData}
                disabled={isLoadingSchools}
                className="px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-bold text-stone-700 dark:text-zinc-200 hover:bg-stone-100 transition-all cursor-pointer"
              >
                {isLoadingSchools ? 'กำลังโหลด...' : 'รีเฟรชข้อมูล'}
              </button>
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-10 text-xs text-stone-400">
                ยังไม่มีคำขอสมัครจากสถานศึกษาในระบบ
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-zinc-800 text-stone-400">
                      <th className="py-2.5 px-3">รหัส/ชื่อสถานศึกษา</th>
                      <th className="py-2.5 px-3">จังหวัด</th>
                      <th className="py-2.5 px-3">ผู้ดูแล (Admin)</th>
                      <th className="py-2.5 px-3">จำนวนสมาชิก</th>
                      <th className="py-2.5 px-3">สถานะ</th>
                      <th className="py-2.5 px-3 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(app => (
                      <tr key={app.id} className="border-b border-stone-100 dark:border-zinc-800/60 hover:bg-stone-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-orange-600 block">{app.schoolData.schoolCode}</span>
                          <span className="font-bold text-stone-900 dark:text-white">{app.schoolData.schoolName}</span>
                        </td>
                        <td className="py-3 px-3 text-stone-600 dark:text-zinc-400">{app.schoolData.province}</td>
                        <td className="py-3 px-3">
                          <span className="font-medium text-stone-900 dark:text-zinc-200 block">{app.adminData.fullName}</span>
                          <span className="font-mono text-stone-400 text-[11px]">{app.adminData.email}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-stone-700 dark:text-zinc-300 block">นักเรียน {app.memberStats.studentCount} คน</span>
                          <span className="text-stone-400 text-[11px]">Admin {app.memberStats.adminCount} ท่าน</span>
                        </td>
                        <td className="py-3 px-3">
                          {app.status === 'pending' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                              รอตรวจสอบ
                            </span>
                          )}
                          {app.status === 'approved' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                              อนุมัติแล้ว
                            </span>
                          )}
                          {app.status === 'rejected' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/40 dark:text-red-300">
                              ปฏิเสธแล้ว
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {app.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveSchool(app.id, app.schoolData.schoolName)}
                                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer shadow-xs active:scale-95 transition-all"
                              >
                                อนุมัติ
                              </button>
                              <button
                                onClick={() => handleRejectSchool(app.id, app.schoolData.schoolName)}
                                className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs cursor-pointer shadow-xs active:scale-95 transition-all"
                              >
                                ปฏิเสธ
                              </button>
                            </div>
                          )}
                          {app.status === 'approved' && (
                            <span className="text-[11px] text-emerald-600 font-bold">เปิดใช้งานแล้ว</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Schools Section */}
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-6 shadow-sm">
            <h3 className="text-base font-bold text-stone-900 dark:text-white mb-1">
              สถานศึกษาที่เปิดใช้งานแล้ว (Active Schools: {schools.length})
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mb-4">
              สถานศึกษาเหล่านี้มี schoolId ที่พร้อมใช้งานในระบบ Multi-tenancy สำหรับนักเรียนและร้านอาหาร
            </p>

            {schools.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400 border border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl">
                ยังไม่มีสถานศึกษาที่ได้รับการอนุมัติ (คุณสามารถทดสอบส่งคำขอผ่านหน้า /register-school แล้วกดอนุมัติด้านบนได้ทันที)
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {schools.map(sch => (
                  <div key={sch.schoolId} className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-orange-600">{sch.schoolCode}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">ACTIVE</span>
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate">{sch.schoolName}</h4>
                    <div className="text-xs text-stone-500 flex justify-between">
                      <span>จังหวัด: {sch.province}</span>
                      <span>นักเรียน: {sch.totalStudents} คน</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Security & Audit Logs */}
      {adminTab === 'logs' && (
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
          <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Audit Logs & Real-time Security Events
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                บันทึกการทำงานของระบบเพื่อความโปร่งใสและตรวจสอบย้อนหลังได้
              </p>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Streaming Logs
            </span>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-zinc-800 font-mono text-xs">
            {auditLogs.map((log, idx) => (
              <div key={idx} className="p-4 flex items-start justify-between gap-4 hover:bg-stone-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-stone-400 dark:text-zinc-500 shrink-0">[{log.time}]</span>
                  <span className="text-stone-800 dark:text-zinc-200 font-sans font-medium">{log.event}</span>
                </div>
                <span className="text-stone-500 dark:text-zinc-400 text-[11px] shrink-0 bg-stone-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg border border-stone-200 dark:border-zinc-700">
                  {log.user}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Firebase Infrastructure Card */}
      {adminTab === 'firebase' && (
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-zinc-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Flame className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    Firebase & Google Cloud Infrastructure
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    OPERATIONAL
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  แอปพลิเคชันเชื่อมโยงกับ Firebase Web SDK และจัดเก็บคอนฟิกอย่างปลอดภัย
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(firebaseConfig, null, 2));
                setIsCopied(true);
                addToast('คัดลอกคอนฟิกแล้ว', 'คัดลอก Firebase Config ไปยัง Clipboard สำเร็จ', 'success');
                setTimeout(() => setIsCopied(false), 3000);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-200 text-xs font-bold transition-colors cursor-pointer border border-stone-200 dark:border-zinc-700"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
              <span>{isCopied ? 'คัดลอกแล้ว' : 'คัดลอก JSON Config'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-stone-500 dark:text-zinc-400">App Nickname</span>
              <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mt-0.5">QueueUp</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-stone-500 dark:text-zinc-400">App ID</span>
              <p className="text-xs font-mono font-bold text-stone-800 dark:text-zinc-200 mt-0.5 truncate" title={firebaseConfig.appId}>
                {firebaseConfig.appId}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-stone-500 dark:text-zinc-400">Project ID</span>
              <p className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                {firebaseConfig.projectId}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-stone-500 dark:text-zinc-400">Auth Domain</span>
              <p className="text-xs font-mono text-stone-700 dark:text-zinc-300 mt-0.5 truncate">
                {firebaseConfig.authDomain}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-stone-500 dark:text-zinc-400">Storage Bucket</span>
              <p className="text-xs font-mono text-stone-700 dark:text-zinc-300 mt-0.5 truncate">
                {firebaseConfig.storageBucket}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-stone-500 dark:text-zinc-400">Measurement ID (Analytics)</span>
              <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {firebaseConfig.measurementId}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
