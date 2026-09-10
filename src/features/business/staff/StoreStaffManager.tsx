import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Users,
  UserPlus,
  Shield,
  Clock,
  Search,
  X,
} from "lucide-react";
import { StoreRole } from "../../identity/roles/roles";
import { useToast } from "../../../components/ToastProvider.jsx";

const generateStaffId = () => `staff-${Date.now()}`;

interface StaffMember {
  id: string;
  name: string;
  staffRef: string;
  emailMasked: string;
  role: StoreRole;
  roleName: string;
  status: "ACTIVE" | "SUSPENDED" | "INVITED";
  isOnDuty: boolean;
  shiftHours: string;
  trainingCompleted: boolean;
  lastActive: string;
}

export const StoreStaffManager: React.FC = () => {
  const { shopId = "store-kku-01" } = useParams<{ shopId: string }>();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"members" | "shifts" | "roles">("members");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Invite Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StoreRole>("kitchen_staff");
  const [inviteShift, setInviteShift] = useState("กะเช้า (08:30 - 14:00 น.)");

  const [staffList, setStaffList] = useState<StaffMember[]>([
    {
      id: "staff-1",
      name: "คุณกานต์ วิทยาศิริกุล",
      staffRef: "STF-001",
      emailMasked: "k***@kku.ac.th",
      role: "store_owner",
      roleName: "Store Owner (เจ้าของร้าน)",
      status: "ACTIVE",
      isOnDuty: true,
      shiftHours: "เต็มเวลา (08:00 - 17:00 น.)",
      trainingCompleted: true,
      lastActive: "เมื่อสักครู่",
    },
    {
      id: "staff-2",
      name: "สมชาย ใจดี",
      staffRef: "STF-002",
      emailMasked: "s***@gmail.com",
      role: "kitchen_lead",
      roleName: "Kitchen Lead (หัวหน้าครัว)",
      status: "ACTIVE",
      isOnDuty: true,
      shiftHours: "กะเช้า (08:30 - 14:30 น.)",
      trainingCompleted: true,
      lastActive: "5 นาทีที่แล้ว",
    },
    {
      id: "staff-3",
      name: "นราธิป (นศ. พาร์ตไทม์)",
      staffRef: "STF-003",
      emailMasked: "n***@school.ac.th",
      role: "kitchen_staff",
      roleName: "Kitchen Staff (พนักงานครัว)",
      status: "ACTIVE",
      isOnDuty: true,
      shiftHours: "กะกลางวัน (11:00 - 14:00 น.)",
      trainingCompleted: true,
      lastActive: "10 นาทีที่แล้ว",
    },
    {
      id: "staff-4",
      name: "วิภาดา รักบริการ",
      staffRef: "STF-004",
      emailMasked: "w***@gmail.com",
      role: "cashier",
      roleName: "Cashier (แคชเชียร์/ส่งมอบ)",
      status: "ACTIVE",
      isOnDuty: false,
      shiftHours: "กะบ่าย (12:00 - 17:00 น.)",
      trainingCompleted: true,
      lastActive: "เมื่อวานนี้",
    },
    {
      id: "staff-5",
      name: "อนุชา จิตอาสา",
      staffRef: "STF-005",
      emailMasked: "a***@school.ac.th",
      role: "analyst",
      roleName: "Analyst (นักวิเคราะห์ยอดขาย)",
      status: "SUSPENDED",
      isOnDuty: false,
      shiftHours: "นอกเวลา",
      trainingCompleted: false,
      lastActive: "3 วันที่แล้ว",
    },
  ]);

  const toggleDuty = (staffId: string) => {
    setStaffList((prev) =>
      prev.map((s) => {
        if (s.id === staffId) {
          const newDuty = !s.isOnDuty;
          toast.info(`${s.name} ${newDuty ? "เข้ากะปฏิบัติงานแล้ว" : "ออกกะแล้ว"}`);
          return { ...s, isOnDuty: newDuty };
        }
        return s;
      })
    );
  };

  const toggleSuspend = (staffId: string) => {
    setStaffList((prev) =>
      prev.map((s) => {
        if (s.id === staffId) {
          const newStatus = s.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
          toast.warning(`เปลี่ยนสถานะของ ${s.name} เป็น ${newStatus}`);
          return { ...s, status: newStatus, isOnDuty: false };
        }
        return s;
      })
    );
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const newStaff: StaffMember = {
      id: generateStaffId(),
      name: inviteName.trim(),
      staffRef: `STF-00${staffList.length + 1}`,
      emailMasked: inviteEmail.replace(/(.{1})(.*)(@.*)/, "$1***$3"),
      role: inviteRole,
      roleName: getRoleLabel(inviteRole),
      status: "INVITED",
      isOnDuty: false,
      shiftHours: inviteShift,
      trainingCompleted: false,
      lastActive: "รอการตอบรับคำเชิญ",
    };

    setStaffList((prev) => [...prev, newStaff]);
    setShowInviteModal(false);
    setInviteName("");
    setInviteEmail("");
    toast.success(`ส่งคำเชิญไปยัง ${inviteEmail} เรียบร้อย`);
  };

  const getRoleLabel = (role: StoreRole) => {
    switch (role) {
      case "store_owner":
        return "Store Owner (เจ้าของร้าน)";
      case "store_manager":
        return "Store Manager (ผู้จัดการร้าน)";
      case "kitchen_lead":
        return "Kitchen Lead (หัวหน้าครัว)";
      case "kitchen_staff":
        return "Kitchen Staff (พนักงานครัว)";
      case "cashier":
        return "Cashier (แคชเชียร์/ส่งมอบ)";
      case "analyst":
        return "Analyst (นักวิเคราะห์ยอดขาย)";
      case "student_vendor":
        return "Student Vendor (ร้านค้านักศึกษา)";
    }
  };

  const filteredStaff = staffList.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.roleName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-kanit flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-400" />
            <span>จัดการพนักงานและกะงาน (Staff & Shifts)</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            ร้านค้า: <span className="text-orange-400 font-mono font-medium">{shopId}</span> • จัดการบทบาท สิทธิ์หน้าจอ KDS และการเข้ากะ
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors shadow-md shadow-orange-950/40"
        >
          <UserPlus className="w-4 h-4" />
          <span>เชิญพนักงานใหม่เข้าร้าน</span>
        </button>
      </div>

      {/* Security Shield Notice */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-start gap-3">
        <Shield className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-400 leading-relaxed">
          <strong className="text-zinc-200">หลักการ Least-Privilege Staff Isolation: </strong>
          พนักงานครัว (Kitchen Staff) จะเข้าถึงได้เฉพาะหน้าจอเตรียมอาหาร KDS โดยไม่สามารถเข้าถึงรายงานยอดขายหรือข้อมูลการเงินของร้านค้า
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === "members"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>รายชื่อพนักงาน ({staffList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shifts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === "shifts"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>กะปฏิบัติงาน (Shifts)</span>
        </button>
      </div>

      {/* Tab 1: Staff Members */}
      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อพนักงาน หรือบทบาท..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#18181B] border border-zinc-800 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="bg-[#18181B] border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
            {filteredStaff.map((staff) => (
              <div
                key={staff.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-white">{staff.name}</h3>
                      <span className="font-mono text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">
                        {staff.staffRef}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          staff.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : staff.status === "SUSPENDED"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {staff.status}
                      </span>
                    </div>

                    <p className="text-xs text-orange-400 font-semibold mt-0.5">
                      {staff.roleName}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 flex-wrap">
                      <span>อีเมล: {staff.emailMasked}</span>
                      <span>•</span>
                      <span>กะ: {staff.shiftHours}</span>
                      <span>•</span>
                      <span>ใช้งานล่าสุด: {staff.lastActive}</span>
                    </div>
                  </div>
                </div>

                {/* Duty & Suspension Controls */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => toggleDuty(staff.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      staff.isOnDuty
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-zinc-850 text-zinc-400 border-zinc-700 hover:text-white"
                    }`}
                  >
                    {staff.isOnDuty ? "กำลังเข้ากะ (On Duty)" : "ออกกะ (Off Duty)"}
                  </button>

                  {staff.role !== "store_owner" && (
                    <button
                      type="button"
                      onClick={() => toggleSuspend(staff.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        staff.status === "SUSPENDED"
                          ? "bg-emerald-600 text-white border-emerald-500"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                      }`}
                    >
                      {staff.status === "SUSPENDED" ? "ปลดระงับ" : "ระงับสิทธิ์"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Shifts */}
      {activeTab === "shifts" && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-white font-kanit">ตารางกะการทำงานร้านอาหาร</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: "กะเช้า (เตรียมวัตถุดิบ/ผัด)", time: "08:30 - 11:30 น.", staffCount: 2 },
              { title: "กะกลางวัน (ช่วงพีคเที่ยง)", time: "11:30 - 14:00 น.", staffCount: 3 },
              { title: "กะบ่าย (ทำความสะอาด/ปิดร้าน)", time: "14:00 - 17:00 น.", staffCount: 1 },
            ].map((shift, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <h4 className="font-bold text-xs text-white">{shift.title}</h4>
                <div className="flex items-center gap-1.5 text-xs text-orange-400 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{shift.time}</span>
                </div>
                <div className="text-[11px] text-zinc-500">พนักงานในกะ: {shift.staffCount} คน</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Staff Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#18181B] border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-kanit">เชิญพนักงานใหม่เข้าร้าน</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-300 font-medium">ชื่อ-นามสกุล พนักงาน</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="เช่น สมศักดิ์ มีสุข"
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-medium">อีเมลสถาบัน / บัญชี Google</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="student@kkumail.com"
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-medium">บทบาทหน้าที่ (Store Role)</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as StoreRole)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                >
                  <option value="kitchen_staff">Kitchen Staff (พนักงานครัว - ดู KDS ได้)</option>
                  <option value="kitchen_lead">Kitchen Lead (หัวหน้าครัว - จัดการคิว)</option>
                  <option value="cashier">Cashier (แคชเชียร์ - ตรวจสลิป/ส่งมอบ)</option>
                  <option value="store_manager">Store Manager (ผู้จัดการร้าน)</option>
                  <option value="analyst">Analyst (ดูเฉพาะรายงานยอดขาย)</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-300 font-medium">กะประจำ</label>
                <select
                  value={inviteShift}
                  onChange={(e) => setInviteShift(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                >
                  <option value="กะเช้า (08:30 - 14:00 น.)">กะเช้า (08:30 - 14:00 น.)</option>
                  <option value="กะกลางวัน (11:00 - 14:00 น.)">กะกลางวัน (11:00 - 14:00 น.)</option>
                  <option value="กะบ่าย (12:00 - 17:00 น.)">กะบ่าย (12:00 - 17:00 น.)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-colors shadow"
                >
                  ส่งคำเชิญ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreStaffManager;
