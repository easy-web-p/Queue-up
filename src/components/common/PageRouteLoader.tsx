import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const PageRouteLoaderView: React.FC<{ message?: string; progress?: number }> = ({
  message = 'กำลังโหลดหน้าที่คุณเลือก...',
  progress = 75
}) => {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="relative w-16 h-16 mb-4">
        <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-orange-600">
          {progress}%
        </div>
      </div>
      <p className="text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">{message}</p>
      <p className="text-xs text-stone-400 dark:text-zinc-500">ระบบคิวอาหารอัจฉริยะ QueueUp มหาวิทยาลัยขอนแก่น</p>
    </div>
  );
};

export const PageRouteLoader: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent overflow-hidden">
      <div className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 animate-pulse w-full transition-all duration-300" />
    </div>
  );
};
