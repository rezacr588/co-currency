import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';

const MOBILE_MEDIA_QUERY = '(max-width: 1023px)';

function getInitialMobileState() {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(getInitialMobileState);

  // Keep layout in sync with viewport without desktop-first flash on mobile.
  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
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
        className={`min-h-screen transition-all duration-300 ${isMobile ? 'pt-16 pb-20' : sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
          }`}
      >
        <Outlet />
      </main>

      {/* Bottom Navigation - shown only on mobile for authenticated users */}
      {isMobile && <BottomNav />}
    </div>
  );
}
