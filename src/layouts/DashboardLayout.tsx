import React from 'react';

export interface DashboardLayoutProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  noScroll?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  header,
  sidebar,
  children,
  noScroll = false,
}) => {
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-gray-50">
      {/* Thanh Header toàn màn hình (Top Header) */}
      {header}

      {/* Thân trang: Sidebar bên trái và Nội dung chính bên phải */}
      <div className="flex flex-1 overflow-hidden">
        {/* Cột trái (Sidebar) */}
        {sidebar}

        {/* Cột phải (Main Content) */}
        <main className={`flex-1 ${noScroll ? 'overflow-hidden flex flex-col p-3 md:p-4' : 'overflow-y-auto p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
