import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Tv,
  HeartPulse,
} from "lucide-react";
import { useCampus } from "../../identity/context/CampusContext";

export const CampusOverviewDashboard: React.FC = () => {
  const { campusId = "kku-complex" } = useParams<{ campusId: string }>();
  const { activeCampus } = useCampus();
  const navigate = useNavigate();

  const metrics = {
    totalShops: 18,
    activeShops: 16,
    studentVendors: 4,
    pendingApprovals: 2,
    todayServedMeals: 1840,
    allergyIncidents: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-extrabold text-lg sm:text-xl text-white font-kanit">
          ศูนย์ควบคุมและกำกับดูแลโรงอาหาร: {activeCampus.name}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          ภาพรวมร้านค้า, การอนุมัติผู้ประกอบการนักศึกษา, และสุขอนามัยความปลอดภัย
        </p>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#1C2541] border border-slate-700/60">
          <span className="text-xs text-slate-400 block">ร้านค้าที่เปิดบริการ</span>
          <div className="text-2xl font-black text-white font-jetbrains mt-1">
            {metrics.activeShops} / {metrics.totalShops}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#1C2541] border border-slate-700/60">
          <span className="text-xs text-slate-400 block">ร้านค้านักศึกษา (SE)</span>
          <div className="text-2xl font-black text-indigo-400 font-jetbrains mt-1">
            {metrics.studentVendors} <span className="text-xs font-normal text-slate-400">ร้าน</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#1C2541] border border-slate-700/60">
          <span className="text-xs text-slate-400 block">คำขอรอการอนุมัติ</span>
          <div className="text-2xl font-black text-amber-400 font-jetbrains mt-1">
            {metrics.pendingApprovals} <span className="text-xs font-normal text-slate-400">รายการ</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#1C2541] border border-slate-700/60">
          <span className="text-xs text-slate-400 block">ยอดอาหารที่เสิร์ฟวันนี้</span>
          <div className="text-2xl font-black text-emerald-400 font-jetbrains mt-1">
            {metrics.todayServedMeals} <span className="text-xs font-normal text-slate-400">จาน</span>
          </div>
        </div>
      </div>

      {/* Quick Launchpad */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => navigate(`/campus/${campusId}/approvals`)}
          className="p-5 rounded-2xl bg-[#1C2541] border border-slate-700/60 hover:border-indigo-500/60 cursor-pointer transition-all space-y-2 group shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CheckSquare className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-white font-kanit">อนุมัติร้านค้า & ผู้ประกอบการ</h3>
          <p className="text-xs text-slate-400">
            พิจารณาคำขอเปิดร้านค้าจำลองของนักศึกษา และตรวจมาตรฐานสุขอนามัย
          </p>
        </div>

        <div
          onClick={() => navigate(`/campus/${campusId}/monitoring`)}
          className="p-5 rounded-2xl bg-[#1C2541] border border-slate-700/60 hover:border-indigo-500/60 cursor-pointer transition-all space-y-2 group shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Tv className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-white font-kanit">หน้าจอทีวีคิวกลางโรงอาหาร</h3>
          <p className="text-xs text-slate-400">
            เปิดแสดงผลแบบเต็มจอบน Smart TV แยกฝั่งกำลังปรุง และพร้อมรับอาหาร
          </p>
        </div>

        <div
          onClick={() => navigate(`/campus/${campusId}/safety`)}
          className="p-5 rounded-2xl bg-[#1C2541] border border-slate-700/60 hover:border-indigo-500/60 cursor-pointer transition-all space-y-2 group shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <HeartPulse className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-white font-kanit">ค้นหาข้อมูลแพ้อาหารฉุกเฉิน</h3>
          <p className="text-xs text-slate-400">
            สำหรับพยาบาลและอาจารย์เวร ตรวจสอบประวัติแพ้ยา/อาหารและเบอร์ผู้ปกครอง
          </p>
        </div>
      </div>
    </div>
  );
};

export default CampusOverviewDashboard;
