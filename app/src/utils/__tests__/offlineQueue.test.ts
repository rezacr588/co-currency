const mockSecureStore = new Map<string, string>();
const mockAddTransaction = jest.fn();

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })),
}));

jest.mock('../storage', () => ({
  readSecure: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  writeSecure: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
    return true;
  }),
  removeSecure: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
    return true;
  }),
}));

jest.mock('../../api', () => ({
  api: {
    wallet: {
      addTransaction: (...args: unknown[]) => mockAddTransaction(...args),
    },
  },
}));

import {
  clearQueue,
  getQueuedTransactions,
  queueTransaction,
  syncQueue,
} from '../offlineQueue';

const QUEUE_KEY = '@offline_transaction_queue';

function resetRetryWindow(): void {
  const raw = mockSecureStore.get(QUEUE_KEY);
  if (!raw) return;

  const queue = JSON.parse(raw) as Array<Record<string, unknown>>;
  queue.forEach((item) => {
    item.nextRetryAt = 0;
  });
  mockSecureStore.set(QUEUE_KEY, JSON.stringify(queue));
}

describe('offline transaction queue', () => {
  afterEach(async () => {
    await clearQueue();
    mockSecureStore.clear();
    jest.clearAllMocks();
  });

  it('keeps failed transactions in the queue after max retries', async () => {
    mockAddTransaction.mockRejectedValue(new Error('network fail'));

    await queueTransaction({
      type: 'debit',
      currency: 'USD',
      amount: 12,
      description: 'Coffee',
    });

    await syncQueue();
    resetRetryWindow();
    await syncQueue();
    resetRetryWindow();
    const finalResult = await syncQueue();

    const queued = await getQueuedTransactions();

    expect(finalResult.synced).toBe(0);
    expect(finalResult.failed).toBe(1);
    expect(finalResult.remaining).toBe(1);
    expect(queued).toHaveLength(1);
    expect(queued[0].retryCount).toBe(3);
    expect(queued[0].failedAt).toBeDefined();
    expect(queued[0].lastError).toContain('network fail');
  });
});
