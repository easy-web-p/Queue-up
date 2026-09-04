import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { Tv, Clock, CheckCircle2, Flame, ArrowLeft, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MonitorOrder {
  id: string;
  queueNumber: string;
  customerName: string;
  status: string;
  queueStatus: string;
  storeId: string;
  pickupTime: string;
  updatedAt?: any;
}

export default function CampusQueueMonitor() {
  const [orders, setOrders] = useState<MonitorOrder[]>([]);
  const [activeZone, setActiveZone] = useState('ALL');

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP']),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MonitorOrder[];
      setOrders(items);
    });

    return () => unsubscribe();
  }, []);

  const preparingOrders = orders.filter((o) => o.status === 'PREPARING' || o.queueStatus === 'cooking' || o.status === 'PENDING' || o.status === 'CONFIRMED');
  const readyOrders = orders.filter((o) => o.status === 'READY_FOR_PICKUP' || o.queueStatus === 'ready');

  return (
    <div className="min-h-screen bg-[#100B08] text-white font-['IBM_Plex_Sans_Thai']">
      {/* TV Header */}
      <header className="bg-[#1D140F] border-b border-[#FF7A1A]/30 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/home" className="p-2 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-[#FF7A1A] hover:bg-[#FF7A1A]/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-black font-['Kanit'] text-white flex items-center gap-3">
              <Tv className="w-7 h-7 text-[#FF7A1A]" />
              จอแสดงสถานะคิวโรงอาหาร (Campus Live Canteen Board)
            </h1>
            <p className="text-xs text-[#9CA3AF]">อัปเดตสถานะคิวแบบเรียลไทม์ Real-Time Firebase Sync</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            LIVE SYNC
          </span>
        </div>
      </header>

      {/* Main Split Screen */}
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        {/* Left: PREPARING (กำลังปรุงอาหาร) */}
        <div className="bg-[#1C140F] border border-[#FF7A1A]/20 rounded-3xl p-6 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <h2 className="text-2xl font-bold font-['Kanit'] text-amber-400 flex items-center gap-3">
              <Flame className="w-7 h-7 text-amber-500" />
              กำลังเตรียมอาหาร (PREPARING)
            </h2>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 font-['JetBrains_Mono'] font-bold rounded-full text-sm">
              {preparingOrders.length} คิว
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1">
            {preparingOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-[#281D16] border border-amber-500/20 rounded-2xl p-4 text-center shadow-lg"
              >
                <span className="text-3xl font-black font-['JetBrains_Mono'] text-amber-400 tracking-wider">
                  {ord.queueNumber}
                </span>
                <p className="text-xs text-[#9CA3AF] mt-1 truncate">
                  รับ {ord.pickupTime || '--:--'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: READY FOR PICKUP (พร้อมรับอาหาร) */}
        <div className="bg-[#14231A] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4 mb-6">
            <h2 className="text-2xl font-bold font-['Kanit'] text-emerald-400 flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 animate-pulse" />
              พร้อมรับอาหารแล้ว (READY)
            </h2>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-['JetBrains_Mono'] font-bold rounded-full text-sm">
              {readyOrders.length} คิว
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1">
            {readyOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-[#1C3325] border-2 border-emerald-400 rounded-2xl p-5 text-center shadow-2xl animate-bounce-short"
              >
                <span className="text-4xl font-black font-['JetBrains_Mono'] text-emerald-300 tracking-wider">
                  {ord.queueNumber}
                </span>
                <p className="text-xs font-bold text-emerald-200 mt-2 truncate">
                  {ord.customerName}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
