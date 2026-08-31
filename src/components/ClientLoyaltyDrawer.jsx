import React from 'react';
import { Award, Gift, ChevronRight, Check } from 'lucide-react';

export const ClientLoyaltyDrawer = ({
  isOpen,
  onClose,
  profile = {},
  rewards = [],
  onRedeemReward,
}) => {
  if (!isOpen) return null;

  return (
    <div className="position-fixed top-0 start-0 end-0 bottom-0 z-3 bg-dark bg-opacity-75 d-flex justify-content-end">
      <div className="bg-white w-100 h-100 shadow-lg d-flex flex-column" style={{ maxWidth: 420 }}>
        {/* Header */}
        <div className="bg-danger text-white p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
              <Award className="w-6 h-6 text-warning" />
              <h5 className="fw-bold mb-0">สะสมแต้ม CRM</h5>
            </div>
            <button onClick={onClose} className="btn btn-sm btn-outline-light border-0">
              ✕
            </button>
          </div>
          <div className="p-3 bg-white bg-opacity-20 rounded-3 d-flex justify-content-between align-items-center">
            <div>
              <span className="small text-white-50">แต้มคงเหลือ</span>
              <h3 className="fw-bold mb-0 text-warning">{profile.points || 0} แต้ม</h3>
            </div>
            <div className="text-end">
              <span className="small text-white-50">สั่งซื้อแล้ว</span>
              <h5 className="fw-bold mb-0 text-white">{profile.ordersCount || 0} ครั้ง</h5>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-grow-1 overflow-auto bg-light space-y-3">
          <h6 className="fw-bold text-dark d-flex align-items-center gap-2">
            <Gift className="w-5 h-5 text-danger" /> คูปองส่วนลดและของรางวัล
          </h6>

          <div className="space-y-2">
            {rewards.map((reward) => {
              const canRedeem = (profile.points || 0) >= reward.pointsRequired;
              return (
                <div key={reward.id} className="p-3 bg-white rounded-3 border d-flex justify-content-between align-items-center gap-2">
                  <div>
                    <h6 className="fw-bold mb-1 small">{reward.title}</h6>
                    <small className="text-muted d-block mb-1">{reward.description}</small>
                    <span className="badge bg-warning text-dark">ใช้ {reward.pointsRequired} แต้ม</span>
                  </div>
                  <button
                    disabled={!canRedeem}
                    onClick={() => onRedeemReward(reward)}
                    className={`btn btn-sm fw-bold ${canRedeem ? 'btn-theme-red' : 'btn-secondary disabled'}`}
                  >
                    {canRedeem ? 'แลกรางวัล' : 'แต้มไม่พอ'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
