import React from 'react';
import { Clock, CheckCircle2, QrCode, ChefHat, Sparkles } from 'lucide-react';

export const ClientQueueTicket = ({ activeOrder }) => {
  if (!activeOrder) {
    return (
      <div className="bg-dark text-white p-4 rounded-4 shadow-sm text-center">
        <Clock className="w-8 h-8 text-warning mb-2 mx-auto" />
        <h6 className="fw-bold mb-1">ยังไม่มีคิวอาหารที่กำลังดำเนินการ</h6>
        <small className="text-muted">สั่งอาหารล่วงหน้าจากเมนูด้านล่าง เพื่อรับตั๋วคิวดิจิทัล</small>
      </div>
    );
  }

  return (
    <div className="bg-dark text-white rounded-4 p-4 shadow-lg space-y-3">
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2">
        <div>
          <small className="text-warning font-monospace text-uppercase">Live Ticket</small>
          <h3 className="fw-bold text-white mb-0">คิวของคุณ #{activeOrder.queueNumber}</h3>
        </div>
        <span className="badge bg-warning text-dark px-3 py-2 fw-bold">
          {activeOrder.queueStatus || 'รอดำเนินการ'}
        </span>
      </div>

      <div className="bg-secondary bg-opacity-20 p-3 rounded-3 space-y-2">
        <div className="d-flex justify-content-between small text-white-50">
          <span>เวลาคาดว่าเสร็จ:</span>
          <span className="fw-bold text-warning">{activeOrder.estimatedReadyTime || '12:00 น.'}</span>
        </div>
        <div className="d-flex justify-content-between small text-white-50">
          <span>เวลานัดรับ:</span>
          <span className="fw-bold text-white">{activeOrder.pickupTime || '12:00'} น.</span>
        </div>

        <div className="border-top pt-2 mt-2">
          <small className="text-white-50 fw-bold d-block mb-1">รายการที่สั่ง:</small>
          {(activeOrder.items || []).map((item, idx) => (
            <div key={idx} className="d-flex justify-content-between small">
              <span>• {item.menuItem?.name} x{item.quantity}</span>
              <span className="fw-bold">฿{(item.menuItem?.price || 0) * item.quantity}</span>
            </div>
          ))}
          <div className="d-flex justify-content-between fw-bold text-warning border-top pt-2 mt-2">
            <span>รวมทั้งสิ้น:</span>
            <span>{activeOrder.totalAmount} บาท</span>
          </div>
        </div>
      </div>
    </div>
  );
};
