import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  Flame,
  Clock,
  ChevronRight,
  ShieldAlert,
  CreditCard,
  User,
} from "lucide-react";
import { maskPhone } from "../../identity/roles/roles";

interface MerchantOrder {
  id: string;
  orderRef: string;
  queueNumber: string;
  customerDisplayName: string;
  customerPhoneMasked: string;
  pickupSlot: string;
  status: "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  paymentState: "PAID" | "PENDING_VERIFY" | "UNPAID";
  paymentMethod: "PromptPay QR" | "Campus Wallet" | "Pay at store";
  totalPriceSatang: number;
  fulfillmentAgeMinutes: number;
  isDelayed?: boolean;
  hasAllergenAlert?: boolean;
  allergenSummary?: string;
  items: {
    name: string;
    quantity: number;
    modifiers: string[];
  }[];
}

export const StoreOrderManagement: React.FC = () => {
  const { shopId = "store-kku-01" } = useParams<{ shopId: string }>();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");

  const [orders] = useState<MerchantOrder[]>([
    {
      id: "ord-101",
      orderRef: "ORD-9021",
      queueNumber: "Q007",
      customerDisplayName: "น้องพีท วิศวะฯ",
      customerPhoneMasked: maskPhone("0891234821"),
      pickupSlot: "12:15 - 12:25 น.",
      status: "PREPARING",
      paymentState: "PAID",
      paymentMethod: "PromptPay QR",
      totalPriceSatang: 5500,
      fulfillmentAgeMinutes: 8,
      isDelayed: false,
      hasAllergenAlert: true,
      allergenSummary: "แพ้อาหารทะเลรุนแรง (ระวังการปนเปื้อนกระทะ)",
      items: [
        {
          name: "ข้าวกะเพราหมูกรอบไข่ดาว",
          quantity: 1,
          modifiers: ["เผ็ดกลาง", "ไข่ดาวสุก", "ไม่ใส่ถั่วงอก"],
        },
      ],
    },
    {
      id: "ord-102",
      orderRef: "ORD-9022",
      queueNumber: "Q008",
      customerDisplayName: "กานดา ศิลปกรรม",
      customerPhoneMasked: maskPhone("0814567890"),
      pickupSlot: "12:20 - 12:30 น.",
      status: "CONFIRMED",
      paymentState: "PAID",
      paymentMethod: "Campus Wallet",
      totalPriceSatang: 11000,
      fulfillmentAgeMinutes: 3,
      isDelayed: false,
      hasAllergenAlert: false,
      items: [
        {
          name: "ข้าวกะเพราหมูสับไข่เค็ม",
          quantity: 2,
          modifiers: ["เผ็ดน้อย", "เพิ่มข้าว (+฿10)"],
        },
      ],
    },
    {
      id: "ord-103",
      orderRef: "ORD-9018",
      queueNumber: "Q006",
      customerDisplayName: "อาจารย์ สมชาย",
      customerPhoneMasked: maskPhone("0867891234"),
      pickupSlot: "12:00 - 12:10 น.",
      status: "READY",
      paymentState: "PAID",
      paymentMethod: "PromptPay QR",
      totalPriceSatang: 6500,
      fulfillmentAgeMinutes: 18,
      isDelayed: true,
      hasAllergenAlert: false,
      items: [
        {
          name: "ข้าวหมูกรอบคั่วพริกเกลือ",
          quantity: 1,
          modifiers: ["พิเศษเนื้อ"],
        },
      ],
    },
    {
      id: "ord-100",
      orderRef: "ORD-9015",
      queueNumber: "Q005",
      customerDisplayName: "วีรภัทร",
      customerPhoneMasked: maskPhone("0823456789"),
      pickupSlot: "11:50 - 12:00 น.",
      status: "COMPLETED",
      paymentState: "PAID",
      paymentMethod: "PromptPay QR",
      totalPriceSatang: 5500,
      fulfillmentAgeMinutes: 32,
      isDelayed: false,
      items: [
        {
          name: "ข้าวกะเพราหมูกรอบ",
          quantity: 1,
          modifiers: ["เผ็ดมาก"],
        },
      ],
    },
  ]);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.queueNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.orderRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerDisplayName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    const matchesPayment = paymentFilter === "ALL" || o.paymentState === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  const getStatusBadge = (status: MerchantOrder["status"]) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            รับออเดอร์แล้ว
          </span>
        );
      case "PREPARING":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30 animate-pulse">
            กำลังปรุง
          </span>
        );
      case "READY":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            พร้อมรับ
          </span>
        );
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            สำเร็จแล้ว
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            ยกเลิก
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-kanit">
            จัดการรายการสั่งซื้อ (Order Management)
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            ร้านค้า: <span className="text-orange-400 font-mono font-medium">{shopId}</span> • ตรวจสอบคิว อัปเดตสถานะ และตรวจสอบคำขอพิเศษ
          </p>
        </div>

        {/* Quick KDS jump button */}
        <button
          type="button"
          onClick={() => navigate(`/business/${shopId}/operations`)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors shadow-md shadow-orange-950/40"
        >
          <Flame className="w-4 h-4" />
          <span>เปิดหน้าจอครัว KDS สัมผัส</span>
        </button>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2.5">
          <User className="w-4 h-4 text-orange-400" />
          <span>
            <strong className="text-zinc-300">ความปลอดภัยของข้อมูลลูกค้า: </strong>
            เบอร์โทรศัพท์และข้อมูลติดต่อแสดงในรูปแบบซ่อนบางส่วน (Masked) เพื่อคุ้มครองข้อมูลส่วนบุคคลตามนโยบายระบบ
          </span>
        </div>
        <span className="text-[11px] text-zinc-500 hidden sm:inline">Least-Privilege Mode</span>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาด้วยหมายเลขคิว (Q007), รหัสออเดอร์ (ORD-9021) หรือชื่อลูกค้า..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#18181B] border border-zinc-800 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-[#18181B] border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-orange-500"
          >
            <option value="ALL">สถานะทั้งหมด</option>
            <option value="CONFIRMED">รับออเดอร์แล้ว</option>
            <option value="PREPARING">กำลังปรุง</option>
            <option value="READY">พร้อมรับอาหาร</option>
            <option value="COMPLETED">สำเร็จแล้ว</option>
            <option value="CANCELLED">ยกเลิก</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-[#18181B] border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-orange-500"
          >
            <option value="ALL">การชำระเงินทั้งหมด</option>
            <option value="PAID">ชำระแล้ว (PAID)</option>
            <option value="PENDING_VERIFY">รอตรวจสอบสลิป</option>
          </select>
        </div>
      </div>

      {/* Orders List Table / Cards */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#18181B] border border-zinc-800 space-y-2">
            <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
            <h3 className="font-bold text-sm text-zinc-300">ไม่พบรายการสั่งซื้อตามตัวกรอง</h3>
            <p className="text-xs text-zinc-500">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => navigate(`/business/${shopId}/orders/${order.id}`)}
              className="p-4 rounded-2xl bg-[#18181B] border border-zinc-800 hover:border-orange-500/50 cursor-pointer transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              {/* Left Side: Queue Badge + Order Info */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-700/80 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">คิว</span>
                  <span className="font-mono text-xl font-black text-orange-400 group-hover:scale-105 transition-transform">
                    {order.queueNumber}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-white">
                      {order.orderRef}
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-xs font-semibold text-zinc-300">
                      {order.customerDisplayName}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      ({order.customerPhoneMasked})
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400">
                    รอบรับ: <span className="text-white font-medium">{order.pickupSlot}</span>
                  </p>

                  <div className="text-xs text-zinc-300 flex flex-wrap gap-2 pt-0.5">
                    {order.items.map((it, idx) => (
                      <span key={idx} className="bg-zinc-800/80 px-2 py-0.5 rounded-lg border border-zinc-700/50">
                        {it.quantity}x {it.name}
                      </span>
                    ))}
                  </div>

                  {order.hasAllergenAlert && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-lg mt-1 w-fit">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{order.allergenSummary}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Status, Payment, Price, Arrow */}
              <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-800">
                <div className="text-left md:text-right">
                  <div className="font-mono font-black text-sm text-white">
                    ฿{(order.totalPriceSatang / 100).toFixed(0)}
                  </div>
                  <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                    <CreditCard className="w-3 h-3 text-emerald-400" />
                    <span>{order.paymentMethod}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(order.status)}
                  <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StoreOrderManagement;
