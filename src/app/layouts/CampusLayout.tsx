import React from "react";
import { Outlet, NavLink, useParams, useNavigate } from "react-router-dom";
import { GraduationCap, Store, CheckSquare, Tv, HeartPulse, Users, Shield } from "lucide-react";
import { useCampus } from "../../features/identity/context/CampusContext";

export const CampusLayout: React.FC = () => {
  const { campusId = "kku-complex" } = useParams<{ campusId: string }>();
  const { activeCampus } = useCampus();
  const navigate = useNavigate();

  const navLinks = [
    { to: `/campus/${campusId}/overview`, label: "ภาพรวมสถาบัน", icon: GraduationCap },
    { to: `/campus/${campusId}/shops`, label: "ร้านค้าในโรงอาหาร", icon: Store },
    { to: `/campus/${campusId}/approvals`, label: "อนุมัติร้านค้า", icon: CheckSquare },
    { to: `/campus/${campusId}/monitoring`, label: "จอทีวีคิวกลาง", icon: Tv },
    { to: `/campus/${campusId}/safety`, label: "ข้อมูลแพ้อาหาร/ฉุกเฉิน", icon: HeartPulse },
    { to: `/campus/${campusId}/guardians`, label: "เครือข่ายผู้ปกครอง", icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0B132B] text-slate-100 antialiased font-sans">
      {/* Campus Header */}
      <header className="bg-[#1C2541] border-b border-slate-700/60 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate(`/campus/${campusId}/overview`)}
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight font-kanit">QueueUp</span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                CAMPUS GOVERNANCE
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span className="hidden sm:inline text-slate-400">วิทยาเขต:</span>
            <span className="font-semibold text-white px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
              {activeCampus.name}
            </span>
          </div>
        </div>
      </header>

      {/* Nav Bar */}
      <div className="bg-[#151D36] border-b border-slate-800 px-4 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-1 py-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`
              }
            >
              <link.icon className="w-4 h-4" />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default CampusLayout;
