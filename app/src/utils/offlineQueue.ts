import * as Network from 'expo-network';
import { readSecure, writeSecure, removeSecure } from './storage';
import { api } from '../api';
import type { TransactionRequest } from '../types/wallet';

const QUEUE_KEY = '@offline_transaction_queue';
const MAX_RETRIES = 3;
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_DELAY_MS = 30_000;
const FAILED_RETRY_DELAY_MS = 5 * 60 * 1000;

export interface QueuedTransaction {
  id: string;
  data: TransactionRequest;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  nextRetryAt?: number;
  failedAt?: number;
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
    const data = await readSecure(QUEUE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    if (__DEV__) console.error('Failed to get queued transactions:', error);
    return [];
  }
}

// Add a transaction to the queue
export async function queueTransaction(transaction: TransactionRequest): Promise<string> {
  const existing = await getQueuedTransactions();
  if (existing.length >= MAX_QUEUE_SIZE) {
    throw new Error('Offline queue is full. Please sync pending transactions first.');
  }

  const queued: QueuedTransaction = {
    id: generateId(),
    data: transaction,
    createdAt: Date.now(),
    retryCount: 0,
  };

  existing.push(queued);

  await writeSecure(QUEUE_KEY, JSON.stringify(existing));
  notifyListeners();

  return queued.id;
}

// Remove a transaction from the queue
export async function removeFromQueue(id: string): Promise<void> {
  const existing = await getQueuedTransactions();
  const filtered = existing.filter((tx) => tx.id !== id);
  await writeSecure(QUEUE_KEY, JSON.stringify(filtered));
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
    await writeSecure(QUEUE_KEY, JSON.stringify(existing));
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
    if (item.nextRetryAt && item.nextRetryAt > Date.now()) {
      continue;
    }

    try {
      // Attempt to sync
      await api.wallet.addTransaction(item.data);

      // Success - remove from queue
      await removeFromQueue(item.id);
      synced++;
    } catch (error) {
      const newRetryCount = item.retryCount + 1;
      const nextDelay =
        newRetryCount >= MAX_RETRIES
          ? FAILED_RETRY_DELAY_MS
          : Math.min(1000 * Math.pow(2, Math.max(0, newRetryCount - 1)), MAX_RETRY_DELAY_MS);

      if (__DEV__ && newRetryCount >= MAX_RETRIES) {
        console.warn(
          `[OfflineQueue] Keeping failed transaction in recovery queue after ${MAX_RETRIES} retries:`,
          item.data.description || item.id
        );
      }

      await updateQueuedTransaction(item.id, {
        retryCount: newRetryCount,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        nextRetryAt: Date.now() + nextDelay,
        failedAt: newRetryCount >= MAX_RETRIES ? item.failedAt || Date.now() : undefined,
      });
      failed++;
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
  await removeSecure(QUEUE_KEY);
  await notifyListeners();
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
      await notifyListeners();
    } catch (error) {
      // Ignore errors
    }
  }, 10000);

  // Initial check
  Network.getNetworkStateAsync().then((state) => {
    lastNetworkState = state.isConnected ?? false;
  }).catch(() => {});
}

export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}
