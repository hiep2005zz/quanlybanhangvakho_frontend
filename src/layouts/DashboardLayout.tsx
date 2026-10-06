import React from 'react';

export interface DashboardLayoutProps {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  sidebar,
  children,
}) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Cột trái (Sidebar) */}
      {sidebar}

      {/* Cột phải (Main Content) */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
