import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Use SecureStore for sensitive data on native, AsyncStorage on web
const isNative = Platform.OS !== 'web';

// Secure storage for tokens (uses SecureStore on native, AsyncStorage on web)
export async function readSecure(key: string): Promise<string | null> {
  try {
    if (isNative) {
      return await SecureStore.getItemAsync(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeSecure(key: string, value: string): Promise<void> {
  try {
    if (isNative) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function removeSecure(key: string): Promise<void> {
  try {
    if (isNative) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

// Regular storage for non-sensitive data (uses AsyncStorage on all platforms)
export async function readStorage(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeStorage(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
}

export async function removeStorage(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

export async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await readStorage(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJSON<T>(key: string, value: T): Promise<void> {
  try {
    await writeStorage(key, JSON.stringify(value));
  } catch {
    // Ignore serialization/storage errors
  }
}

export async function readSecureJSON<T>(key: string): Promise<T | null> {
  const raw = await readSecure(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeSecureJSON<T>(key: string, value: T): Promise<void> {
  try {
    await writeSecure(key, JSON.stringify(value));
  } catch {
    // Ignore serialization/storage errors
  }
}
