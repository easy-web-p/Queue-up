import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Wallet,
  QrCode,
  Store,
  Download,
  TrendingUp,
  DollarSign,
  ArrowDownLeft,
  FileText,
  Lock,
} from "lucide-react";
import { useToast } from "../../../components/ToastProvider.jsx";

interface Transaction {
  id: string;
  orderRef: string;
  timestamp: string;
  amountSatang: number;
  paymentMethod: "PromptPay QR" | "Campus Wallet" | "Cash";
  status: "SETTLED" | "PENDING" | "REFUNDED";
  feeSatang: number;
}

export const StoreFinanceReports: React.FC = () => {
  const { shopId = "store-kku-01" } = useParams<{ shopId: string }>();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "settlements" | "payouts">("overview");

  const [financeSummary] = useState({
    todayGrossSatang: 485000, // ฿4,850.00
    walletShareSatang: 312000, // ฿3,120.00 (64%)
    promptpayShareSatang: 128000, // ฿1,280.00 (26%)
    cashShareSatang: 45000, // ฿450.00 (10%)
    platformFeeSatang: 14550, // 3%
    refundsSatang: 0,
    netPayoutSatang: 470450, // ฿4,704.50
    payoutStatus: "SCHEDULED_DAILY",
    maskedBankAccount: "ธนาคารไทยพาณิชย์ ••••-••••-8219 (นาย กานต์)",
  });

  const [transactions] = useState<Transaction[]>([
    {
      id: "tx-901",
      orderRef: "ORD-9021",
      timestamp: "10 ก.ย. 2026 11:45:15 น.",
      amountSatang: 5500,
      paymentMethod: "PromptPay QR",
      status: "SETTLED",
      feeSatang: 165,
    },
    {
      id: "tx-902",
      orderRef: "ORD-9022",
      timestamp: "10 ก.ย. 2026 11:48:30 น.",
      amountSatang: 11000,
      paymentMethod: "Campus Wallet",
      status: "SETTLED",
      feeSatang: 330,
    },
    {
      id: "tx-903",
      orderRef: "ORD-9018",
      timestamp: "10 ก.ย. 2026 11:32:00 น.",
      amountSatang: 6500,
      paymentMethod: "PromptPay QR",
      status: "SETTLED",
      feeSatang: 195,
    },
    {
      id: "tx-904",
      orderRef: "ORD-9015",
      timestamp: "10 ก.ย. 2026 11:15:20 น.",
      amountSatang: 5500,
      paymentMethod: "PromptPay QR",
      status: "SETTLED",
      feeSatang: 165,
    },
  ]);

  const [settlements] = useState([
    {
      id: "stl-20260909",
      date: "09 ก.ย. 2026",
      grossSatang: 642000,
      feeSatang: 19260,
      netSatang: 622740,
      status: "PAID_TO_BANK",
      transferredAt: "09 ก.ย. 2026 18:05 น.",
    },
    {
      id: "stl-20260908",
      date: "08 ก.ย. 2026",
      grossSatang: 589000,
      feeSatang: 17670,
      netSatang: 571330,
      status: "PAID_TO_BANK",
      transferredAt: "08 ก.ย. 2026 18:02 น.",
    },
  ]);

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "TxID,OrderRef,Timestamp,AmountBaht,PaymentMethod,Status\n" +
      transactions
        .map(
          (t) =>
            `${t.id},${t.orderRef},"${t.timestamp}",${(t.amountSatang / 100).toFixed(2)},${t.paymentMethod},${t.status}`
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `queueup_finance_${shopId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("ดาวน์โหลดรายงานการเงินเรียบร้อย");
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-kanit flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            <span>การเงิน & การชำระเงินสุทธิ (Finance & Settlements)</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            ร้านค้า: <span className="text-orange-400 font-mono font-medium">{shopId}</span> • ติดตามยอดขายสุทธิ การหักค่าธรรมเนียม และรอบโอนเงินอัตโนมัติ
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-xs transition-colors shadow"
        >
          <Download className="w-4 h-4 text-zinc-300" />
          <span>ส่งออกรายงาน CSV</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === "overview"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>ภาพรวมรายได้</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("transactions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === "transactions"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>รายการธุรกรรม ({transactions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settlements")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === "settlements"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>ประวัติรอบโอนเงิน (Settlements)</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-2">
              <span className="text-xs text-zinc-400">ยอดขายรวมวันนี้ (Gross Sales)</span>
              <div className="text-2xl font-black text-white font-jetbrains">
                ฿{(financeSummary.todayGrossSatang / 100).toFixed(2)}
              </div>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" /> +14.2% เทียบกับเมื่อวาน
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-2">
              <span className="text-xs text-zinc-400">ยอดเงินโอนสุทธิประจำวัน (Net Payout)</span>
              <div className="text-2xl font-black text-emerald-400 font-jetbrains">
                ฿{(financeSummary.netPayoutSatang / 100).toFixed(2)}
              </div>
              <span className="text-[11px] text-zinc-400">
                หักค่าธรรมเนียมศูนย์อาหาร ฿{(financeSummary.platformFeeSatang / 100).toFixed(2)}
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>บัญชีรับเงิน (Masked)</span>
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <div className="text-xs font-bold text-white truncate">
                {financeSummary.maskedBankAccount}
              </div>
              <span className="text-[11px] text-orange-400 font-semibold block">
                โอนอัตโนมัติทุกวันเวลา 18:00 น.
              </span>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="p-6 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-4">
            <h3 className="font-bold text-sm text-white font-kanit">
              สัดส่วนยอดขายแยกตามช่องทางการชำระเงิน
            </h3>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Campus Wallet (กระเป๋านักเรียน)</h4>
                    <p className="text-xs text-zinc-400">หักเงินผ่านบัญชีบัตรนักศึกษา มข.</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-base text-white">
                    ฿{(financeSummary.walletShareSatang / 100).toFixed(2)}
                  </div>
                  <span className="text-xs text-orange-400 font-semibold">64% ของยอดทั้งหมด</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">PromptPay Dynamic QR Code</h4>
                    <p className="text-xs text-zinc-400">สแกนจ่ายผ่านแอปพลิเคชันธนาคาร</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-base text-white">
                    ฿{(financeSummary.promptpayShareSatang / 100).toFixed(2)}
                  </div>
                  <span className="text-xs text-blue-400 font-semibold">26% ของยอดทั้งหมด</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">เงินสดหน้าร้าน (Pay at Store)</h4>
                    <p className="text-xs text-zinc-400">ชำระเงินสดตอนรับอาหารที่เคาน์เตอร์</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-base text-white">
                    ฿{(financeSummary.cashShareSatang / 100).toFixed(2)}
                  </div>
                  <span className="text-xs text-amber-400 font-semibold">10% ของยอดทั้งหมด</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Transactions */}
      {activeTab === "transactions" && (
        <div className="bg-[#18181B] border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
          <div className="p-4 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>รายการ / หมายเลขออเดอร์</span>
            <span>ยอดเงิน / ค่าธรรมเนียม</span>
          </div>

          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">{tx.orderRef}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {tx.status}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                  <span>{tx.timestamp}</span>
                  <span>•</span>
                  <span>{tx.paymentMethod}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono font-bold text-sm text-white">
                  +฿{(tx.amountSatang / 100).toFixed(2)}
                </div>
                <div className="text-[10px] text-zinc-500">
                  ธรรมเนียม: -฿{(tx.feeSatang / 100).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Settlements */}
      {activeTab === "settlements" && (
        <div className="bg-[#18181B] border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
          {settlements.map((stl) => (
            <div key={stl.id} className="p-5 space-y-2 hover:bg-zinc-800/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{stl.date}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    โอนเงินแล้ว
                  </span>
                </div>
                <div className="font-mono font-bold text-base text-emerald-400">
                  ฿{(stl.netSatang / 100).toFixed(2)}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                <span>ยอดขายดิบ: ฿{(stl.grossSatang / 100).toFixed(2)} (หัก ฿{(stl.feeSatang / 100).toFixed(2)})</span>
                <span>เวลาโอน: {stl.transferredAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoreFinanceReports;
