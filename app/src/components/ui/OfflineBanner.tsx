import { useEffect, useState } from 'react';
import { View, Text, Animated, Platform } from 'react-native';
import { WifiOff, Wifi } from 'lucide-react-native';
import * as Network from 'expo-network';
import { useLanguage } from '../../context/LanguageContext';

export function OfflineBanner() {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const translateY = useState(new Animated.Value(-50))[0];

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
        // If we can't check, assume online
        if (isMounted) {
          setIsOnline(true);
        }
      }
    };

    // Initial check
    checkConnection();

    // Set up polling for network state changes
    const interval = setInterval(checkConnection, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

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
      setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowBanner(false);
        });
      }, 2000);
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
        className={`flex-row items-center justify-center py-2 px-4 ${
          isOnline ? 'bg-success' : 'bg-danger'
        }`}
        style={{
          paddingTop: Platform.OS === 'ios' ? 44 : 24,
        }}
      >
        {isOnline ? (
          <Wifi size={16} color="white" />
        ) : (
          <WifiOff size={16} color="white" />
        )}
        <Text className="text-white font-medium ml-2 text-sm">
          {isOnline ? t('backOnline') : t('youAreOffline')}
        </Text>
      </View>
    </Animated.View>
  );
}
