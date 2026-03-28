import { useEffect, useRef, useCallback } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

interface AnimatedSplashProps {
  onAnimationComplete: () => void;
}

export function AnimatedSplash({ onAnimationComplete }: AnimatedSplashProps) {
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  // Stable function reference for runOnJS — must not be inline in worklet
  const handleComplete = useCallback(() => {
    onCompleteRef.current();
  }, []);

  // Animation values
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 220 });
    logoScale.value = withSequence(
      withSpring(1.04, { damping: 12, stiffness: 140 }),
      withSpring(1, { damping: 16, stiffness: 140 })
    );

    textOpacity.value = withDelay(120, withTiming(1, { duration: 180 }));
    taglineOpacity.value = withDelay(220, withTiming(1, { duration: 180 }));
    containerOpacity.value = withDelay(
      850,
      withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) {
          runOnJS(handleComplete)();
        }
      })
    );
  }, [handleComplete]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const taglineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      {/* Logo */}
      <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
        <Image
          source={require('../../../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App Name */}
      <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
        <Text style={styles.appName}>CoAI</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineContainer, taglineAnimatedStyle]}>
        <Text style={styles.tagline}>Your Personal Finance Advisor</Text>
      </Animated.View>

      {/* Bottom decoration */}
      <View style={styles.bottomBar}>
        <View style={styles.goldLine} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  textContainer: {
    marginBottom: 8,
  },
  appName: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#fafafa',
    letterSpacing: 1,
  },
  taglineContainer: {
    marginTop: 4,
  },
  tagline: {
    fontSize: 16,
    color: '#d4af37',
    fontFamily: 'Inter_500Medium',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    alignItems: 'center',
  },
  goldLine: {
    width: 60,
    height: 4,
    backgroundColor: '#d4af37',
    borderRadius: 2,
  },
});
