import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cacheData,
  getCachedData,
  queueMutation,
  getPendingMutations,
  removePendingMutation,
  clearPendingMutations,
  withRetry,
  clearCache,
} from '../lib/offline';

// AsyncStorage is mocked via setup.ts

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// cacheData / getCachedData
// ============================================================

describe('cacheData & getCachedData', () => {
  it('stores and retrieves cached data', async () => {
    const testData = { items: [1, 2, 3] };

    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ data: testData, cachedAt: new Date().toISOString() }),
    );

    await cacheData('test_key', testData);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'littlejourney_cache_test_key',
      expect.any(String),
    );

    const result = await getCachedData<typeof testData>('test_key');
    expect(result).toEqual(testData);
  });

  it('returns null for missing cache', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await getCachedData('missing');
    expect(result).toBeNull();
  });

  it('returns null for expired cache', async () => {
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours old
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ data: 'old', cachedAt: oldDate }),
    );

    // Default maxAge is 30 minutes
    const result = await getCachedData('expired');
    expect(result).toBeNull();
  });

  it('respects custom maxAge', async () => {
    const recentDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 mins old
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ data: 'recent', cachedAt: recentDate }),
    );

    // 5 minutes maxAge → should be expired
    expect(await getCachedData('key', 5 * 60 * 1000)).toBeNull();

    // 30 minutes maxAge → should be fresh
    expect(await getCachedData('key', 30 * 60 * 1000)).toBe('recent');
  });
});

// ============================================================
// Mutation queue
// ============================================================

describe('mutation queue', () => {
  it('queues and retrieves mutations', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]');
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    await queueMutation({ table: 'entries', operation: 'insert', data: { title: 'Lunch' } });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'littlejourney_pending_mutations',
      expect.stringContaining('"table":"entries"'),
    );
  });

  it('returns empty array when no mutations queued', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await getPendingMutations();
    expect(result).toEqual([]);
  });

  it('removes a mutation by id', async () => {
    const mutations = [
      { id: 'mut_1', table: 't', operation: 'insert', data: {}, createdAt: '2026-01-01' },
      { id: 'mut_2', table: 't', operation: 'update', data: {}, createdAt: '2026-01-01' },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mutations));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    await removePendingMutation('mut_1');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'littlejourney_pending_mutations',
      expect.not.stringContaining('mut_1'),
    );
  });

  it('clears all mutations', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    await clearPendingMutations();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('littlejourney_pending_mutations');
  });
});

// ============================================================
// withRetry
// ============================================================

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, 2, 10)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

// ============================================================
// clearCache
// ============================================================

describe('clearCache', () => {
  it('removes only cache-prefixed keys', async () => {
    (AsyncStorage.getAllKeys as jest.Mock) = jest.fn().mockResolvedValue([
      'littlejourney_cache_timeline',
      'littlejourney_cache_gallery',
      'littlejourney_pending_mutations',
      'other_key',
    ]);
    (AsyncStorage.multiRemove as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    await clearCache();

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      'littlejourney_cache_timeline',
      'littlejourney_cache_gallery',
    ]);
  });
});
