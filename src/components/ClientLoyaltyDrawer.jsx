import { Award, Gift } from 'lucide-react';

export const ClientLoyaltyDrawer = ({
  isOpen,
  onClose,
  profile = {},
  rewards = [],
  onRedeemReward,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full shadow-2xl flex flex-col font-['IBM_Plex_Sans_Thai'] border-l border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-gradient-to-br from-red-600 via-orange-600 to-amber-500 text-white p-6 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                <Award className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h5 className="font-['Kanit'] font-black text-lg mb-0 text-white">สะสมแต้ม CRM</h5>
                <span className="text-[11px] text-orange-100">แลกรับคูปองส่วนลดและสิทธิพิเศษ</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 flex justify-between items-center shadow-inner">
            <div>
              <span className="text-[11px] text-white/80 block font-medium">แต้มคงเหลือของคุณ</span>
              <h3 className="font-['Kanit'] font-black text-2xl mb-0 text-amber-300 drop-shadow-xs">
                {profile.points || 0} <span className="text-sm font-normal text-white">แต้ม</span>
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-white/80 block font-medium">ประวัติการสั่งซื้อ</span>
              <h5 className="font-['Kanit'] font-bold text-lg mb-0 text-white">
                {profile.ordersCount || 0} <span className="text-xs font-normal text-white/80">ครั้ง</span>
              </h5>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/40 space-y-4">
          <h6 className="font-['Kanit'] font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Gift className="w-4 h-4 text-orange-500" />
            <span>คูปองส่วนลดและของรางวัล</span>
          </h6>

          <div className="space-y-3">
            {rewards.map((reward) => {
              const canRedeem = (profile.points || 0) >= reward.pointsRequired;
              return (
                <div
                  key={reward.id}
                  className="p-4 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex justify-between items-center gap-3 transition-all hover:border-orange-500/30"
                >
                  <div className="flex-1 min-w-0">
                    <h6 className="font-['Kanit'] font-bold text-sm text-slate-900 dark:text-white truncate">
                      {reward.title}
                    </h6>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {reward.description}
                    </p>
                    <span className="inline-block mt-2 px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60 rounded-full text-[11px] font-bold">
                      ใช้ {reward.pointsRequired} แต้ม
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!canRedeem}
                    onClick={() => onRedeemReward(reward)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-['Kanit'] font-bold transition-all shrink-0 cursor-pointer ${
                      canRedeem
                        ? 'bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white shadow-md active:scale-95'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-70'
                    }`}
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
