import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar - hidden on mobile */}
      {!isMobile && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Mobile Header - shown only on mobile */}
      {isMobile && <MobileHeader />}

      {/* Main Content Area */}
      <main
        className={`min-h-screen transition-all duration-300 ${
          isMobile ? 'pt-16' : sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
