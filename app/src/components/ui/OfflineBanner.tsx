import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { WifiOff, Wifi } from 'lucide-react-native';
import * as Network from 'expo-network';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from 'styled-components/native';

const ONLINE_POLL_INTERVAL = 30_000;  // 30s when online
const OFFLINE_POLL_INTERVAL = 5_000;  // 5s when offline (fast recovery)

export function OfflineBanner() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const translateY = useState(new Animated.Value(-50))[0];
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkConnection = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        if (isMounted) {
          const online = networkState.isConnected && networkState.isInternetReachable !== false;
          setIsOnline(online ?? true);
        }
      } catch {
        if (isMounted) {
          setIsOnline(true);
        }
      }
    };

    // Initial check
    checkConnection();

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Adaptive polling: fast when offline, slow when online
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const delay = isOnline ? ONLINE_POLL_INTERVAL : OFFLINE_POLL_INTERVAL;
    intervalRef.current = setInterval(async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const online = networkState.isConnected && networkState.isInternetReachable !== false;
        setIsOnline(online ?? true);
      } catch {
        // assume online on error
      }
    }, delay);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    } else if (showBanner) {
      // Show "back online" briefly then hide
      const timer = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowBanner(false);
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showBanner, translateY]);

  if (!showBanner) {
    return null;
  }

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          paddingHorizontal: 16,
          backgroundColor: isOnline ? colors.success : colors.danger,
          paddingTop: insets.top,
        }}
      >
        {isOnline ? (
          <Wifi size={16} color="white" />
        ) : (
          <WifiOff size={16} color="white" />
        )}
        <Text style={{ color: '#ffffff', fontFamily: 'Inter_500Medium', marginStart: 8, fontSize: 14 }}>
          {isOnline ? t('backOnline') : t('youAreOffline')}
        </Text>
      </View>
    </Animated.View>
  );
}
