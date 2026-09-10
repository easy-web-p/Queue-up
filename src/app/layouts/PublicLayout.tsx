import React from "react";
import { Outlet } from "react-router-dom";

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#16100C] text-white">
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default PublicLayout;
