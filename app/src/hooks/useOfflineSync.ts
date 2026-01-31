import { useState, useEffect, useCallback } from 'react';
import {
  getQueueStatus,
  syncQueue,
  subscribeToQueueStatus,
  startAutoSync,
  stopAutoSync,
  getQueuedTransactions,
  type QueueStatus,
  type QueuedTransaction,
} from '../utils/offlineQueue';

export interface UseOfflineSyncResult {
  status: QueueStatus;
  queuedTransactions: QueuedTransaction[];
  sync: () => Promise<{ synced: number; failed: number; remaining: number }>;
  isLoading: boolean;
}

export function useOfflineSync(): UseOfflineSyncResult {
  const [status, setStatus] = useState<QueueStatus>({
    pendingCount: 0,
    isOnline: true,
    isSyncing: false,
  });
  const [queuedTransactions, setQueuedTransactions] = useState<QueuedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial status
  useEffect(() => {
    const loadStatus = async () => {
      const currentStatus = await getQueueStatus();
      const transactions = await getQueuedTransactions();
      setStatus(currentStatus);
      setQueuedTransactions(transactions);
      setIsLoading(false);
    };

    loadStatus();

    // Start auto-sync on mount
    startAutoSync();

    // Subscribe to status changes
    const unsubscribe = subscribeToQueueStatus(async (newStatus) => {
      setStatus(newStatus);
      const transactions = await getQueuedTransactions();
      setQueuedTransactions(transactions);
    });

    // Cleanup
    return () => {
      unsubscribe();
      stopAutoSync();
    };
  }, []);

  // Manual sync trigger
  const sync = useCallback(async () => {
    return syncQueue();
  }, []);

  return {
    status,
    queuedTransactions,
    sync,
    isLoading,
  };
}
