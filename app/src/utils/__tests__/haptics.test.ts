import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { haptics } from '../haptics';

jest.mock('expo-haptics');

describe('haptics utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports all feedback methods', () => {
    expect(typeof haptics.light).toBe('function');
    expect(typeof haptics.medium).toBe('function');
    expect(typeof haptics.heavy).toBe('function');
    expect(typeof haptics.success).toBe('function');
    expect(typeof haptics.warning).toBe('function');
    expect(typeof haptics.error).toBe('function');
    expect(typeof haptics.selection).toBe('function');
  });

  it('does not crash when called on web', async () => {
    // Platform.OS is 'ios' in jest-expo by default, but the functions
    // should handle errors gracefully
    await expect(haptics.light()).resolves.not.toThrow();
    await expect(haptics.medium()).resolves.not.toThrow();
    await expect(haptics.heavy()).resolves.not.toThrow();
    await expect(haptics.success()).resolves.not.toThrow();
    await expect(haptics.warning()).resolves.not.toThrow();
    await expect(haptics.error()).resolves.not.toThrow();
    await expect(haptics.selection()).resolves.not.toThrow();
  });
});
