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
  } catch (error) {
    if (__DEV__) console.error(`[Storage] Failed to read secure key "${key}":`, error);
    return null;
  }
}

export async function writeSecure(key: string, value: string): Promise<boolean> {
  try {
    if (isNative) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
    return true;
  } catch (error) {
    if (__DEV__) console.error(`[Storage] Failed to write secure key "${key}":`, error);
    return false;
  }
}

export async function removeSecure(key: string): Promise<boolean> {
  try {
    if (isNative) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    if (__DEV__) console.error(`[Storage] Failed to remove secure key "${key}":`, error);
    return false;
  }
}

// Regular storage for non-sensitive data (uses AsyncStorage on all platforms)
export async function readStorage(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    if (__DEV__) console.error(`[Storage] Failed to read key "${key}":`, error);
    return null;
  }
}

export async function writeStorage(key: string, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (__DEV__) console.error(`[Storage] Failed to write key "${key}":`, error);
    return false;
  }
}

export async function removeStorage(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    if (__DEV__) console.error(`[Storage] Failed to remove key "${key}":`, error);
    return false;
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

export async function writeJSON<T>(key: string, value: T): Promise<boolean> {
  try {
    return await writeStorage(key, JSON.stringify(value));
  } catch (error) {
    if (__DEV__) console.error(`[Storage] Failed to write JSON key "${key}":`, error);
    return false;
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

export async function writeSecureJSON<T>(key: string, value: T): Promise<boolean> {
  try {
    return await writeSecure(key, JSON.stringify(value));
  } catch (error) {
    if (__DEV__) console.error(`[Storage] Failed to write secure JSON key "${key}":`, error);
    return false;
  }
}
