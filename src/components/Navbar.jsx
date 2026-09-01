import { Calculator, LineChart, Sparkles, History } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'calculator', label: 'คำนวณส่วนสูง & BMI', icon: Calculator },
    { id: 'chart', label: 'กราฟมาตรฐาน WHO', icon: LineChart },
    { id: 'ai-advisor', label: 'AI แนะนำสุขภาพ', icon: Sparkles },
    { id: 'history', label: 'บันทึกประวัติ & PDF', icon: History }
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      {/* เส้นไล่สีบางๆ ด้านบนสุด เป็นลายเซ็นของแบรนด์ */}
      <div className="h-[3px] w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-3.5 md:py-0 md:h-20">

          {/* Logo & Branding */}
          <button
            onClick={() => setActiveTab('calculator')}
            className="flex items-center gap-3.5 focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-4 rounded-2xl group text-left cursor-pointer transition-transform duration-200 active:scale-[0.98]"
          >
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-1.5 shadow-sm ring-1 ring-slate-900/5 group-hover:shadow-md group-hover:ring-emerald-200 transition-all duration-300">
              <img
                src="/logo.png"
                alt="KidGrowth Logo"
                className="w-full h-full object-contain drop-shadow-sm"
              />
              {/* จุดเล็กๆ สื่อถึงการเติบโต */}
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent tracking-tight block leading-tight">
                KidGrowth Calculator
              </span>
              <span className="hidden sm:block text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                เครื่องคำนวณส่วนสูง &amp; BMI เด็ก
              </span>
            </div>
          </button>

          {/* Navigation: ซ่อนบนมือถือ แสดงตั้งแต่ md ขึ้นไป */}
          <nav className="hidden md:flex flex-wrap justify-center items-center gap-1 bg-slate-100/70 p-1.5 rounded-2xl ring-1 ring-slate-200/60 max-w-full overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-emerald-700'
                      : 'text-slate-500 hover:text-emerald-600'
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_10px_rgba(15,23,42,0.06)] ring-1 ring-emerald-100" />
                  )}
                  <Icon
                    className={`relative w-4 h-4 transition-colors duration-300 ${
                      isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-500'
                    }`}
                  />
                  <span className="relative">{item.label}</span>
                </button>
              );
            })}
          </nav>

        </div>
      </div>
    </header>
  );
}
