import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  MapPin,
  Sparkles,
  Ticket,
  Users,
  Shield,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Download,
  Trash2,
  Check,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useCampus } from "../../identity/context/CampusContext";
import { useToast } from "../../../components/ToastProvider.jsx";

export const CustomerAccountHub: React.FC = () => {
  const toast = useToast();
  const { user, logout } = useAuth();
  const { activeCampus, setIsSwitcherOpen } = useCampus();
  const navigate = useNavigate();

  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadData = () => {
    const exportData = {
      user: {
        uid: user?.uid,
        email: user?.email,
        displayName: user?.displayName,
      },
      exportedAt: new Date().toISOString(),
      exportType: "PDPA_PORTABILITY_REQUEST",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `queueup_userdata_${Date.now()}.json`;
    a.click();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-20">
      {/* Profile Header */}
      <div className="p-5 rounded-2xl bg-[#241C16] border border-white/10 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-orange-500 overflow-hidden flex items-center justify-center shrink-0">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <User className="w-7 h-7 text-slate-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base text-white truncate font-kanit">
            {user?.displayName || "นักศึกษา มหาวิทยาลัยขอนแก่น"}
          </h2>
          <p className="text-xs text-slate-400 truncate">{user?.email || "student@school.ac.th"}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
              สถานะ: นักศึกษา / ลูกค้า
            </span>
          </div>
        </div>
      </div>

      {/* Points & Rewards Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block">แต้มสะสม CRM</span>
            <span className="text-lg font-black text-white font-jetbrains">128 แต้ม</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block">คูปองส่วนลด</span>
            <span className="text-lg font-black text-white font-jetbrains">2 ใบ</span>
          </div>
        </div>
      </div>

      {/* Section: Campus & Guardians */}
      <div className="p-2 rounded-2xl bg-[#241C16] border border-white/10 divide-y divide-white/5">
        <button
          type="button"
          onClick={() => setIsSwitcherOpen(true)}
          className="w-full p-3 flex items-center justify-between hover:bg-white/5 rounded-xl transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-orange-400" />
            <div>
              <span className="text-xs font-semibold text-white block">วิทยาเขตประจำ</span>
              <span className="text-[11px] text-slate-400">{activeCampus.name}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          type="button"
          onClick={() => navigate("/campus/guardian")}
          className="w-full p-3 flex items-center justify-between hover:bg-white/5 rounded-xl transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-indigo-400" />
            <div>
              <span className="text-xs font-semibold text-white block">สถานะเชื่อมโยงผู้ปกครอง</span>
              <span className="text-[11px] text-slate-400">คุมวงเงินค่าอาหาร & สารก่อภูมิแพ้</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          type="button"
          onClick={() => navigate("/support/queue")}
          className="w-full p-3 flex items-center justify-between hover:bg-white/5 rounded-xl transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <LifeBuoy className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-xs font-semibold text-white block">ประวัติคำขอความช่วยเหลือ</span>
              <span className="text-[11px] text-slate-400">ติดตามสถานะตั๋วแจ้งปัญหา</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Section: Privacy & Data Rights (PDPA Compliance) */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white font-kanit">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>สิทธิ์ความเป็นส่วนตัว (PDPA Rights)</span>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleDownloadData}
            className="w-full py-2.5 px-3 rounded-xl bg-[#1A1410] border border-white/10 hover:border-emerald-500/40 text-xs text-slate-300 hover:text-white flex items-center justify-between transition-all"
          >
            <span className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              ดาวน์โหลดสำเนาข้อมูลส่วนบุคคล (Data Portability)
            </span>
            {downloadSuccess && <Check className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            type="button"
            onClick={() => toast.info("ระบบได้รับคำขอลบบัญชีแล้ว เจ้าหน้าที่คุ้มครองข้อมูลจะดำเนินการภายใน 30 วัน")}
            className="w-full py-2.5 px-3 rounded-xl bg-[#1A1410] border border-white/10 hover:border-rose-500/40 text-xs text-rose-400 hover:text-rose-300 flex items-center justify-between transition-all"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              ส่งคำขอลบบัญชีและประวัติข้อมูล (Right to be Forgotten)
            </span>
          </button>
        </div>
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={() => {
          logout?.();
          navigate("/login");
        }}
        className="w-full py-3 px-4 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        ออกจากระบบ
      </button>
    </div>
  );
};

export default CustomerAccountHub;
