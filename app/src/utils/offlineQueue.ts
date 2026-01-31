import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { api } from '../api';
import type { TransactionRequest } from '../types/wallet';

const QUEUE_KEY = '@offline_transaction_queue';
const MAX_RETRIES = 3;

export interface QueuedTransaction {
  id: string;
  data: TransactionRequest;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export interface QueueStatus {
  pendingCount: number;
  isOnline: boolean;
  isSyncing: boolean;
}

let isSyncing = false;
let syncListeners: ((status: QueueStatus) => void)[] = [];

// Generate a unique ID for queued transactions
function generateId(): string {
  return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get all queued transactions
export async function getQueuedTransactions(): Promise<QueuedTransaction[]> {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get queued transactions:', error);
    return [];
  }
}

// Add a transaction to the queue
export async function queueTransaction(transaction: TransactionRequest): Promise<string> {
  const queued: QueuedTransaction = {
    id: generateId(),
    data: transaction,
    createdAt: Date.now(),
    retryCount: 0,
  };

  const existing = await getQueuedTransactions();
  existing.push(queued);

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
  notifyListeners();

  return queued.id;
}

// Remove a transaction from the queue
export async function removeFromQueue(id: string): Promise<void> {
  const existing = await getQueuedTransactions();
  const filtered = existing.filter((tx) => tx.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  notifyListeners();
}

// Update a queued transaction (e.g., increment retry count)
async function updateQueuedTransaction(
  id: string,
  updates: Partial<QueuedTransaction>
): Promise<void> {
  const existing = await getQueuedTransactions();
  const index = existing.findIndex((tx) => tx.id === id);

  if (index !== -1) {
    existing[index] = { ...existing[index], ...updates };
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
  }
}

// Sync all queued transactions
export async function syncQueue(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (isSyncing) {
    return { synced: 0, failed: 0, remaining: 0 };
  }

  // Check network status
  const networkState = await Network.getNetworkStateAsync();
  if (!networkState.isConnected) {
    return { synced: 0, failed: 0, remaining: 0 };
  }

  isSyncing = true;
  notifyListeners();

  const queue = await getQueuedTransactions();
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      // Attempt to sync
      await api.wallet.addTransaction(item.data);

      // Success - remove from queue
      await removeFromQueue(item.id);
      synced++;
    } catch (error) {
      // Failed - increment retry count
      const newRetryCount = item.retryCount + 1;

      if (newRetryCount >= MAX_RETRIES) {
        // Remove from queue after max retries
        await removeFromQueue(item.id);
        failed++;
      } else {
        await updateQueuedTransaction(item.id, {
          retryCount: newRetryCount,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  isSyncing = false;
  notifyListeners();

  const remaining = (await getQueuedTransactions()).length;
  return { synced, failed, remaining };
}

// Get current queue status
export async function getQueueStatus(): Promise<QueueStatus> {
  const queue = await getQueuedTransactions();
  const networkState = await Network.getNetworkStateAsync();

  return {
    pendingCount: queue.length,
    isOnline: networkState.isConnected ?? false,
    isSyncing,
  };
}

// Subscribe to queue status changes
export function subscribeToQueueStatus(
  listener: (status: QueueStatus) => void
): () => void {
  syncListeners.push(listener);

  // Return unsubscribe function
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

// Notify all listeners of status change
async function notifyListeners() {
  const status = await getQueueStatus();
  syncListeners.forEach((listener) => listener(status));
}

// Clear the entire queue
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
  notifyListeners();
}

// Start network listener for auto-sync using polling
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;
let lastNetworkState = false;

export function startAutoSync(): void {
  if (autoSyncInterval) return;

  // Poll network state every 10 seconds
  autoSyncInterval = setInterval(async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const isConnected = networkState.isConnected ?? false;

      // If we just came back online, try to sync
      if (isConnected && !lastNetworkState) {
        const queue = await getQueuedTransactions();
        if (queue.length > 0) {
          await syncQueue();
        }
      }

      lastNetworkState = isConnected;
      notifyListeners();
    } catch (error) {
      // Ignore errors
    }
  }, 10000);

  // Initial check
  Network.getNetworkStateAsync().then((state) => {
    lastNetworkState = state.isConnected ?? false;
  });
}

export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}
