import { useEffect, useRef, useCallback, useState } from 'react';
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
  const [showTagline, setShowTagline] = useState(false);
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
    // Logo appears with spring animation
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withSequence(
      withSpring(1.1, { damping: 8, stiffness: 100 }),
      withSpring(1, { damping: 12, stiffness: 100 })
    );

    // App name fades in
    textOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));

    // Tagline fades in
    taglineOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));

    // Show tagline state
    const taglineTimer = setTimeout(() => setShowTagline(true), 800);

    // Fade out everything and call completion
    containerOpacity.value = withDelay(
      2200,
      withTiming(0, { duration: 400, easing: Easing.ease }, (finished) => {
        if (finished) {
          runOnJS(handleComplete)();
        }
      })
    );

    return () => clearTimeout(taglineTimer);
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
