import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptic feedback utility functions
// Only runs on native platforms (iOS/Android)

const isNative = Platform.OS !== 'web';

/**
 * Light impact - for button taps, toggles
 */
export async function lightImpact() {
  if (!isNative) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silently fail if haptics not available
  }
}

/**
 * Medium impact - for selections, confirmations
 */
export async function mediumImpact() {
  if (!isNative) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Silently fail if haptics not available
  }
}

/**
 * Heavy impact - for important actions
 */
export async function heavyImpact() {
  if (!isNative) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Silently fail if haptics not available
  }
}

/**
 * Success notification - for successful saves, completions
 */
export async function successNotification() {
  if (!isNative) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Silently fail if haptics not available
  }
}

/**
 * Warning notification - for warnings, alerts
 */
export async function warningNotification() {
  if (!isNative) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Silently fail if haptics not available
  }
}

/**
 * Error notification - for errors, failures
 */
export async function errorNotification() {
  if (!isNative) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Silently fail if haptics not available
  }
}

/**
 * Selection feedback - for picker/list selections
 */
export async function selectionFeedback() {
  if (!isNative) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Silently fail if haptics not available
  }
}

// Export a namespace for easy importing
export const haptics = {
  light: lightImpact,
  medium: mediumImpact,
  heavy: heavyImpact,
  success: successNotification,
  warning: warningNotification,
  error: errorNotification,
  selection: selectionFeedback,
};
