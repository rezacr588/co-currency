import { useState, useEffect, useRef } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
    const [isOnline, setIsOnline] = useState(true);
    const [showBanner, setShowBanner] = useState(false);
    const onlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Check initial state
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            // Show "back online" briefly then hide
            onlineTimerRef.current = setTimeout(() => setShowBanner(false), 2000);
        };

        const handleOffline = () => {
            if (onlineTimerRef.current) {
                clearTimeout(onlineTimerRef.current);
                onlineTimerRef.current = null;
            }
            setIsOnline(false);
            setShowBanner(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // If initially offline, show banner
        if (!navigator.onLine) {
            setShowBanner(true);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (onlineTimerRef.current) {
                clearTimeout(onlineTimerRef.current);
            }
        };
    }, []);

    if (!showBanner) return null;

    return (
        <div
            className={`pointer-events-none fixed top-0 left-0 right-0 z-[100] py-2 px-4 text-center text-sm font-medium transition-all duration-300 safe-area-top ${isOnline
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-500 text-amber-900'
                }`}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-center justify-center gap-2">
                {!isOnline && <WifiOff className="w-4 h-4" />}
                <span>
                    {isOnline
                        ? "You're back online!"
                        : "You're offline - some features may be limited"}
                </span>
            </div>
        </div>
    );
}
